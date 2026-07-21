// ============================================================
// notify-opportunities — as oportunidades do dia no Telegram (08′)
// ============================================================
// Cron diário (10h BRT, logo após a carga do dbt). O motor de valor já
// existe (dbt → fact_value_opportunities → get_futebol_value_board); esta
// função é SÓ o formato de entrega:
//
//   1. Lê o board (mesma fonte do site — zero lógica duplicada)
//   2. Jogos de HOJE ainda não iniciados → melhor pick por jogo → top 3
//      por Score, com corte mínimo (>= 40 / faixa Média)
//   3. SEM oportunidade boa → NÃO manda nada (o silêncio no dia fraco é o
//      que torna a mensagem crível no dia forte)
//   4. Envia pros dois segmentos (RPC get_opportunity_recipients):
//        A · futebol ativo (trial/assinante) — recebe sempre
//        B · reativação — até 2 envios sem clique, depois para
//   5. Links passam pelo redirecionador `go` (clique rastreado → zera o
//      contador do B e alimenta o funil enviado → clicou → registrou)
//
// A DM fala a língua do site: pickLabel/Score/faixa/evidências portados de
// src/utils/futebol-score.ts. Sem nome de casa de aposta (decisão 08/07).
//
// ?mode=report → não envia; devolve picks do dia + destinatários (ensaio).
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET.
// Runbook: NOTIFY_OPPORTUNITIES_SETUP.md
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";
import { esc } from "../shared/format.ts";
import { trackedUrl } from "../shared/links.ts";
import { logMessageRun } from "../shared/runs.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SITE = "https://www.smartbetting.app";

const MIN_SCORE = 40;   // corte: faixa Média pra cima
const MAX_PICKS = 3;    // top N do dia
const CAMPAIGN = "daily_opportunities";

// ── rótulos (portados de src/utils/futebol-score.ts — mesma língua do site) ──
function fmtHandicapLine(line: number): string {
  const sign = line > 0 ? "+" : line < 0 ? "−" : "";
  return `${sign}${String(Math.abs(line)).replace(".", ",")}`;
}
function outcomePt(outcome: string, homeName: string, awayName: string): string {
  switch (outcome) {
    case "Home": return homeName;
    case "Away": return awayName;
    case "Draw": return "Empate";
    default: return outcome;
  }
}
function pickLabel(market: string, outcome: string, line: number | null, homeName: string, awayName: string): string {
  if (market === "goals_over_under") {
    const n = line != null ? String(line).replace(".", ",") : "";
    return outcome === "Over" ? `Mais de ${n} gols` : `Menos de ${n} gols`;
  }
  if (market === "asian_handicap") {
    const team = outcome === "Home" ? homeName : awayName;
    const sideLine = line != null ? (outcome === "Away" ? -line : line) : null;
    return sideLine != null ? `${team} ${fmtHandicapLine(sideLine)}` : team;
  }
  if (market === "btts") return outcome === "Yes" ? "Ambos marcam: Sim" : "Ambos marcam: Não";
  if (market === "double_chance") return outcome === "1X" ? `${homeName} ou empate` : `Empate ou ${awayName}`;
  if (market === "match_winner") return `Vitória: ${outcomePt(outcome, homeName, awayName)}`;
  return outcomePt(outcome, homeName, awayName);
}

// mercado → rótulo PT que a auto-liquidação (notify-settlement) reconhece,
// pra a aposta registrada aqui ser liquidável depois pelo mesmo motor
function marketPt(market: string): string {
  switch (market) {
    case "match_winner": return "Money Line";
    case "goals_over_under": return "Over/Under";
    case "asian_handicap": return "Handicap";
    case "btts": return "Ambas marcam";
    case "double_chance": return "Dupla chance";
    default: return market;
  }
}

// ── util ─────────────────────────────────────────────────────
// esc/trackedUrl vivem em shared/ (Onda 3 — estavam duplicados 1:1)
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// kickoff_utc vem "YYYY-MM-DD HH:MM:SS" (UTC, sem timezone)
const kickoffDate = (s: string) => new Date(s.replace(" ", "T") + "Z");

function brtDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d); // YYYY-MM-DD
}
function brtHourMin(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d);
}

interface BoardRow {
  fixture_id: number;
  home_team_name: string;
  away_team_name: string;
  competition: string;
  kickoff_utc: string;
  status_short: string;
  market: string;
  outcome: string;
  line_value: number | null;
  best_odd: number;
  score: number;
  faixa: string;
  evidencias: string[] | null;
}

interface Recipient {
  user_id: string;
  chat_id: string;
  user_name: string | null;
  segment: "A" | "B";
  sends_without_click: number;
}

async function buildMessage(picks: BoardRow[], userId: string): Promise<string> {
  const lines: string[] = [
    `⚽ <b>As oportunidades de hoje</b> · ${picks.length} ${picks.length === 1 ? "jogo" : "jogos"} com valor`,
    "",
  ];
  for (const p of picks) {
    const jogoUrl = await trackedUrl(userId, `jogo-${p.fixture_id}`);
    const hora = brtHourMin(kickoffDate(p.kickoff_utc));
    const pick = pickLabel(p.market, p.outcome, p.line_value, p.home_team_name, p.away_team_name);
    const evidencia = p.evidencias?.length ? `\n✓ ${esc(p.evidencias[0])}` : "";
    lines.push(
      `<a href="${jogoUrl}"><b>${esc(p.home_team_name)} × ${esc(p.away_team_name)}</b></a> · ${hora}`,
      `${esc(pick)} · odd ${p.best_odd} · Score <b>${p.score} · ${esc(p.faixa)}</b>${evidencia}`,
      ""
    );
  }
  lines.push(`<i>Score = confiabilidade da oportunidade (0–100), calculado contra a linha sharp do mercado.</i>`);
  return lines.join("\n");
}

// botão "Registrar no Betinho" por pick (item 15). label curto pra caber.
function registerButtons(picks: BoardRow[], pickIdByFixture: Map<number, string>): any[] {
  const rows: any[] = [];
  for (const p of picks) {
    const id = pickIdByFixture.get(p.fixture_id);
    if (!id) continue;
    const label = pickLabel(p.market, p.outcome, p.line_value, p.home_team_name, p.away_team_name);
    rows.push([{ text: `📋 Registrar: ${label.length > 34 ? label.slice(0, 33) + "…" : label}`, callback_data: `regbet:${id}` }]);
  }
  return rows;
}

async function sendDaily(chatId: string, text: string, boardUrl: string, pickRows: any[]): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [...pickRows, [{ text: "Ver a análise completa", url: boardUrl }]] },
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);
  if (!TELEGRAM_BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

  const mode = new URL(req.url).searchParams.get("mode") || "send";
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const traceId = generateTraceId();

  try {
    // 1) board do dia — mesma fonte do site
    const { data: board, error: bErr } = await supabase.rpc("get_futebol_value_board");
    if (bErr) throw bErr;

    const now = new Date();
    const today = brtDay(now);
    const todayRows = ((board ?? []) as BoardRow[]).filter((r) => {
      const k = kickoffDate(r.kickoff_utc);
      return k.getTime() > now.getTime() && brtDay(k) === today && r.score >= MIN_SCORE;
    });

    // melhor pick por jogo → top N por Score
    const bestByFixture = new Map<number, BoardRow>();
    for (const r of todayRows) {
      const cur = bestByFixture.get(r.fixture_id);
      if (!cur || r.score > cur.score) bestByFixture.set(r.fixture_id, r);
    }
    const picks = [...bestByFixture.values()].sort((a, b) => b.score - a.score).slice(0, MAX_PICKS);

    // 3) dia fraco → silêncio (nada de mensagem "hoje não tem nada")
    if (picks.length === 0) {
      // o dia de silêncio é informação (telemetria); ensaio (report) não loga
      if (mode === "send") {
        await logMessageRun(supabase, "notify-opportunities", { candidates: 0, sent: 0, ok: true });
      }
      return json({ ok: true, mode, picks: 0, sent: 0, motivo: "sem oportunidade acima do corte hoje" });
    }

    // 4) destinatários
    const { data: recData, error: rErr } = await supabase.rpc("get_opportunity_recipients");
    if (rErr) throw rErr;
    const recipients = (recData ?? []) as Recipient[];

    if (mode === "report") {
      return json({
        ok: true, mode,
        picks: picks.map((p) => ({
          jogo: `${p.home_team_name} × ${p.away_team_name}`,
          pick: pickLabel(p.market, p.outcome, p.line_value, p.home_team_name, p.away_team_name),
          odd: p.best_odd, score: p.score, faixa: p.faixa,
        })),
        destinatarios: recipients.map((r) => ({ segment: r.segment, user_name: r.user_name, sends_without_click: r.sends_without_click })),
      });
    }

    // 5) persiste os picks do dia (referência dos botões "Registrar no Betinho")
    // — uma vez, compartilhado entre todos; upsert idempotente por (dia,jogo,aposta)
    const pickRows = picks.map((p) => ({
      fixture_id: p.fixture_id,
      sport: "Futebol",
      league: p.competition,
      betting_market: marketPt(p.market),
      match_description: `${p.home_team_name} × ${p.away_team_name}`,
      bet_description: pickLabel(p.market, p.outcome, p.line_value, p.home_team_name, p.away_team_name),
      odds: p.best_odd,
      match_date: kickoffDate(p.kickoff_utc).toISOString(),
    }));
    const { data: savedPicks, error: pErr } = await supabase
      .from("daily_opportunity_picks")
      .upsert(pickRows, { onConflict: "sent_date,fixture_id,bet_description" })
      .select("id, fixture_id");
    if (pErr) throw pErr;
    const pickIdByFixture = new Map<number, string>(
      (savedPicks ?? []).map((r: any) => [Number(r.fixture_id), r.id as string])
    );
    const pickButtonRows = registerButtons(picks, pickIdByFixture);

    // 6) envio + estado de cadência
    let sent = 0;
    const errors: string[] = [];
    for (const r of recipients) {
      try {
        const text = await buildMessage(picks, r.user_id);
        const boardUrl = await trackedUrl(r.user_id, "board");
        await sendDaily(r.chat_id, text, boardUrl, pickButtonRows);

        const { error: upErr } = await supabase.from("opportunity_dispatch_state").upsert({
          user_id: r.user_id,
          segment: r.segment,
          sends_without_click: r.sends_without_click + 1, // clique zera via `go`
          last_sent_at: new Date().toISOString(),
        });
        if (upErr) throw upErr;

        sent++;
        await trackEvent(
          "daily_opportunities_sent",
          { segment: r.segment, picks_count: picks.length, top_score: picks[0].score, channel: "telegram" },
          r.user_id, traceId
        ).catch(() => {});
      } catch (e) {
        errors.push(`${r.user_id}: ${(e as Error)?.message}`);
      }
    }

    // telemetria — só runs de envio (report é ensaio)
    await logMessageRun(supabase, "notify-opportunities", { candidates: recipients.length, sent, errors, ok: true });

    return json({ ok: true, mode, picks: picks.length, destinatarios: recipients.length, sent, errors });
  } catch (e) {
    console.error("notify-opportunities error:", e);
    if (mode === "send") {
      await logMessageRun(supabase, "notify-opportunities", { errors: [(e as Error)?.message ?? "erro"], ok: false });
    }
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
