// ============================================================
// notify-settlement — lembrete de liquidação com resultado preenchido
// ============================================================
// Job de cron (roda a cada 15 min; migration 078). Ataca o buraco da retenção:
// a maioria das apostas morre em 'pending' porque liquidar exige entrar no site.
// Aqui o Betinho manda DM no Telegram quando o jogo termina, com botões inline
// [✅ Green] [❌ Red] — 1 toque e a banca atualiza (handler no telegram-webhook).
//
// Duas classes de lembrete:
//   • JOGO CASADO — aposta casada com um jogo encerrado (por nome dos dois times
//     na descrição). A fonte de placar é DUPLA (F2, item 02'):
//       – wc_matches: só a Copa do Mundo (motor original do Marco 0).
//       – public.fixtures: multi-liga, alimentada pelo coletor ingest-fixtures
//         (Brasileirão A/B, Copa do Brasil, Libertadores, … — migration 082).
//     Quando o mercado é computável (ML/1x2, over-under de gols, ambas marcam,
//     handicap asiático), o veredito sai pelo placar dos 90' (fulltime_*) e a
//     aposta é AUTO-LIQUIDADA (decisão de produto 09/07; estendida a todas as
//     ligas em 14/07): grava won/lost + evidência em processed_data.auto_settle
//     e avisa com botão [↩️ Corrigir] (handler fix:<bet_id> no telegram-webhook,
//     que desfaz pra pendente). Sem veredito computável, a mensagem chega com o
//     placar e PERGUNTA com os botões. Casamento estrito (os DOIS times, palavra
//     inteira) — sem confiança, não liquida: só pergunta.
//   • GENÉRICA — sem placar no banco: jogo já deve ter acabado (match_date
//     passou, ou aposta com 24h+), pergunta com os mesmos botões, sem veredito.
//     Respeita janela de silêncio (09h–23h BRT); a do jogo casado sai na hora do
//     apito (quem apostou no jogo está acordado assistindo).
//
// Matching + veredito vivem em ./verdict.ts (código puro, testado no CI —
// supabase/functions/tests/verdict.test.ts).
//
// Cadência: teto de 2 lembretes por aposta com gap de 20h (RPC), máx. 3
// mensagens por usuário por run. Veredito NUNCA é dado em múltiplas/sistema,
// nem em mercados de classificação/prorrogação (regras de casa divergem).
//
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
//                 CRON_SECRET (+ POSTHOG_API_KEY opcional, via shared/posthog).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";
import { esc } from "../shared/format.ts";
import { logMessageRun } from "../shared/runs.ts";
import {
  type Candidate,
  type FinishedMatch,
  type Verdict,
  computeVerdict,
  fixtureTeamNames,
  hasTeam,
  norm,
  teamNames,
} from "./verdict.ts";
import {
  type DigestItem,
  type SettleStatus,
  DIGEST_MIN,
  buildDigestMessage,
  digestButtonRows,
  money,
} from "./digest.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const BETS_URL = "https://www.smartbetting.app/bets";
const MAX_PER_USER_PER_RUN = 3;
const QUIET_START = 9; // genéricas só entre 09:00–22:59 BRT
const QUIET_END = 23;

// ── Telegram ─────────────────────────────────────────────────
async function sendReminder(chatId: string, text: string, betId: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Green", callback_data: `settle:${betId}:won` },
            { text: "❌ Red", callback_data: `settle:${betId}:lost` },
          ],
          [
            { text: "Outras opções ↗", url: BETS_URL },
            { text: "🔕 Parar lembretes", callback_data: `mute:${betId}` },
          ],
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

interface WcMatch {
  id: number;
  stage: string;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  match_date: string; // date
  match_time_brasilia: string; // time
  home_score: number | null;
  away_score: number | null;
  fulltime_home: number | null;
  fulltime_away: number | null;
  is_finished: boolean;
}

// ── Mensagens ────────────────────────────────────────────────
// money vive em ./digest.ts (Onda 5)

function betLine(bet: Candidate): string {
  return (
    `Sua aposta: <b>${esc(bet.bet_description)}</b>\n` +
    `${money(bet.stake_amount)} · odd ${bet.odds} · retorno ${money(bet.potential_return)}`
  );
}

function buildMatchMessage(bet: Candidate, m: FinishedMatch, verdict: Verdict): string {
  // placar final (com prorrogação se houve) como contexto; 90' decide o veredito
  const wentExtra =
    m.ft_home != null &&
    (m.score_home !== m.ft_home || m.score_away !== m.ft_away);
  const placar = `${esc(m.home_team)} <b>${m.score_home ?? "?"}×${m.score_away ?? "?"}</b> ${esc(m.away_team)}`;
  const extra = wentExtra ? ` <i>(${m.ft_home}×${m.ft_away} no tempo normal)</i>` : "";

  const ask =
    verdict === "won"
      ? "Pelo placar, essa <b>bateu</b> ✅ Confirma?"
      : verdict === "lost"
        ? "Pelo placar, essa <b>não bateu</b> ❌ Confirma?"
        : "E aí, como foi?";

  return `🏁 ${placar} — encerrado${extra}\n\n${betLine(bet)}\n\n${ask}`;
}

function buildGenericMessage(bet: Candidate): string {
  const jogo = bet.match_description ? `<b>${esc(bet.match_description)}</b>\n` : "";
  return `⏱️ Seu jogo já deve ter terminado:\n\n${jogo}${betLine(bet)}\n\nComo foi?`;
}

// ── Auto-liquidação (match perfeito → fecha sozinho + Corrigir) ──
function placarLine(m: FinishedMatch): string {
  const wentExtra =
    m.ft_home != null &&
    (m.score_home !== m.ft_home || m.score_away !== m.ft_away);
  const extra = wentExtra ? ` <i>(${m.ft_home}×${m.ft_away} no tempo normal)</i>` : "";
  return `🏁 ${esc(m.home_team)} <b>${m.score_home ?? "?"}×${m.score_away ?? "?"}</b> ${esc(m.away_team)} — encerrado${extra}`;
}

async function sendAutoSettleDm(bet: Candidate, m: FinishedMatch, verdict: SettleStatus): Promise<void> {
  const profit = bet.potential_return - bet.stake_amount;
  const COPY: Record<SettleStatus, { header: string; resultado: string }> = {
    won: {
      header: "✅ <b>Fechei sua aposta: green!</b>",
      resultado: `Lucro: <b>+${money(profit)}</b> · banca atualizada 📊`,
    },
    lost: {
      header: "❌ <b>Fechei sua aposta: red.</b>",
      resultado: `Prejuízo: <b>−${money(bet.stake_amount)}</b> · faz parte. Banca atualizada 📊`,
    },
    void: {
      header: "↔️ <b>Fechei sua aposta: anulada (push).</b>",
      resultado: `A linha bateu em cheio — valor devolvido: <b>${money(bet.stake_amount)}</b>`,
    },
    half_won: {
      header: "✅ <b>Fechei sua aposta: meio green!</b>",
      resultado: `Metade ganhou, metade voltou. Lucro: <b>+${money(profit / 2)}</b> · banca atualizada 📊`,
    },
    half_lost: {
      header: "❌ <b>Fechei sua aposta: meio red.</b>",
      resultado: `Metade voltou, metade perdeu. Prejuízo: <b>−${money(bet.stake_amount / 2)}</b> · banca atualizada 📊`,
    },
  };
  const header = COPY[verdict].header;
  const resultado = COPY[verdict].resultado;
  const text = [
    header,
    placarLine(m),
    "",
    `<b>${esc(bet.bet_description)}</b> · ${money(bet.stake_amount)} · odd ${bet.odds}`,
    resultado,
    "",
    `<i>Liquidei pelo placar dos 90 minutos. Errei? Toca em Corrigir.</i>`,
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: bet.chat_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[
          { text: "↩️ Corrigir", callback_data: `fix:${bet.bet_id}` },
          { text: "Ver minha banca", url: BETS_URL },
        ]],
      },
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

// Liquida no BANCO com guarda otimista (status='pending'); false = não liquidou
// (estado mudou no meio → cai no fluxo de pergunta). Não manda DM — quem decide
// o formato do aviso (individual × digest) é o loop de envio.
async function settleBet(supabase: any, bet: Candidate, m: FinishedMatch, verdict: SettleStatus): Promise<boolean> {
  const evidence = `${m.home_team} ${m.ft_home}×${m.ft_away} ${m.away_team} (90') · ${m.id}`;
  const { data: cur } = await supabase.from("bets").select("processed_data").eq("id", bet.bet_id).maybeSingle();
  const pd = cur?.processed_data && typeof cur.processed_data === "object" && !Array.isArray(cur.processed_data)
    ? cur.processed_data : {};
  const { data: upd, error } = await supabase
    .from("bets")
    .update({
      status: verdict,
      processed_data: { ...pd, auto_settle: { evidence, source_table: m.source, settled_at: new Date().toISOString(), source: "auto_settlement_v1" } },
    })
    .eq("id", bet.bet_id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  return !error && !!upd;
}

// Caminho individual (<= 2 auto-liquidações no run): liquida + DM rica com
// placar. Ordem deliberada: grava ANTES de avisar — o valor está na banca
// certa; a DM falhar não desfaz a liquidação.
async function autoSettle(supabase: any, bet: Candidate, m: FinishedMatch, verdict: SettleStatus): Promise<boolean> {
  const ok = await settleBet(supabase, bet, m, verdict);
  if (!ok) return false;
  await sendAutoSettleDm(bet, m, verdict);
  return true;
}

// Caminho digest (>= DIGEST_MIN no run): UMA DM com todas as liquidações e
// [↩️ Corrigir] por aposta (revisão UX Onda 5 — rajada no apito era spam).
async function sendDigestDm(chatId: string, items: DigestItem[]): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: buildDigestMessage(items),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: digestButtonRows(items, BETS_URL) },
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

// ── Utilidades de tempo ──────────────────────────────────────
// BRT é UTC-3 fixo (sem horário de verão desde 2019)
const kickoffUtc = (wc: WcMatch) => new Date(`${wc.match_date}T${wc.match_time_brasilia}-03:00`);

function brtHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  ) % 24;
}

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!cronSecret || provided !== cronSecret) return json({ error: "Unauthorized" }, 401);
  if (!TELEGRAM_BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  const traceId = generateTraceId();

  try {
    // 1) Apostas candidatas (pendentes, usuário linkado, cadência ok)
    const { data: candData, error: candErr } = await supabase.rpc("get_settlement_reminder_candidates");
    if (candErr) throw candErr;
    const candidates: Candidate[] = candData ?? [];
    if (candidates.length === 0) return json({ ok: true, candidates: 0, sent: 0 });

    // 2) Jogos encerrados nas últimas 60h (janela do "acabou de acabar"),
    //    de DUAS fontes: wc_matches (Copa) e public.fixtures (coletor multi-liga).
    const now = Date.now();
    const since = now - 60 * 3600_000;

    // aliases curados por id (public.team_aliases) — vazia hoje, mas o motor já
    // consome se alguém curar apelidos no futuro (nome+id vêm de fixtures)
    const aliasById = new Map<number, string[]>();
    const { data: aliasData } = await supabase.from("team_aliases").select("api_team_id, alias");
    for (const a of aliasData ?? []) {
      const list = aliasById.get(a.api_team_id) ?? [];
      list.push(a.alias);
      aliasById.set(a.api_team_id, list);
    }

    // 2a) wc_matches (Copa)
    const { data: wcData, error: wcErr } = await supabase
      .from("wc_matches")
      .select(
        "id, stage, home_team, away_team, home_team_code, away_team_code, match_date, match_time_brasilia, home_score, away_score, fulltime_home, fulltime_away, is_finished"
      )
      .eq("is_finished", true)
      .gte("match_date", new Date(since).toISOString().slice(0, 10));
    if (wcErr) throw wcErr;

    const wcFinished: FinishedMatch[] = (wcData ?? [])
      .map((m: WcMatch): FinishedMatch => ({
        source: "wc",
        id: `wc_matches ${m.id}`,
        home_team: m.home_team,
        away_team: m.away_team,
        home_names: teamNames(m.home_team, m.home_team_code),
        away_names: teamNames(m.away_team, m.away_team_code),
        ft_home: m.fulltime_home,
        ft_away: m.fulltime_away,
        score_home: m.home_score,
        score_away: m.away_score,
        kickoff: kickoffUtc(m).getTime(),
      }))
      .filter((f) => f.kickoff <= now && f.kickoff > since);

    // 2b) public.fixtures (coletor) — só jogos jogados até o fim (FT/AET/PEN) com
    //     placar de 90'; nunca CANC/ABD/WO/PST (sem placar válido). Ligas ligadas.
    const { data: enData } = await supabase.from("leagues_config").select("league_id").eq("enabled", true);
    const enabledLeagues = new Set<number>((enData ?? []).map((l: any) => l.league_id));
    const { data: fxData, error: fxErr } = await supabase
      .from("fixtures")
      .select("fixture_id, league_id, home_team_id, home_team, away_team_id, away_team, kickoff_utc, status_short, goals_home, goals_away, fulltime_home, fulltime_away")
      .in("status_short", ["FT", "AET", "PEN"])
      .gte("kickoff_utc", new Date(since).toISOString());
    if (fxErr) throw fxErr;

    const fxFinished: FinishedMatch[] = (fxData ?? [])
      .filter((f: any) => enabledLeagues.has(f.league_id) && f.fulltime_home != null && f.fulltime_away != null)
      .map((f: any): FinishedMatch => ({
        source: "fixtures",
        id: `fixtures ${f.fixture_id}`,
        home_team: f.home_team,
        away_team: f.away_team,
        home_names: fixtureTeamNames(f.home_team, f.home_team_id, aliasById),
        away_names: fixtureTeamNames(f.away_team, f.away_team_id, aliasById),
        ft_home: f.fulltime_home,
        ft_away: f.fulltime_away,
        score_home: f.goals_home,
        score_away: f.goals_away,
        kickoff: new Date(f.kickoff_utc).getTime(),
      }))
      .filter((f) => f.kickoff <= now && f.kickoff > since);

    const finished: FinishedMatch[] = [...wcFinished, ...fxFinished];

    // 3) Classifica cada candidata: casada com jogo da Copa (manda já) ou
    //    genérica (jogo passou + janela de silêncio)
    type Due = { bet: Candidate; kind: "game" | "generic"; match?: FinishedMatch; verdict: Verdict };
    const due: Due[] = [];
    const hour = brtHour();
    const genericAllowed = hour >= QUIET_START && hour < QUIET_END;

    for (const bet of candidates) {
      // múltipla/sistema tem pernas em vários jogos — o placar de UM jogo não a
      // representa; segue o caminho genérico (sem placar, sem veredito)
      const type = norm(bet.bet_type);
      const isMulti = type === "multiple" || type === "system";

      const text = norm(`${bet.match_description ?? ""} ${bet.bet_description ?? ""}`);
      // casa com o jogo mais recente cujos DOIS times aparecem no texto; em
      // empate de kickoff (Copa nas duas fontes na janela de dual-run), wc ganha
      const matched = isMulti
        ? undefined
        : finished
            .filter((f) => hasTeam(text, f.home_names) && hasTeam(text, f.away_names))
            .sort((a, b) => b.kickoff - a.kickoff || (a.source === "wc" ? -1 : b.source === "wc" ? 1 : 0))[0];

      if (matched) {
        due.push({ bet, kind: "game", match: matched, verdict: computeVerdict(bet, matched) });
        continue;
      }

      if (!genericAllowed) continue;
      const matchOver = bet.match_date && new Date(bet.match_date).getTime() < now - 3 * 3600_000;
      const betStale = !bet.match_date && new Date(bet.bet_date).getTime() < now - 24 * 3600_000;
      if (matchOver || betStale) due.push({ bet, kind: "generic", verdict: null });
    }

    // 4) Teto por usuário por run (Copa primeiro — é o lembrete mais quente)
    const byUser = new Map<string, Due[]>();
    for (const d of due) {
      const list = byUser.get(d.bet.user_id) ?? [];
      list.push(d);
      byUser.set(d.bet.user_id, list);
    }

    let sent = 0;
    const errors: string[] = [];
    for (const list of byUser.values()) {
      list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "game" ? -1 : 1));

      let budget = MAX_PER_USER_PER_RUN; // teto é de MENSAGEM, não de liquidação
      let queue = list;

      // DIGEST (Onda 5): >= DIGEST_MIN auto-liquidáveis no mesmo run → liquida
      // TODAS (sem teto — liquidar é o produto funcionando) e manda UMA DM.
      const autoItems = list.filter((d) => d.kind === "game" && d.verdict);
      if (autoItems.length >= DIGEST_MIN) {
        const settledItems: DigestItem[] = [];
        for (const d of autoItems) {
          try {
            const ok = await settleBet(supabase, d.bet, d.match!, d.verdict as SettleStatus);
            if (!ok) continue; // guarda otimista barrou → segue como pergunta no queue
            settledItems.push({ bet: d.bet, verdict: d.verdict as SettleStatus });
            await trackEvent(
              "bet_auto_settled",
              {
                bet_id: d.bet.bet_id,
                verdict: d.verdict,
                betting_market: d.bet.betting_market,
                sport: d.bet.sport,
                league: d.bet.league,
                match_source: d.match?.source ?? null,
                match_id: d.match?.id ?? null,
                digest: true,
                channel: "telegram",
              },
              d.bet.user_id,
              traceId
            ).catch(() => {});
          } catch (e) {
            errors.push(`${d.bet.bet_id}: ${(e as Error)?.message}`);
          }
        }
        queue = list.filter((d) => !settledItems.some((s) => s.bet.bet_id === d.bet.bet_id));
        if (settledItems.length > 0) {
          try {
            await sendDigestDm(settledItems[0].bet.chat_id, settledItems);
            sent++;
          } catch (e) {
            // apostas JÁ liquidadas (grava antes de avisar) — só o aviso falhou
            errors.push(`digest ${settledItems[0].bet.user_id}: ${(e as Error)?.message}`);
          }
          budget--;
        }
      }

      for (const d of queue.slice(0, Math.max(0, budget))) {
        try {
          // Match perfeito (jogo casado + mercado direto) → liquida sozinho e
          // avisa com [↩️ Corrigir]. Qualquer outra situação → pergunta.
          if (d.kind === "game" && d.verdict) {
            const settled = await autoSettle(supabase, d.bet, d.match!, d.verdict);
            if (settled) {
              sent++;
              await trackEvent(
                "bet_auto_settled",
                {
                  bet_id: d.bet.bet_id,
                  verdict: d.verdict,
                  betting_market: d.bet.betting_market,
                  sport: d.bet.sport,
                  league: d.bet.league,
                  match_source: d.match?.source ?? null,
                  match_id: d.match?.id ?? null,
                  digest: false,
                  channel: "telegram",
                },
                d.bet.user_id,
                traceId
              ).catch(() => {});
              continue;
            }
            // não liquidou (estado mudou no meio) → segue pro fluxo de pergunta
          }

          const text = d.kind === "game" ? buildMatchMessage(d.bet, d.match!, d.verdict) : buildGenericMessage(d.bet);
          await sendReminder(d.bet.chat_id, text, d.bet.bet_id);

          // marca cadência só depois de enviar (run que falha tenta de novo)
          const { error: updErr } = await supabase
            .from("bets")
            .update({
              settlement_reminder_count: d.bet.reminder_count + 1,
              settlement_reminder_at: new Date().toISOString(),
            })
            .eq("id", d.bet.bet_id);
          if (updErr) throw updErr;

          sent++;
          await trackEvent(
            "settlement_reminder_sent",
            {
              bet_id: d.bet.bet_id,
              kind: d.kind,
              verdict: d.verdict,
              betting_market: d.bet.betting_market,
              sport: d.bet.sport,
              league: d.bet.league,
              reminder_number: d.bet.reminder_count + 1,
              match_source: d.match?.source ?? null,
              match_id: d.match?.id ?? null,
              channel: "telegram",
            },
            d.bet.user_id,
            traceId
          ).catch(() => {});
        } catch (e) {
          console.error(`remind ${d.bet.bet_id}:`, (e as Error)?.message);
          errors.push(`${d.bet.bet_id}: ${(e as Error)?.message}`);
        }
      }
    }

    // telemetria (só runs com candidato chegam aqui — o vazio retorna cedo)
    await logMessageRun(supabase, "notify-settlement", { candidates: candidates.length, sent, errors, ok: true });

    return json({
      ok: true,
      candidates: candidates.length,
      finished_recent: finished.length,
      wc_finished: wcFinished.length,
      fixtures_finished: fxFinished.length,
      due: due.length,
      sent,
      generic_window_open: genericAllowed,
      errors,
    });
  } catch (e) {
    console.error("notify-settlement error:", e);
    await logMessageRun(supabase, "notify-settlement", { errors: [(e as Error)?.message ?? "erro"], ok: false });
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
