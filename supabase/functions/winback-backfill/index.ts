// ============================================================
// winback-backfill — fecha o histórico antigo e reconquista quem sumiu (R1)
// ============================================================
// One-shot MANUAL (sem cron!). O dev roda 3 vezes, verificando entre cada uma:
//
//   1. ?mode=report   → NÃO escreve nada. Devolve o relatório: o que seria
//                       liquidado, com veredito + evidência, e o que foi pulado
//                       (e por quê). Revisar antes de seguir.
//   2. ?mode=execute  → liquida as apostas aprovadas no report (won/lost),
//                       gravando a evidência em processed_data.winback.
//                       Idempotente: só toca aposta ainda 'pending'.
//   3. ?mode=notify   → manda a DM única ("atualizamos seu histórico — seu ROI
//                       real está pronto") pra cada usuário afetado com Telegram.
//                       Idempotente via tabela winback_notifications.
//
// Filosofia: o LLM ESTRUTURA a aposta (jogador/stat/linha ou times/mercado —
// as descrições reais têm apelido, typo e abreviação: "wemby over 27,5 pts"),
// mas quem DECIDE o veredito é código puro contra dado verificável:
//   • NBA (singles): nba_mart.ft_game_player_stats (stat realizada vs linha)
//   • Futebol (singles): placar dos 90' via API-Sports histórico (fixtures?date=)
// Qualquer ambiguidade (múltipla, combo, "fg geral" sem stat no mart, jogador
// não encontrado, jogo não casado, push) → skip com motivo. Sem chute.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET (mesmo padrão dos crons).
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN,
//                 OPENAI_API_KEY, API_SPORTS_KEY, CRON_SECRET.
// Runbook: WINBACK_BACKFILL_SETUP.md
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const API_SPORTS_KEY = Deno.env.get("API_SPORTS_KEY") || "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const BETS_URL = "https://www.smartbetting.app/bets";

// Backlog alvo: pendentes com 7+ dias, até 1 ano (mais velho que isso não fecha)
const MIN_AGE_DAYS = 7;
const MAX_AGE_DAYS = 365;

// ── util ─────────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
const money = (v: number) => `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── tipos ────────────────────────────────────────────────────
interface OldBet {
  id: string;
  user_id: string;
  sport: string | null;
  league: string | null;
  bet_type: string;
  betting_market: string | null;
  match_description: string | null;
  bet_description: string;
  odds: number;
  stake_amount: number;
  potential_return: number;
  bet_date: string;
  match_date: string | null;
  processed_data: Record<string, unknown> | null;
}

// O que o LLM devolve por aposta (estrutura, nunca veredito)
interface ParsedBet {
  bet_id: string;
  kind: "nba_prop" | "football_single" | "combo_or_multi" | "unparseable";
  // nba_prop:
  player_full_name: string | null;
  stat_key: string | null; // chave do nba_mart (player_points, player_rebounds...)
  line: number | null;
  direction: "over" | "under" | null;
  period: "full_game" | "partial" | null;
  // football_single:
  home_team: string | null;
  away_team: string | null;
  market: "ml_home" | "ml_away" | "ml_draw" | "over_goals" | "under_goals" | "btts_yes" | "btts_no" | "other" | null;
  goals_line: number | null;
}

interface Decision {
  bet_id: string;
  bet_description: string;
  user_id: string;
  action: "settle" | "skip";
  verdict?: "won" | "lost";
  evidence?: string;      // humano-legível: "Jokic fez 31 pts em 12/04 (linha 25.5 over)"
  skip_reason?: string;
}

// ── 1. LLM: estrutura o lote de descrições (uma chamada) ─────
const PARSE_SCHEMA = {
  type: "object",
  properties: {
    bets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          bet_id: { type: "string" },
          kind: { type: "string", enum: ["nba_prop", "football_single", "combo_or_multi", "unparseable"] },
          player_full_name: { type: ["string", "null"] },
          stat_key: {
            type: ["string", "null"],
            enum: [
              "player_points", "player_rebounds", "player_assists", "player_threes",
              "player_blocks", "player_steals", "player_turnovers",
              "player_points_rebounds_assists", "player_points_assists",
              "player_points_rebounds", "player_rebounds_assists",
              "player_blocks_steals", "player_double_double", "player_triple_double",
              null,
            ],
          },
          line: { type: ["number", "null"] },
          direction: { type: ["string", "null"], enum: ["over", "under", null] },
          period: { type: ["string", "null"], enum: ["full_game", "partial", null] },
          home_team: { type: ["string", "null"] },
          away_team: { type: ["string", "null"] },
          market: {
            type: ["string", "null"],
            enum: ["ml_home", "ml_away", "ml_draw", "over_goals", "under_goals", "btts_yes", "btts_no", "other", null],
          },
          goals_line: { type: ["number", "null"] },
        },
        required: [
          "bet_id", "kind", "player_full_name", "stat_key", "line", "direction",
          "period", "home_team", "away_team", "market", "goals_line",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["bets"],
  additionalProperties: false,
};

async function parseBetsWithLLM(bets: OldBet[]): Promise<Map<string, ParsedBet>> {
  const items = bets.map((b) => ({
    bet_id: b.id,
    sport: b.sport,
    description: b.bet_description,
    match: b.match_description,
  }));

  const prompt = `Você estrutura descrições de apostas esportivas registradas por usuários (podem ter apelidos, typos e abreviações). NÃO decida se a aposta ganhou — apenas estruture.

Para cada item, classifique kind:
- "nba_prop": UMA prop de UM jogador da NBA (ex: "wemby over 27,5 pts" → Victor Wembanyama, player_points, 27.5, over). Resolva apelidos para o NOME COMPLETO oficial do jogador ("jb"→"Jaylen Brown", "wemby"→"Victor Wembanyama", "fox"→"De'Aaron Fox", "maxey"→"Tyrese Maxey", "tatum"→"Jayson Tatum"). "N+ pontos" = over com line N-0.5. Props de quarto/tempo parcial ("q1", "1st half"): period="partial". Stats SEM chave disponível (field goals, minutos, %): kind="unparseable".
- "football_single": UMA aposta simples de futebol com os DOIS times identificáveis. Expanda abreviações e apelidos de clube para o nome oficial internacional ("PSG"→"Paris Saint Germain", "City"→"Manchester City", "Atleti"→"Atletico Madrid", "Barça"→"Barcelona", "Fla"→"Flamengo"). market: ml_home/ml_away/ml_draw (vencedor no tempo normal), over_goals/under_goals (com goals_line), btts_yes/btts_no. Handicap, escanteios, cartões, gols de jogador, 1º tempo, "para se classificar": market="other".
- "combo_or_multi": mais de uma seleção na mesma descrição (ex: "20 pts tatum e 20 pts brown").
- "unparseable": não dá pra estruturar com confiança.

Campos que não se aplicam: null. Linhas com vírgula decimal ("27,5") → number 27.5.

ITENS:
${JSON.stringify(items)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "parsed_bets", strict: true, schema: PARSE_SCHEMA },
      },
      temperature: 0,
      max_tokens: 8000,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const out = await res.json();
  const parsed = JSON.parse(out.choices[0].message.content) as { bets: ParsedBet[] };
  return new Map(parsed.bets.map((p) => [p.bet_id, p]));
}

// ── 2. NBA: veredito contra o nba_mart ───────────────────────
async function decideNba(supabase: any, bet: OldBet, p: ParsedBet): Promise<Decision> {
  const base = { bet_id: bet.id, bet_description: bet.bet_description, user_id: bet.user_id };
  if (p.period === "partial") return { ...base, action: "skip", skip_reason: "prop de tempo parcial (q1/half) — sem dado no mart v1" };
  if (!p.player_full_name || !p.stat_key || p.line == null || !p.direction) {
    return { ...base, action: "skip", skip_reason: "estrutura incompleta (jogador/stat/linha)" };
  }

  // jogador: match por nome via RPC (nba_mart é trancado pra acesso direto — 056)
  const lastName = p.player_full_name.split(" ").pop()!;
  const { data: players, error: pErr } = await supabase.rpc("winback_find_nba_player", { p_name_part: lastName });
  if (pErr) return { ...base, action: "skip", skip_reason: `winback_find_nba_player: ${pErr.message}` };
  const target = norm(p.player_full_name);
  let player = (players ?? []).find((x: any) => norm(x.player_name) === target) ?? null;
  if (!player) {
    const cands = (players ?? []).filter((x: any) => norm(x.player_name).includes(norm(lastName)));
    if (cands.length === 1) player = cands[0]; // sobrenome único no mart → seguro
  }
  if (!player) return { ...base, action: "skip", skip_reason: `jogador não encontrado no mart: ${p.player_full_name}` };

  // jogo: a stat realizada mais próxima da data da aposta (janela -1..+2 dias)
  const betDate = bet.bet_date.slice(0, 10);
  const { data: stats, error: sErr } = await supabase.rpc("winback_nba_stat_window", {
    p_player_id: player.player_id,
    p_stat_type: p.stat_key,
    p_from: new Date(new Date(betDate).getTime() - 86400_000).toISOString().slice(0, 10),
    p_to: new Date(new Date(betDate).getTime() + 2 * 86400_000).toISOString().slice(0, 10),
  });
  if (sErr) return { ...base, action: "skip", skip_reason: `winback_nba_stat_window: ${sErr.message}` };
  if (!stats?.length) return { ...base, action: "skip", skip_reason: "nenhum jogo do jogador na janela da aposta" };
  if (stats.length > 1) return { ...base, action: "skip", skip_reason: `ambíguo: ${stats.length} jogos na janela` };

  const s = stats[0];
  if (s.is_played === "false" || s.stat_value == null) {
    return { ...base, action: "skip", skip_reason: "jogador não jogou (provável void — resolver manual)" };
  }
  if (s.stat_value === p.line) return { ...base, action: "skip", skip_reason: `push: stat ${s.stat_value} == linha ${p.line}` };

  const won = p.direction === "over" ? s.stat_value > p.line : s.stat_value < p.line;
  return {
    ...base,
    action: "settle",
    verdict: won ? "won" : "lost",
    evidence: `${player.player_name}: ${s.stat_value} (${p.stat_key.replace("player_", "")}) em ${s.game_date} · linha ${p.direction} ${p.line} · fonte nba_mart`,
  };
}

// ── 3. Futebol: veredito via placar histórico da API-Sports ──
// Cache por data: 1 chamada fixtures?date=D cobre TODOS os jogos do dia.
const fixturesByDate = new Map<string, any[]>();
let apiCalls = 0;

async function fixturesOn(date: string): Promise<any[]> {
  if (fixturesByDate.has(date)) return fixturesByDate.get(date)!;
  const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}&status=FT-AET-PEN`, {
    headers: { "x-apisports-key": API_SPORTS_KEY },
  });
  apiCalls++;
  if (!res.ok) throw new Error(`API-Sports ${res.status}`);
  const payload = await res.json();
  const list = payload?.response ?? [];
  fixturesByDate.set(date, list);
  return list;
}

// os dois nomes casam? (contém/contido, normalizado — "Atletico de Madrid" ~ "Atletico Madrid")
function teamMatches(ours: string, api: string): boolean {
  const a = norm(ours), b = norm(api);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

async function decideFootball(bet: OldBet, p: ParsedBet): Promise<Decision> {
  const base = { bet_id: bet.id, bet_description: bet.bet_description, user_id: bet.user_id };
  if (!p.home_team || !p.away_team) return { ...base, action: "skip", skip_reason: "times não identificados" };
  if (!p.market || p.market === "other") return { ...base, action: "skip", skip_reason: "mercado fora do v1 (handicap/escanteio/1ºT/etc)" };

  // procura o jogo: dia da aposta e os 2 seguintes (aposta pré-jogo)
  const betDate = new Date(bet.bet_date);
  let fx: any = null;
  let when = "";
  for (const offset of [0, 1, 2]) {
    const d = new Date(betDate.getTime() + offset * 86400_000).toISOString().slice(0, 10);
    const candidates = (await fixturesOn(d)).filter((f: any) => {
      const h = f?.teams?.home?.name ?? "", a = f?.teams?.away?.name ?? "";
      return (teamMatches(p.home_team!, h) && teamMatches(p.away_team!, a)) ||
             (teamMatches(p.home_team!, a) && teamMatches(p.away_team!, h));
    });
    if (candidates.length === 1) { fx = candidates[0]; when = d; break; }
    if (candidates.length > 1) return { ...base, action: "skip", skip_reason: `ambíguo: ${candidates.length} jogos ${p.home_team} x ${p.away_team} em ${d}` };
  }
  if (!fx) return { ...base, action: "skip", skip_reason: `jogo não encontrado (${p.home_team} x ${p.away_team}, ~${bet.bet_date.slice(0, 10)})` };

  // placar dos 90' (mercados liquidam no tempo normal)
  const ftH = fx?.score?.fulltime?.home;
  const ftA = fx?.score?.fulltime?.away;
  if (ftH == null || ftA == null) return { ...base, action: "skip", skip_reason: "sem placar de 90' no fixture" };

  // orienta o placar pros NOSSOS home/away (a ordem da API pode diferir)
  const apiHomeIsOurs = teamMatches(p.home_team, fx.teams.home.name);
  const ourH = apiHomeIsOurs ? ftH : ftA;
  const ourA = apiHomeIsOurs ? ftA : ftH;
  const total = ftH + ftA;

  let won: boolean | null = null;
  switch (p.market) {
    case "ml_home": won = ourH > ourA; break;
    case "ml_away": won = ourA > ourH; break;
    case "ml_draw": won = ourH === ourA; break;
    case "btts_yes": won = ftH > 0 && ftA > 0; break;
    case "btts_no": won = !(ftH > 0 && ftA > 0); break;
    case "over_goals":
      if (p.goals_line == null) return { ...base, action: "skip", skip_reason: "linha de gols ausente" };
      if (total === p.goals_line) return { ...base, action: "skip", skip_reason: "push na linha exata" };
      won = total > p.goals_line; break;
    case "under_goals":
      if (p.goals_line == null) return { ...base, action: "skip", skip_reason: "linha de gols ausente" };
      if (total === p.goals_line) return { ...base, action: "skip", skip_reason: "push na linha exata" };
      won = total < p.goals_line; break;
  }
  if (won == null) return { ...base, action: "skip", skip_reason: "mercado não decidível" };

  return {
    ...base,
    action: "settle",
    verdict: won ? "won" : "lost",
    evidence: `${fx.teams.home.name} ${ftH}×${ftA} ${fx.teams.away.name} (90') em ${when} · ${p.market}${p.goals_line != null ? ` ${p.goals_line}` : ""} · fonte API-Sports fixture ${fx.fixture?.id}`,
  };
}

// ── pipeline: report/execute compartilham a mesma decisão ────
async function buildDecisions(supabase: any): Promise<{ decisions: Decision[]; totals: Record<string, number> }> {
  const { data: betsData, error } = await supabase
    .from("bets")
    .select("id, user_id, sport, league, bet_type, betting_market, match_description, bet_description, odds, stake_amount, potential_return, bet_date, match_date, processed_data")
    .eq("status", "pending")
    .lt("bet_date", new Date(Date.now() - MIN_AGE_DAYS * 86400_000).toISOString())
    .gt("bet_date", new Date(Date.now() - MAX_AGE_DAYS * 86400_000).toISOString())
    .order("bet_date", { ascending: false });
  if (error) throw error;
  const all: OldBet[] = betsData ?? [];

  const decisions: Decision[] = [];
  // esporte por nome normalizado: registros antigos têm "NBA" (em vez de
  // "Basquete") e até vazio — o kind final quem decide é o LLM, então o filtro
  // só corta o que certamente não é NBA/futebol
  const PARSE_SPORTS = new Set(["basquete", "futebol", "nba", ""]);
  const singles = all.filter((b) => b.bet_type === "single" && PARSE_SPORTS.has(norm(b.sport ?? "")));
  for (const b of all) {
    if (!singles.includes(b)) {
      decisions.push({
        bet_id: b.id, bet_description: b.bet_description, user_id: b.user_id,
        action: "skip",
        skip_reason: b.bet_type !== "single" ? "múltipla/sistema — não fechável por 1 placar" : `esporte fora do v1 (${b.sport || "?"})`,
      });
    }
  }

  if (singles.length > 0) {
    const parsed = await parseBetsWithLLM(singles);
    for (const b of singles) {
      const p = parsed.get(b.id);
      if (!p) {
        decisions.push({ bet_id: b.id, bet_description: b.bet_description, user_id: b.user_id, action: "skip", skip_reason: "LLM não retornou estrutura" });
        continue;
      }
      if (p.kind === "combo_or_multi") {
        decisions.push({ bet_id: b.id, bet_description: b.bet_description, user_id: b.user_id, action: "skip", skip_reason: "combo de várias seleções na descrição" });
      } else if (p.kind === "unparseable") {
        decisions.push({ bet_id: b.id, bet_description: b.bet_description, user_id: b.user_id, action: "skip", skip_reason: "descrição não estruturável com confiança" });
      } else if (p.kind === "nba_prop") {
        decisions.push(await decideNba(supabase, b, p));
      } else {
        decisions.push(await decideFootball(b, p));
      }
    }
  }

  const totals = {
    backlog: all.length,
    liquidaveis: decisions.filter((d) => d.action === "settle").length,
    greens: decisions.filter((d) => d.verdict === "won").length,
    reds: decisions.filter((d) => d.verdict === "lost").length,
    pulados: decisions.filter((d) => d.action === "skip").length,
    chamadas_api_sports: apiCalls,
  };
  return { decisions, totals };
}

// ── notify: a DM única de reconquista ────────────────────────
async function sendWinbackDm(chatId: string, name: string | null, settled: number, greens: number, profit: number, roi: number, leftovers: number): Promise<void> {
  const roiTxt = `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;
  const profitTxt = `${profit >= 0 ? "+" : "−"}${money(Math.abs(profit))}`;
  const lines = [
    `📋 <b>${esc(name || "E aí")}, a gente atualizou seu histórico.</b>`,
    "",
    `Fechamos <b>${settled} aposta${settled === 1 ? "" : "s"}</b> antiga${settled === 1 ? "" : "s"} que estava${settled === 1 ? "" : "m"} pendente${settled === 1 ? "" : "s"} (${greens} green${greens === 1 ? "" : "s"}) — com o placar/estatística real de cada jogo.`,
    "",
    `Seu resultado real no período: <b>${profitTxt}</b> · ROI <b>${roiTxt}</b>`,
  ];
  if (leftovers > 0) {
    lines.push("", `Ficaram ${leftovers} que não conseguimos confirmar — dá pra resolver em segundos no painel.`);
  }
  lines.push("", `Qualquer aposta que a gente tenha fechado errado, é só corrigir por lá.`);

  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "📊 Ver meu histórico completo", url: BETS_URL }]] },
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) return json({ error: "Unauthorized" }, 401);

  const mode = new URL(req.url).searchParams.get("mode") || "report";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
  const traceId = generateTraceId();

  try {
    // ── REPORT / EXECUTE ─────────────────────────────────────
    if (mode === "report" || mode === "execute") {
      if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY not set" }, 500);
      if (!API_SPORTS_KEY) return json({ error: "API_SPORTS_KEY not set" }, 500);

      const { decisions, totals } = await buildDecisions(supabase);

      if (mode === "report") {
        return json({
          ok: true, mode, totals,
          liquidaveis: decisions.filter((d) => d.action === "settle"),
          pulados: decisions.filter((d) => d.action === "skip"),
        });
      }

      // execute: aplica os settles (guarda otimista em status=pending)
      let settled = 0;
      const errors: string[] = [];
      const settledBets: { user_id: string | null; created_at: string | null; channel: string | null; verdict: string }[] = [];
      for (const d of decisions) {
        if (d.action !== "settle") continue;
        const { data: bet } = await supabase.from("bets").select("processed_data, user_id, created_at, channel").eq("id", d.bet_id).maybeSingle();
        // processed_data pode não ser objeto em registros antigos — não espalhar string
        const pd = bet?.processed_data && typeof bet.processed_data === "object" && !Array.isArray(bet.processed_data)
          ? bet.processed_data : {};
        const { error: updErr, data: upd } = await supabase
          .from("bets")
          .update({
            status: d.verdict,
            processed_data: {
              ...pd,
              winback: { evidence: d.evidence, settled_at: new Date().toISOString(), source: "winback_backfill_v1" },
            },
          })
          .eq("id", d.bet_id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (updErr) { errors.push(`${d.bet_id}: ${updErr.message}`); continue; }
        if (upd) {
          settled++;
          settledBets.push({
            user_id: bet?.user_id ?? null,
            created_at: bet?.created_at ?? null,
            channel: bet?.channel ?? null,
            verdict: d.verdict,
          });
        }
      }

      // bet_settled por aposta (settled_by:'auto') — sem isso o lote do winback fica invisível
      // pra métrica central no PostHog (o agregado abaixo não conta por usuário nem por aposta).
      for (const s of settledBets) {
        await trackEvent(
          "bet_settled",
          {
            product: "betinho",
            channel: s.channel,
            status: s.verdict,
            days_to_settle: s.created_at
              ? Math.round((Date.now() - new Date(s.created_at).getTime()) / 86400000)
              : null,
            settled_by: "auto",
            via: "winback_backfill",
            batch: true,
            count: settledBets.length,
          },
          s.user_id ?? "system",
          traceId
        ).catch(() => {});
      }

      await trackEvent("winback_backfill_executed", { ...totals, settled }, "system", traceId).catch(() => {});
      return json({ ok: true, mode, totals, settled, errors });
    }

    // ── NOTIFY ───────────────────────────────────────────────
    if (mode === "notify") {
      if (!TELEGRAM_BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

      // usuários com apostas fechadas pelo winback e ainda não avisados
      const { data: rows, error } = await supabase.rpc("get_winback_notify_targets");
      if (error) throw error;

      let sent = 0;
      const errors: string[] = [];
      for (const r of rows ?? []) {
        try {
          await sendWinbackDm(r.chat_id, r.user_name, Number(r.settled), Number(r.greens), Number(r.profit), Number(r.roi), Number(r.leftovers));
          const { error: insErr } = await supabase
            .from("winback_notifications")
            .insert({ user_id: r.user_id, bets_settled: r.settled, roi: r.roi });
          if (insErr) throw insErr;
          sent++;
          await trackEvent(
            "winback_dm_sent",
            { bets_settled: r.settled, greens: r.greens, roi: r.roi, leftovers: r.leftovers, channel: "telegram" },
            r.user_id, traceId
          ).catch(() => {});
        } catch (e) {
          errors.push(`${r.user_id}: ${(e as Error)?.message}`);
        }
      }
      return json({ ok: true, mode, alvo: (rows ?? []).length, sent, errors });
    }

    return json({ error: `mode inválido: ${mode} (use report|execute|notify)` }, 400);
  } catch (e) {
    console.error("winback-backfill error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
