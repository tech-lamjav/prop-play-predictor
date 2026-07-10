// ============================================================
// notify-settlement — lembrete de liquidação com resultado preenchido
// ============================================================
// Job de cron (roda a cada 15 min; migration 078). Ataca o buraco da retenção:
// a maioria das apostas morre em 'pending' porque liquidar exige entrar no site.
// Aqui o Betinho manda DM no Telegram quando o jogo termina, com botões inline
// [✅ Green] [❌ Red] — 1 toque e a banca atualiza (handler no telegram-webhook).
//
// Duas classes de lembrete:
//   • COPA — aposta casada com um wc_matches encerrado (por nome dos dois times
//     na descrição). Quando o mercado é computável (ML/1x2, over-under de gols,
//     ambas marcam), o veredito sai pelo placar dos 90' (fulltime_*) e a aposta
//     é AUTO-LIQUIDADA (decisão de produto 09/07): grava won/lost + evidência
//     em processed_data.auto_settle e avisa com botão [↩️ Corrigir] (handler
//     fix:<bet_id> no telegram-webhook, que desfaz pra pendente). Sem veredito
//     computável, a mensagem chega com o placar e PERGUNTA com os botões.
//   • GENÉRICA — sem placar no banco: jogo já deve ter acabado (match_date
//     passou, ou aposta com 24h+), pergunta com os mesmos botões, sem veredito.
//     Respeita janela de silêncio (09h–23h BRT); a da Copa sai na hora do apito
//     (quem apostou no jogo está acordado assistindo).
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

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const BETS_URL = "https://www.smartbetting.app/bets";
const MAX_PER_USER_PER_RUN = 3;
const QUIET_START = 9; // genéricas só entre 09:00–22:59 BRT
const QUIET_END = 23;

// ── Telegram ─────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

// ── Normalização e casamento de times ────────────────────────
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas combinantes)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Nome em inglês (print de casa gringa) → nome PT usado em wc_matches.
// Chaves e valores já normalizados (sem acento, minúsculas).
const EN_ALIASES: Record<string, string> = {
  "brazil": "brasil",
  "france": "franca",
  "germany": "alemanha",
  "spain": "espanha",
  "netherlands": "holanda",
  "england": "inglaterra",
  "portugal": "portugal",
  "argentina": "argentina",
  "uruguay": "uruguai",
  "colombia": "colombia",
  "ecuador": "equador",
  "paraguay": "paraguai",
  "mexico": "mexico",
  "united states": "estados unidos",
  "usa": "estados unidos",
  "canada": "canada",
  "belgium": "belgica",
  "croatia": "croacia",
  "switzerland": "suica",
  "italy": "italia",
  "poland": "polonia",
  "austria": "austria",
  "denmark": "dinamarca",
  "norway": "noruega",
  "sweden": "suecia",
  "scotland": "escocia",
  "turkey": "turquia",
  "turkiye": "turquia",
  "morocco": "marrocos",
  "senegal": "senegal",
  "ghana": "gana",
  "egypt": "egito",
  "algeria": "argelia",
  "tunisia": "tunisia",
  "nigeria": "nigeria",
  "cameroon": "camaroes",
  "ivory coast": "costa do marfim",
  "cote d'ivoire": "costa do marfim",
  "south africa": "africa do sul",
  "japan": "japao",
  "south korea": "coreia do sul",
  "korea republic": "coreia do sul",
  "saudi arabia": "arabia saudita",
  "iran": "ira",
  "qatar": "catar",
  "jordan": "jordania",
  "uzbekistan": "uzbequistao",
  "australia": "australia",
  "new zealand": "nova zelandia",
  "panama": "panama",
  "costa rica": "costa rica",
  "haiti": "haiti",
  "curacao": "curacao",
  "cape verde": "cabo verde",
};

// true se ALGUM dos nomes aparece como palavra inteira no texto normalizado
function hasTeam(textNorm: string, names: string[]): boolean {
  return names.some((n) => {
    if (!n || n.length < 3) return false;
    return new RegExp(`(^|[^a-z])${escapeRegex(n)}([^a-z]|$)`).test(textNorm);
  });
}

// Variações reconhecíveis de um time de wc_matches (nome PT + aliases EN + código)
function teamNames(namePt: string, code: string): string[] {
  const base = norm(namePt);
  const names = [base, norm(code)];
  for (const [en, pt] of Object.entries(EN_ALIASES)) if (pt === base) names.push(en);
  return names;
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

interface Candidate {
  bet_id: string;
  user_id: string;
  chat_id: string;
  user_name: string | null;
  bet_type: string | null;
  sport: string | null;
  league: string | null;
  betting_market: string | null;
  match_description: string | null;
  bet_description: string | null;
  odds: number;
  stake_amount: number;
  potential_return: number;
  bet_date: string;
  match_date: string | null;
  reminder_count: number;
}

// ── Veredito pelo placar dos 90' ─────────────────────────────
// Só para mercados diretos; qualquer ambiguidade → null (pergunta sem afirmar).
// Handicap asiático (quick win do parecer do coletor) pode devolver void
// (push em linha inteira) e meio-resultados (linha quarter ±0.25/±0.75) —
// os status half_won/half_lost/void já existem no banco e no dashboard.
type Verdict = "won" | "lost" | "void" | "half_won" | "half_lost" | null;

// meia-aposta do handicap: ajustado >0 ganha, <0 perde, =0 devolve (push)
function settleAhHalf(adjusted: number): "won" | "lost" | "void" {
  if (adjusted > 0.001) return "won";
  if (adjusted < -0.001) return "lost";
  return "void";
}

// Handicap asiático pelos 90': margin = gols do time apostado − adversário;
// line = handicap NA ÓTICA do time apostado (como escrito na aposta).
// Linha quarter (x.25/x.75) decompõe em duas metades — padrão do mercado.
function settleAsianHandicap(margin: number, line: number): Verdict {
  const isQuarter = Math.abs((line * 4) % 2) === 1;
  if (!isQuarter) return settleAhHalf(margin + line);
  const a = settleAhHalf(margin + (line - 0.25));
  const b = settleAhHalf(margin + (line + 0.25));
  if (a === b) return a;                              // won+won / lost+lost
  if (a === "won" || b === "won") return "half_won";  // won + push
  return "half_lost";                                 // push + lost
}

function computeVerdict(bet: Candidate, wc: WcMatch): Verdict {
  // múltipla/sistema: pernas em jogos diversos, nunca decidível por 1 placar
  const type = norm(bet.bet_type);
  if (type === "multiple" || type === "system") return null;

  const ftH = wc.fulltime_home;
  const ftA = wc.fulltime_away;
  if (ftH == null || ftA == null) return null; // sem placar de 90' → sem veredito

  const desc = norm(bet.bet_description);
  const market = norm(bet.betting_market);

  // mercados fora do tempo normal / com regra própria → não arriscar
  if (
    /classific|avanc|qualif|prorrog|penalt|penalti|escanteio|cartao|cartoes|chute|finalizac|jogador|marca a qualquer|primeiro gol/.test(desc) ||
    /1[oº°]?\s*tempo|2[oº°]?\s*tempo|primeiro tempo|segundo tempo|intervalo|halftime|1st half|2nd half/.test(desc)
  ) {
    return null;
  }

  const total = ftH + ftA;

  // Over/Under de gols — "mais de 2,5", "over 2.5", "menos de 3"
  const over = desc.match(/(?:mais de|over|acima de)\s*(\d+(?:[.,]\d+)?)/);
  const under = desc.match(/(?:menos de|under|abaixo de)\s*(\d+(?:[.,]\d+)?)/);
  if (over || under) {
    // precisa ser de GOLS (explícito ou pelo mercado classificado)
    const isGoals = /gol/.test(desc) || market === "over/under";
    if (!isGoals) return null;
    const line = parseFloat((over ?? under)![1].replace(",", "."));
    if (Number.isNaN(line)) return null;
    if (total === line) return null; // linha exata = push/void → usuário decide
    if (over) return total > line ? "won" : "lost";
    return total < line ? "won" : "lost";
  }

  // Ambas marcam (BTTS) — "não" explícito vira aposta no NÃO; cuidado com o
  // "no" preposição do PT ("gols no jogo"): só conta como negativa em fim de
  // frase ou depois de dois-pontos ("Ambas marcam: No")
  if (market === "ambas marcam" || /ambas\s+(as\s+)?(equipes\s+)?marcam|btts|both teams to score/.test(desc)) {
    const both = ftH > 0 && ftA > 0;
    const betNo = /\bnao\b/.test(desc) || /:\s*no\b/.test(desc) || /\bno\s*$/.test(desc);
    return (betNo ? !both : both) ? "won" : "lost";
  }

  // linha com sinal ("−1,5", "-0.5", "+0,25") — presença dela indica handicap;
  // também desarma o ML (um "Vencedor: Belgium -1.5" não é money line puro)
  const lineMatch = desc.replace(/−/g, "-").match(/([+-])\s*(\d+(?:[.,]\d+)?)/);

  // Money Line / 1x2 — em qual time a aposta foi?
  if (!lineMatch && (market === "money line" || /\bml\b|money\s?line|vencedor|para vencer|vence\b|1x2/.test(desc))) {
    const homeNames = teamNames(wc.home_team, wc.home_team_code);
    const awayNames = teamNames(wc.away_team, wc.away_team_code);
    const isDraw = /empate/.test(desc);
    const pickedHome = hasTeam(desc, homeNames);
    const pickedAway = hasTeam(desc, awayNames);

    if (isDraw && !pickedHome && !pickedAway) return ftH === ftA ? "won" : "lost";
    if (pickedHome && !pickedAway) return ftH > ftA ? "won" : "lost";
    if (pickedAway && !pickedHome) return ftA > ftH ? "won" : "lost";
    return null; // ambíguo (dois times citados / nenhum) → não afirmar
  }

  // Handicap asiático — "Belgium −1,5", "Handicap -0.5 Atletico" (aritmética
  // dos 90' como os demais). Europeu ("empate (-1)") fica fora: regra diverge.
  if (lineMatch && !/empate/.test(desc)) {
    const raw = parseFloat(lineMatch[2].replace(",", "."));
    const line = (lineMatch[1] === "-" ? -1 : 1) * raw;
    // sanidade: linha múltipla de 0.25 e dentro do plausível
    if (!Number.isInteger(line * 4) || Math.abs(line) > 6) return null;

    const homeNames = teamNames(wc.home_team, wc.home_team_code);
    const awayNames = teamNames(wc.away_team, wc.away_team_code);
    const pickedHome = hasTeam(desc, homeNames);
    const pickedAway = hasTeam(desc, awayNames);
    if (pickedHome === pickedAway) return null; // nenhum ou os dois → ambíguo

    const margin = pickedHome ? ftH - ftA : ftA - ftH;
    return settleAsianHandicap(margin, line);
  }

  return null;
}

// ── Mensagens ────────────────────────────────────────────────
const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

function betLine(bet: Candidate): string {
  return (
    `Sua aposta: <b>${esc(bet.bet_description)}</b>\n` +
    `${money(bet.stake_amount)} · odd ${bet.odds} · retorno ${money(bet.potential_return)}`
  );
}

function buildWcMessage(bet: Candidate, wc: WcMatch, verdict: Verdict): string {
  // placar final (com prorrogação se houve) como contexto; 90' decide o veredito
  const wentExtra =
    wc.fulltime_home != null &&
    (wc.home_score !== wc.fulltime_home || wc.away_score !== wc.fulltime_away);
  const placar = `${esc(wc.home_team)} <b>${wc.home_score ?? "?"}×${wc.away_score ?? "?"}</b> ${esc(wc.away_team)}`;
  const extra = wentExtra ? ` <i>(${wc.fulltime_home}×${wc.fulltime_away} no tempo normal)</i>` : "";

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
function placarLine(wc: WcMatch): string {
  const wentExtra =
    wc.fulltime_home != null &&
    (wc.home_score !== wc.fulltime_home || wc.away_score !== wc.fulltime_away);
  const extra = wentExtra ? ` <i>(${wc.fulltime_home}×${wc.fulltime_away} no tempo normal)</i>` : "";
  return `🏁 ${esc(wc.home_team)} <b>${wc.home_score ?? "?"}×${wc.away_score ?? "?"}</b> ${esc(wc.away_team)} — encerrado${extra}`;
}

type SettleStatus = Exclude<Verdict, null>;

async function sendAutoSettleDm(bet: Candidate, wc: WcMatch, verdict: SettleStatus): Promise<void> {
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
    placarLine(wc),
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

// Liquida com guarda otimista (status='pending'); false = não liquidou (cai no
// fluxo de pergunta). Ordem deliberada: grava ANTES de avisar — o valor está
// na banca certa; a DM falhar não desfaz a liquidação.
async function autoSettle(supabase: any, bet: Candidate, wc: WcMatch, verdict: SettleStatus): Promise<boolean> {
  const evidence = `${wc.home_team} ${wc.fulltime_home}×${wc.fulltime_away} ${wc.away_team} (90') · wc_matches ${wc.id}`;
  const { data: cur } = await supabase.from("bets").select("processed_data").eq("id", bet.bet_id).maybeSingle();
  const pd = cur?.processed_data && typeof cur.processed_data === "object" && !Array.isArray(cur.processed_data)
    ? cur.processed_data : {};
  const { data: upd, error } = await supabase
    .from("bets")
    .update({
      status: verdict,
      processed_data: { ...pd, auto_settle: { evidence, settled_at: new Date().toISOString(), source: "auto_settlement_v1" } },
    })
    .eq("id", bet.bet_id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error || !upd) return false;
  await sendAutoSettleDm(bet, wc, verdict);
  return true;
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

    // 2) Jogos da Copa encerrados nas últimas 60h (janela do "acabou de acabar")
    const { data: wcData, error: wcErr } = await supabase
      .from("wc_matches")
      .select(
        "id, stage, home_team, away_team, home_team_code, away_team_code, match_date, match_time_brasilia, home_score, away_score, fulltime_home, fulltime_away, is_finished"
      )
      .eq("is_finished", true)
      .gte("match_date", new Date(Date.now() - 60 * 3600_000).toISOString().slice(0, 10));
    if (wcErr) throw wcErr;

    const now = Date.now();
    const wcRecent = (wcData ?? [])
      .map((m: WcMatch) => ({
        wc: m,
        kickoff: kickoffUtc(m).getTime(),
        homeNames: teamNames(m.home_team, m.home_team_code),
        awayNames: teamNames(m.away_team, m.away_team_code),
      }))
      .filter((e) => e.kickoff <= now && e.kickoff > now - 60 * 3600_000);

    // 3) Classifica cada candidata: casada com jogo da Copa (manda já) ou
    //    genérica (jogo passou + janela de silêncio)
    type Due = { bet: Candidate; kind: "wc" | "generic"; wc?: WcMatch; verdict: Verdict };
    const due: Due[] = [];
    const hour = brtHour();
    const genericAllowed = hour >= QUIET_START && hour < QUIET_END;

    for (const bet of candidates) {
      // múltipla/sistema tem pernas em vários jogos — o placar de UM jogo não a
      // representa; segue o caminho genérico (sem placar, sem veredito)
      const type = norm(bet.bet_type);
      const isMulti = type === "multiple" || type === "system";

      const text = norm(`${bet.match_description ?? ""} ${bet.bet_description ?? ""}`);
      const matched = isMulti
        ? undefined
        : wcRecent
            .filter((e) => hasTeam(text, e.homeNames) && hasTeam(text, e.awayNames))
            .sort((a, b) => b.kickoff - a.kickoff)[0];

      if (matched) {
        due.push({ bet, kind: "wc", wc: matched.wc, verdict: computeVerdict(bet, matched.wc) });
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
      list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "wc" ? -1 : 1));
      for (const d of list.slice(0, MAX_PER_USER_PER_RUN)) {
        try {
          // Match perfeito (jogo casado + mercado direto) → liquida sozinho e
          // avisa com [↩️ Corrigir]. Qualquer outra situação → pergunta.
          if (d.kind === "wc" && d.verdict) {
            const settled = await autoSettle(supabase, d.bet, d.wc!, d.verdict);
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
                  wc_match_id: d.wc?.id ?? null,
                  channel: "telegram",
                },
                d.bet.user_id,
                traceId
              ).catch(() => {});
              continue;
            }
            // não liquidou (estado mudou no meio) → segue pro fluxo de pergunta
          }

          const text = d.kind === "wc" ? buildWcMessage(d.bet, d.wc!, d.verdict) : buildGenericMessage(d.bet);
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
              wc_match_id: d.wc?.id ?? null,
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

    return json({
      ok: true,
      candidates: candidates.length,
      wc_finished_recent: wcRecent.length,
      due: due.length,
      sent,
      generic_window_open: genericAllowed,
      errors,
    });
  } catch (e) {
    console.error("notify-settlement error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
