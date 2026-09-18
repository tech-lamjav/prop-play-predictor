// ============================================================
// notify-weekly-summary — resumo semanal de desempenho (item 04, Marco 2)
// ============================================================
// Cron semanal (segunda 9h30 BRT — antes do daily das 10h; migrations 086/087).
// DM no Telegram (Betinho) com o desempenho dos ÚLTIMOS 7 DIAS (rolling).
// Recompensa recorrente → hábito.
//
// A RPC get_weekly_recap_candidates() faz o trabalho pesado (agregados por
// usuário elegível). A faixa e a copy vivem em ./tiers.ts (código puro,
// testado no CI — supabase/functions/tests/weekly.test.ts).
//
// Regras de produto (2026-07-15): rolling 7d · >=2 apostas liquidadas · lidera
// por RESULTADO+ROI (SEM taxa de acerto) · R$ sempre + unidades quando
// configurado · tom disciplina (LC 224) · CTA "Ver minha banca" rastreado +
// botão "Silenciar resumo" (opt-out na própria mensagem; /resumo reativa).
// Idempotência via users.weekly_summary_sent_at; opt-out via
// users.weekly_summary_muted. Mapa: MAPA_MENSAGENS_BOT.md #10.
//
// ?mode=report → não envia; devolve os candidatos + faixa (ensaio).
// Proteção: header `x-cron-secret` == env CRON_SECRET.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";
import { trackedUrl } from "../shared/links.ts";
import { logMessageRun } from "../shared/runs.ts";
import { getStreak, isStreakEnabled } from "../shared/streak.ts";
import { carregarBloqueados, enviarDm } from "../shared/telegram.ts";
import { buildMessage, pickTier, type WeeklyCandidate } from "./tiers.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const CAMPAIGN = "weekly_summary";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function sendSummary(
  supabase: any,
  userId: string,
  chatId: string,
  text: string,
  bankUrl: string,
): Promise<"enviada" | "bloqueada"> {
  const r = await enviarDm(supabase, userId, {
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
  });
  if (r.desfecho === "falhou") throw new Error(r.erro);
  return r.desfecho;
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
    const candidates: WeeklyCandidate[] = (data ?? []).map((r: any) => ({
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

    // item 18: sequência de disciplina (flag-gated; 1 flag-check por run)
    const streakOn = await isStreakEnabled(supabase);
    const rows = [];
    for (const c of candidates) {
      const roi = c.total_stake > 0 ? c.total_profit / c.total_stake : 0;
      const tier = pickTier(c.total_profit, roi, c.unit_value_rs);
      const streakDays = streakOn ? (await getStreak(supabase, c.user_id)).days : null;
      rows.push({ c, roi, tier, streakDays });
    }

    if (mode === "report") {
      return json({
        ok: true, mode, candidates: rows.length,
        preview: rows.map(({ c, roi, tier, streakDays }) => ({
          user: c.user_name, n: c.n_settled, tier,
          profit: Number(c.total_profit.toFixed(2)), roi: Number((roi * 100).toFixed(1)),
          has_unit: c.unit_value_rs != null, best_market: c.best_market,
          streak_days: streakDays,
          text: buildMessage(c, tier, roi, streakDays),
        })),
      });
    }

    // Quem bloqueou o bot: uma consulta por rodada, ANTES do laço. O resumo é
    // semanal e recorrente — é justamente o tipo de mensagem que fica tentando
    // para sempre e diluindo a taxa de clique de todo mundo (#466).
    const bloqueadosSet = await carregarBloqueados(supabase);

    let sent = 0;
    let bloqueados = 0;
    const errors: string[] = [];
    for (const { c, roi, tier, streakDays } of rows) {
      if (bloqueadosSet.has(c.user_id)) {
        bloqueados++;
        continue;
      }
      try {
        const text = buildMessage(c, tier, roi, streakDays);
        const bankUrl = await trackedUrl(c.user_id, "bank", CAMPAIGN);
        const desfecho = await sendSummary(supabase, c.user_id, c.chat_id, text, bankUrl);
        // Bloqueou agora (o 403 chegou nesta tentativa) → pula sem marcar envio:
        // gravar `weekly_summary_sent_at` contaria como entregue no funil.
        if (desfecho === "bloqueada") {
          bloqueados++;
          continue;
        }

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
            streak_days: streakDays,
            channel: "telegram",
          },
          c.user_id, traceId
        ).catch(() => {});
      } catch (e) {
        errors.push(`${c.user_id}: ${(e as Error)?.message}`);
      }
    }

    // telemetria — só runs de envio (mode=report é ensaio, não operação)
    await logMessageRun(supabase, "notify-weekly-summary", { candidates: rows.length, sent, errors, ok: true });

    return json({ ok: true, mode, candidates: rows.length, sent, bloqueados, errors });
  } catch (e) {
    console.error("notify-weekly-summary error:", e);
    if (mode === "send") {
      await logMessageRun(supabase, "notify-weekly-summary", { errors: [(e as Error)?.message ?? "erro"], ok: false });
    }
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});
