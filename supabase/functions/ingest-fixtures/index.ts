// ============================================================
// ingest-fixtures — coletor de placares multi-liga (F1 do parecer Kasuya)
// ============================================================
// Dois modos, dois crons (migration 082):
//
//   ?mode=calendar (diário 04:00 BRT) — 1 chamada por liga habilitada
//     (fixtures?league&season): jogos novos, remarcações, TBD→NS. É o que
//     alimenta o GATE do cron live (sem jogo em janela → live nem roda).
//
//   ?mode=live (a cada 2 min, SÓ quando o gate SQL detecta jogo em janela) —
//     1 chamada fixtures?live={ids das ligas habilitadas} pra TODOS os jogos
//     rolando + CONFIRMAÇÃO DE ENCERRAMENTO: jogo que estava em janela e
//     sumiu do live (ou passou de 2H pra fim) é confirmado via
//     fixtures?ids=a-b-c (lote de até 20) — devolve status terminal (FT/AET/
//     PEN) e score.fulltime (90', a base de liquidação). Cobre o caso
//     "último poll pegou o jogo aos 88'" e o AET/PEN de mata-mata.
//
// Telemetria (lacuna nº1 do parecer): toda execução grava collector_runs
// (chamadas feitas, quota restante do header x-ratelimit) e, após 5 falhas
// consecutivas, manda DM de alerta pro admin (env ADMIN_TELEGRAM_CHAT_ID).
// "Degradar em silêncio" era o modo de falha — não é mais.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_SPORTS_KEY,
//                 CRON_SECRET (+ TELEGRAM_BOT_TOKEN e ADMIN_TELEGRAM_CHAT_ID
//                 opcionais, pro alerta).
// Runbook: MULTI_LEAGUE_COLLECTOR_SETUP.md
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://v3.football.api-sports.io";
const API_SPORTS_KEY = Deno.env.get("API_SPORTS_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const ADMIN_CHAT_ID = Deno.env.get("ADMIN_TELEGRAM_CHAT_ID") || "";

const TERMINAL = new Set(["FT", "AET", "PEN", "CANC", "ABD", "AWD", "WO"]);
const ALERT_AFTER_FAILURES = 5;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ── API-Football: fetch com captura do header de quota ───────
let apiCalls = 0;
let quotaRemaining: number | null = null;

async function api(path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { "x-apisports-key": API_SPORTS_KEY } });
  apiCalls++;
  const q = res.headers.get("x-ratelimit-requests-remaining");
  if (q != null) quotaRemaining = Number(q);
  if (!res.ok) throw new Error(`API-Sports ${res.status} em ${path}`);
  const payload = await res.json();
  if (payload?.errors && Object.keys(payload.errors).length > 0) {
    throw new Error(`API-Sports errors em ${path}: ${JSON.stringify(payload.errors).slice(0, 200)}`);
  }
  return payload?.response ?? [];
}

// fixture da API → linha da nossa tabela
function toRow(fx: any): Record<string, unknown> {
  const winner = fx?.teams?.home?.winner === true ? "home" : fx?.teams?.away?.winner === true ? "away" : null;
  return {
    fixture_id: fx?.fixture?.id,
    league_id: fx?.league?.id,
    season: fx?.league?.season,
    round: fx?.league?.round ?? null,
    home_team_id: fx?.teams?.home?.id ?? null,
    home_team: fx?.teams?.home?.name ?? "?",
    away_team_id: fx?.teams?.away?.id ?? null,
    away_team: fx?.teams?.away?.name ?? "?",
    kickoff_utc: fx?.fixture?.date, // ISO com timezone
    status_short: fx?.fixture?.status?.short ?? null,
    elapsed: fx?.fixture?.status?.elapsed ?? null,
    goals_home: fx?.goals?.home ?? null,
    goals_away: fx?.goals?.away ?? null,
    halftime_home: fx?.score?.halftime?.home ?? null,
    halftime_away: fx?.score?.halftime?.away ?? null,
    fulltime_home: fx?.score?.fulltime?.home ?? null,
    fulltime_away: fx?.score?.fulltime?.away ?? null,
    extratime_home: fx?.score?.extratime?.home ?? null,
    extratime_away: fx?.score?.extratime?.away ?? null,
    penalty_home: fx?.score?.penalty?.home ?? null,
    penalty_away: fx?.score?.penalty?.away ?? null,
    winner,
  };
}

async function upsertRows(supabase: any, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("fixtures").upsert(rows, { onConflict: "fixture_id" });
  if (error) throw new Error(`upsert fixtures: ${error.message}`);
}

// ── alerta de falhas consecutivas (telemetria acionável) ─────
async function maybeAlertAdmin(supabase: any, mode: string, errMsg: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !ADMIN_CHAT_ID) return;
  const { data } = await supabase
    .from("collector_runs")
    .select("ok")
    .order("ran_at", { ascending: false })
    .limit(ALERT_AFTER_FAILURES);
  const runs = data ?? [];
  if (runs.length < ALERT_AFTER_FAILURES || runs.some((r: any) => r.ok)) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      text: `🚨 ingest-fixtures: ${ALERT_AFTER_FAILURES} falhas consecutivas (modo ${mode}).\nÚltimo erro: ${errMsg.slice(0, 300)}\nVer collector_runs.`,
    }),
  }).catch(() => {});
}

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);
  if (!API_SPORTS_KEY) return json({ error: "API_SPORTS_KEY not set" }, 500);

  const mode = new URL(req.url).searchParams.get("mode") || "live";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  let liveCount = 0;
  let confirmed = 0;

  try {
    const { data: leaguesData, error: lErr } = await supabase
      .from("leagues_config")
      .select("league_id, season")
      .eq("enabled", true);
    if (lErr) throw lErr;
    const leagues: Array<{ league_id: number; season: number }> = leaguesData ?? [];
    if (leagues.length === 0) return json({ ok: true, mode, motivo: "nenhuma liga habilitada" });

    if (mode === "calendar") {
      // 1 chamada por liga: temporada inteira (upsert idempotente)
      for (const lg of leagues) {
        const fixtures = await api(`/fixtures?league=${lg.league_id}&season=${lg.season}`);
        await upsertRows(supabase, fixtures.map(toRow).filter((r: any) => r.fixture_id));
      }
    } else {
      // ── LIVE ───────────────────────────────────────────────
      const ids = [...new Set(leagues.map((l) => l.league_id))].join("-");
      const live = await api(`/fixtures?live=${ids}`);
      liveCount = live.length;
      await upsertRows(supabase, live.map(toRow).filter((r: any) => r.fixture_id));

      // CONFIRMAÇÃO: jogos em janela que começaram, não estão terminais no
      // banco e NÃO apareceram no live → provavelmente acabaram → lote ids
      const liveIds = new Set(live.map((fx: any) => fx?.fixture?.id));
      const { data: pendData, error: pErr } = await supabase
        .from("fixtures")
        .select("fixture_id, status_short, kickoff_utc, league_id, season")
        .lte("kickoff_utc", new Date().toISOString())
        .gte("kickoff_utc", new Date(Date.now() - 6 * 3600_000).toISOString());
      if (pErr) throw pErr;
      const enabledKey = new Set(leagues.map((l) => `${l.league_id}:${l.season}`));
      const toConfirm = (pendData ?? [])
        .filter((f: any) =>
          enabledKey.has(`${f.league_id}:${f.season}`) &&
          !TERMINAL.has(f.status_short ?? "NS") &&
          !liveIds.has(f.fixture_id)
        )
        .map((f: any) => f.fixture_id);

      for (let i = 0; i < toConfirm.length; i += 20) {
        const batch = toConfirm.slice(i, i + 20);
        const fixtures = await api(`/fixtures?ids=${batch.join("-")}`);
        await upsertRows(supabase, fixtures.map(toRow).filter((r: any) => r.fixture_id));
        confirmed += fixtures.length;
      }
    }

    await supabase.from("collector_runs").insert({
      mode, window_active: mode === "live" ? true : null,
      live_fixtures: liveCount, api_calls: apiCalls,
      quota_remaining: quotaRemaining, ok: true,
    });

    return json({ ok: true, mode, ligas: leagues.length, live: liveCount, confirmados: confirmed, chamadas: apiCalls, quota_restante: quotaRemaining });
  } catch (e) {
    const msg = (e as Error)?.message ?? "erro desconhecido";
    console.error("ingest-fixtures error:", msg);
    await supabase.from("collector_runs").insert({
      mode, window_active: null, live_fixtures: liveCount,
      api_calls: apiCalls, quota_remaining: quotaRemaining, ok: false, error: msg.slice(0, 500),
    }).then(() => maybeAlertAdmin(supabase, mode, msg)).catch(() => {});
    return json({ error: msg }, 500);
  }
});
