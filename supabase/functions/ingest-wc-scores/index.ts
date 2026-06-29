// ============================================================
// ingest-wc-scores — ingestão de placar da Copa (API-Sports → wc_matches)
// ============================================================
// Job de cron. Puxa os fixtures da Copa 2026 na API-Sports e:
//   1. atualiza placar + is_finished (casando por api_fixture_id);
//   2. captura o VENCEDOR real (incl. pênaltis) em winner_team_code;
//   3. AUTO-LINKA jogos do mata-mata: quando a API define os times de uma rodada,
//      casa por (rodada + par de times via wc_team_map) e grava api_fixture_id;
//   4. PROPAGA o vencedor/perdedor pros próximos jogos ("Vencedor/Perdedor Jxx");
//   5. dispara calculate_bolao_scores nos jogos que (re)finalizaram.
//
// Placar = goals.home/away (AET incluso; pênaltis à parte) → empate nos 120 quando
// vai pra pênaltis, como manda a FIFA. O vencedor da disputa vai em winner_team_code.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_SPORTS_KEY, CRON_SECRET.
// Idempotente: só escreve quando muda; só recalcula quando (re)finaliza.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;
const FINISHED = new Set(["FT", "AET", "PEN"]); // status.short que contam como encerrado

// league.round (API-Sports) → nosso stage. Casamento case-insensitive.
const ROUND_TO_STAGE: Record<string, string> = {
  "round of 32": "round_of_32",
  "round of 16": "round_of_16",
  "quarter-finals": "quarter",
  "semi-finals": "semi",
  "3rd place final": "third_place",
  "final": "final",
};
function roundToStage(round: string | undefined): string | null {
  if (!round) return null;
  return ROUND_TO_STAGE[round.trim().toLowerCase()] ?? null;
}

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!cronSecret || provided !== cronSecret) return json({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("API_SPORTS_KEY") || "";
  if (!apiKey) return json({ error: "API_SPORTS_KEY not set" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    // 1) Fixtures da Copa
    const res = await fetch(`${API_BASE}/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`, {
      headers: { "x-apisports-key": apiKey },
    });
    if (!res.ok) return json({ error: `API ${res.status}` }, 502);
    const payload = await res.json();
    const fixtures: any[] = payload?.response ?? [];

    // 2) Nosso estado: todos os jogos + mapa de times (api_team_id → código)
    const { data: rows, error: selErr } = await supabase
      .from("wc_matches")
      .select("id, match_number, stage, home_team, away_team, home_team_code, away_team_code, home_score, away_score, is_finished, api_fixture_id, winner_team_code");
    if (selErr) throw selErr;

    const { data: teamMapRows, error: tmErr } = await supabase
      .from("wc_team_map")
      .select("api_team_id, team_code");
    if (tmErr) throw tmErr;
    const codeByApiTeam = new Map<number, string>();
    for (const t of teamMapRows ?? []) codeByApiTeam.set(Number(t.api_team_id), t.team_code);

    const byFixture = new Map<number, any>();
    // index de jogos do mata-mata NÃO linkados, por (stage + par de times)
    const unlinkedKo = new Map<string, any>();
    for (const r of rows ?? []) {
      if (r.api_fixture_id != null) byFixture.set(Number(r.api_fixture_id), r);
      else if (
        r.stage !== "group" &&
        r.home_team_code && r.home_team_code !== "TBD" &&
        r.away_team_code && r.away_team_code !== "TBD"
      ) {
        unlinkedKo.set(`${r.stage}::${pairKey(r.home_team_code, r.away_team_code)}`, r);
      }
    }

    const changedMatchIds: number[] = [];
    let updated = 0;
    let linked = 0;
    let skippedUnlinked = 0;
    let koFinished = false; // algum jogo de mata-mata (re)finalizou neste ciclo?

    for (const fx of fixtures) {
      const fid = Number(fx?.fixture?.id);
      const apiHome = codeByApiTeam.get(Number(fx?.teams?.home?.id)) ?? null;
      const apiAway = codeByApiTeam.get(Number(fx?.teams?.away?.id)) ?? null;

      // Acha nossa linha: por fixture já linkado, ou auto-link por (stage + par).
      let row = byFixture.get(fid);
      let justLinked = false;
      if (!row) {
        const stage = roundToStage(fx?.league?.round);
        if (stage && apiHome && apiAway) {
          const key = `${stage}::${pairKey(apiHome, apiAway)}`;
          const cand = unlinkedKo.get(key);
          if (cand) {
            row = cand;
            justLinked = true;
            unlinkedKo.delete(key);
          }
        }
      }
      if (!row) { skippedUnlinked++; continue; }

      // Alinha o placar ao NOSSO mandante/visitante (a ordem da API pode diferir).
      const goalsHome = fx?.goals?.home ?? null;
      const goalsAway = fx?.goals?.away ?? null;
      let homeScore: number | null, awayScore: number | null;
      if (apiHome && apiHome === row.home_team_code) {
        homeScore = goalsHome; awayScore = goalsAway;
      } else if (apiHome && apiHome === row.away_team_code) {
        homeScore = goalsAway; awayScore = goalsHome; // ordem invertida
      } else {
        homeScore = goalsHome; awayScore = goalsAway; // fallback (grupo / linkado na mesma ordem)
      }

      const status = fx?.fixture?.status?.short ?? "";
      const isFinished = FINISHED.has(status);
      // Vencedor real (incl. pênaltis): quem tem winner=true na API.
      const winnerCode = fx?.teams?.home?.winner === true ? apiHome
        : fx?.teams?.away?.winner === true ? apiAway
        : null;

      const patch: Record<string, unknown> = {};
      if (justLinked) patch.api_fixture_id = fid;
      if (row.home_score !== homeScore) patch.home_score = homeScore;
      if (row.away_score !== awayScore) patch.away_score = awayScore;
      if (row.is_finished !== isFinished) patch.is_finished = isFinished;
      if (winnerCode && row.winner_team_code !== winnerCode) patch.winner_team_code = winnerCode;

      if (Object.keys(patch).length === 0) continue;

      const { error: updErr } = await supabase.from("wc_matches").update(patch).eq("id", row.id);
      if (updErr) throw updErr;
      updated++;
      if (justLinked) linked++;

      // Refinalizou (passou a estar encerrado, ou placar mudou já encerrado)?
      const becameFinished = isFinished && (row.is_finished !== true || row.home_score !== homeScore || row.away_score !== awayScore);
      if (becameFinished) {
        changedMatchIds.push(row.id);
        if (row.stage !== "group") koFinished = true;
      }

      // 4) PROPAGAÇÃO — joga o vencedor/perdedor pros próximos jogos.
      if (isFinished && winnerCode && row.stage !== "group") {
        const loserCode = winnerCode === row.home_team_code ? row.away_team_code
          : winnerCode === row.away_team_code ? row.home_team_code : null;
        await propagate(supabase, rows ?? [], row.match_number, winnerCode, loserCode);
      }
    }

    // 5) Recalcula pontos de placar dos jogos que (re)finalizaram.
    const scored: number[] = [];
    for (const matchId of changedMatchIds) {
      const { error: rpcErr } = await supabase.rpc("calculate_bolao_scores", { p_match_id: matchId });
      if (rpcErr) { console.error(`calculate_bolao_scores(${matchId}):`, rpcErr.message); continue; }
      scored.push(matchId);
    }

    // Mata-mata (re)finalizou → recomputa os palpites especiais "quem avança"
    // (só pontua as fases que fecharam; idempotente).
    let specialResolved = false;
    if (koFinished) {
      const { error: spErr } = await supabase.rpc("resolve_all_special_scores");
      if (spErr) console.error("resolve_all_special_scores:", spErr.message);
      else specialResolved = true;
    }

    return json({
      ok: true,
      fixtures_recebidos: fixtures.length,
      jogos_atualizados: updated,
      jogos_linkados: linked,
      jogos_recalculados: scored.length,
      especiais_recalculados: specialResolved,
      fixtures_sem_link: skippedUnlinked,
    });
  } catch (e) {
    console.error("ingest-wc-scores error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

// Preenche o time real nas linhas que dependem deste jogo:
//   "Vencedor J{n}" → vencedor;  "Perdedor J{n}" → perdedor (disputa de 3º).
// Só escreve onde ainda está TBD (não clobbera correção manual). Idempotente.
async function propagate(
  supabase: any,
  rows: any[],
  matchNumber: number,
  winnerCode: string,
  loserCode: string | null
) {
  const winLabel = `Vencedor J${matchNumber}`;
  const loseLabel = `Perdedor J${matchNumber}`;
  for (const r of rows) {
    if (r.stage === "group") continue;
    const patch: Record<string, unknown> = {};
    if (r.home_team === winLabel && r.home_team_code === "TBD") patch.home_team_code = winnerCode;
    if (r.away_team === winLabel && r.away_team_code === "TBD") patch.away_team_code = winnerCode;
    if (loserCode && r.home_team === loseLabel && r.home_team_code === "TBD") patch.home_team_code = loserCode;
    if (loserCode && r.away_team === loseLabel && r.away_team_code === "TBD") patch.away_team_code = loserCode;
    if (Object.keys(patch).length === 0) continue;
    // reflete no objeto em memória (caso outra propagação no mesmo run o use)
    Object.assign(r, patch);
    const { error } = await supabase.from("wc_matches").update(patch).eq("id", r.id);
    if (error) throw error;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
