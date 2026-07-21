// ============================================================
// notify-weekly-summary — resumo semanal de desempenho (item 04, Marco 2)
// ============================================================
// Cron semanal (segunda 10h BRT; migration 086). DM no Telegram (Betinho) com o
// desempenho dos ÚLTIMOS 7 DIAS (rolling). Recompensa recorrente → hábito.
//
// A RPC get_weekly_recap_candidates() faz o trabalho pesado (agregados por
// usuário elegível: resultado/stake/melhor mercado/unidade). Aqui só escolhemos
// a FAIXA (positiva/neutra/negativa), formatamos e enviamos.
//
// Regras de produto (2026-07-15): rolling 7d · >=2 apostas liquidadas · lidera
// por RESULTADO+ROI (SEM taxa de acerto — acerto sozinho engana) · R$ sempre +
// unidades quando configurado · tom disciplina/controle (LC 224) · CTA único
// "Ver minha banca" (rastreado pelo `go`, campanha weekly_summary) · sem emoji
// em botão. Idempotência via users.weekly_summary_sent_at; opt-out via
// users.weekly_summary_muted. Entra no MAPA_MENSAGENS_BOT.md.
//
// ?mode=report → não envia; devolve os candidatos + faixa (ensaio).
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const BETS_URL = "https://www.smartbetting.app/bets";
const CAMPAIGN = "weekly_summary";

// thresholds da faixa: com unidade, em u; sem unidade, em ROI
const POS_U = 0.5, NEG_U = -1.0;
const POS_ROI = 0.05, NEG_ROI = -0.10;

type Tier = "positive" | "neutral" | "negative";

interface Candidate {
  user_id: string;
  chat_id: string;
  user_name: string | null;
  n_settled: number;
  total_stake: number;
  total_profit: number;
  unit_value_rs: number | null;
  best_market: string | null;
  best_market_profit: number | null;
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
const moneyAbs = (v: number) => `R$ ${Math.abs(v).toFixed(2).replace(".", ",")}`;
const unitAbs = (v: number) => `${Math.abs(v).toFixed(1).replace(".", ",")}u`;
const pctAbs = (v: number) => `${Math.abs(v * 100).toFixed(0)}%`;

function pickTier(profit: number, roi: number, unitRs: number | null): Tier {
  if (unitRs && unitRs > 0) {
    const u = profit / unitRs;
    if (u > POS_U) return "positive";
    if (u < NEG_U) return "negative";
    return "neutral";
  }
  if (roi > POS_ROI) return "positive";
  if (roi < NEG_ROI) return "negative";
  return "neutral";
}

function resultLine(c: Candidate, roi: number): string {
  const p = c.total_profit;
  const sg = sign(p);
  if (c.unit_value_rs && c.unit_value_rs > 0) {
    return `Resultado: <b>${sg}${unitAbs(p / c.unit_value_rs)}</b> (${sg}${moneyAbs(p)}) · ROI <b>${sg}${pctAbs(roi)}</b>`;
  }
  return `Resultado: <b>${sg}${moneyAbs(p)}</b> · ROI <b>${sg}${pctAbs(roi)}</b>`;
}

function buildMessage(c: Candidate, tier: Tier, roi: number): string {
  const head = `📊 <b>Seus últimos 7 dias</b>`;
  const mkt = c.best_market ? ` · melhor mercado: <b>${esc(c.best_market)}</b>` : "";
  const vol = `${c.n_settled} apostas liquidadas`;

  if (tier === "positive") {
    return [
      head,
      resultLine(c, roi),
      `${vol}${mkt}`,
      "",
      `Fechou no positivo. O que importa agora é entender <b>o que sustentou isso</b> — quais mercados e stakes puxaram o resultado — pra repetir com consistência, não por sorte.`,
    ].join("\n");
  }
  if (tier === "neutral") {
    return [
      head,
      resultLine(c, roi),
      `${vol}${mkt}`,
      "",
      `Variação controlada — nem lucro nem prejuízo relevante. Bom momento pra <b>afinar</b>: onde você foi eficiente e onde deixou valor na mesa.`,
    ].join("\n");
  }
  // negative — sem destacar "melhor mercado"; foco em processo e proteção
  return [
    head,
    resultLine(c, roi),
    vol,
    "",
    `Semana negativa faz parte — o que separa quem evolui é o <b>processo</b>, não o placar de 7 dias. Antes da próxima sequência, vale revisar <b>stake, volume e escolha de mercado</b> com calma. Sem correr atrás do prejuízo.`,
  ].join("\n");
}

// link rastreado: /functions/v1/go?u=&d=&s=&c=weekly_summary (HMAC sobre u:d)
async function trackedUrl(userId: string, dest: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(CRON_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${userId}:${dest}`));
  const s = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  return `${SUPABASE_URL}/functions/v1/go?u=${userId}&d=${dest}&s=${s}&c=${CAMPAIGN}`;
}

async function sendSummary(chatId: string, text: string, bankUrl: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      // opt-out visível na própria mensagem (regra: recorrente carrega a própria
      // saída). Callback `mutew` no telegram-webhook grava weekly_summary_muted.
      reply_markup: {
        inline_keyboard: [
          [{ text: "Ver minha banca", url: bankUrl }],
          [{ text: "Silenciar resumo", callback_data: "mutew" }],
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`telegram ${res.status}: ${await res.text()}`);
}

serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Unauthorized" }, 401);
  const mode = new URL(req.url).searchParams.get("mode") || "send";
  if (mode === "send" && !TELEGRAM_BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);

  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
  const traceId = generateTraceId();

  try {
    const { data, error } = await supabase.rpc("get_weekly_recap_candidates");
    if (error) throw error;
    const candidates: Candidate[] = (data ?? []).map((r: any) => ({
      user_id: r.user_id,
      chat_id: r.chat_id,
      user_name: r.user_name,
      n_settled: Number(r.n_settled),
      total_stake: Number(r.total_stake),
      total_profit: Number(r.total_profit),
      unit_value_rs: r.unit_value_rs == null ? null : Number(r.unit_value_rs),
      best_market: r.best_market,
      best_market_profit: r.best_market_profit == null ? null : Number(r.best_market_profit),
    }));

    const rows = candidates.map((c) => {
      const roi = c.total_stake > 0 ? c.total_profit / c.total_stake : 0;
      const tier = pickTier(c.total_profit, roi, c.unit_value_rs);
      return { c, roi, tier };
    });

    if (mode === "report") {
      return json({
        ok: true, mode, candidates: rows.length,
        preview: rows.map(({ c, roi, tier }) => ({
          user: c.user_name, n: c.n_settled, tier,
          profit: Number(c.total_profit.toFixed(2)), roi: Number((roi * 100).toFixed(1)),
          has_unit: c.unit_value_rs != null, best_market: c.best_market,
          text: buildMessage(c, tier, roi),
        })),
      });
    }

    let sent = 0;
    const errors: string[] = [];
    for (const { c, roi, tier } of rows) {
      try {
        const text = buildMessage(c, tier, roi);
        const bankUrl = await trackedUrl(c.user_id, "bank");
        await sendSummary(c.chat_id, text, bankUrl);

        // marca envio só depois de mandar (run que falha tenta de novo na próxima)
        const { error: upErr } = await supabase
          .from("users")
          .update({ weekly_summary_sent_at: new Date().toISOString() })
          .eq("id", c.user_id);
        if (upErr) throw upErr;

        sent++;
        await trackEvent(
          "weekly_summary_sent",
          {
            tier,
            result_bucket: tier,
            has_unit: c.unit_value_rs != null,
            volume: c.n_settled,
            roi_pct: Number((roi * 100).toFixed(1)),
            channel: "telegram",
          },
          c.user_id, traceId
        ).catch(() => {});
      } catch (e) {
        errors.push(`${c.user_id}: ${(e as Error)?.message}`);
      }
    }

    return json({ ok: true, mode, candidates: rows.length, sent, errors });
  } catch (e) {
    console.error("notify-weekly-summary error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
