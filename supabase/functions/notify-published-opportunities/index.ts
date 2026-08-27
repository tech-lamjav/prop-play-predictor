// ============================================================
// notify-published-opportunities — alerta quando uma Oportunidade entra no painel
// ============================================================
// O daily de oportunidades continua sendo o resumo editorial das 10h. Esta
// função observa o mesmo board do produto e avisa somente a PRIMEIRA publicação
// de cada Oportunidade. O primeiro run em cada ambiente só cria a linha de base
// para não notificar o que já estava publicado antes do lançamento.
//
// ?mode=report não grava nem envia; serve para validar o próximo lote.
// Proteção: header x-cron-secret == CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { trackedUrl } from "../shared/links.ts";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";
import { logMessageRun } from "../shared/runs.ts";
import { planPublicationBatch, type PublicationBoardRow } from "./planner.ts";
import {
  type PublishedMessageOpportunity,
  publishedMessageText,
  publishedPickLabel,
} from "./message.ts";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const CAMPAIGN = "published_opportunities";

interface BoardRow extends PublicationBoardRow {
  home_team_name: string;
  away_team_name: string;
  competition: string;
  status_short: string;
  best_odd: number;
  faixa: string;
  janela_usada: string | null;
  edge: number | null;
  prob_justa_fechamento: number | null;
  evidencias: string[] | null;
}

interface Recipient {
  user_id: string;
  chat_id: string;
  user_name: string | null;
}

interface ClaimedAlert {
  batch_id: string;
  alert_id: string;
  opportunity_key: string;
}

type DeliveryOpportunity = PublishedMessageOpportunity;

interface Delivery {
  batch_id: string;
  user_id: string;
  chat_id: string;
  attempt_id: string;
  opportunities: DeliveryOpportunity[];
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function kickoffDate(value: string): Date {
  return new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
}

function marketPt(market: string): string {
  if (market === "match_winner") return "Money Line";
  if (market === "goals_over_under") return "Over/Under";
  if (market === "asian_handicap") return "Handicap";
  if (market === "btts") return "Ambas marcam";
  if (market === "double_chance") return "Dupla chance";
  return market;
}

async function buildMessage(
  opportunities: DeliveryOpportunity[],
  userId: string,
): Promise<string> {
  const urls = new Map<string, string>();
  for (const opportunity of opportunities) {
    urls.set(
      opportunity.alert_id,
      await trackedUrl(userId, opportunityDestination(opportunity), CAMPAIGN),
    );
  }
  return publishedMessageText(opportunities, urls);
}

function opportunityDestination(opportunity: DeliveryOpportunity): string {
  return [
    `jogo-${opportunity.fixture_id}`,
    opportunity.market,
    opportunity.outcome,
    opportunity.line_value == null ? "" : String(opportunity.line_value),
  ].join("|");
}

function registerButtons(
  opportunities: DeliveryOpportunity[],
  pickByAlertId: Map<string, string>,
): unknown[][] {
  return [...opportunities]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .flatMap((opportunity) => {
      const pickId = pickByAlertId.get(opportunity.alert_id);
      if (!pickId) return [];
      const label = publishedPickLabel(opportunity);
      return [[{
        text: `📋 Registrar: ${
          label.length > 34 ? `${label.slice(0, 33)}…` : label
        }`,
        callback_data: `regpub:${pickId}`,
      }]];
    });
}

async function sendTelegram(
  chatId: string,
  text: string,
  cta: { label: string; url: string },
  registerRows: unknown[][],
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [...registerRows, [{
            text: cta.label,
            url: cta.url,
          }]],
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`telegram ${response.status}: ${await response.text()}`);
  }
}

function payload(row: BoardRow & { key: string }) {
  return {
    opportunity_key: row.key,
    fixture_id: row.fixture_id,
    home_team_name: row.home_team_name,
    away_team_name: row.away_team_name,
    competition: row.competition,
    kickoff_utc: kickoffDate(row.kickoff_utc).toISOString(),
    market: row.market,
    outcome: row.outcome,
    line_value: row.line_value,
    best_odd: row.best_odd,
    score: row.score,
    faixa: row.faixa,
    janela_usada: row.janela_usada,
    edge: row.edge,
    prob_justa_fechamento: row.prob_justa_fechamento,
    evidencias: row.evidencias ?? [],
  };
}

async function persistRegistrationPicks(
  supabase: any,
  claimed: ClaimedAlert[],
  byKey: Map<string, BoardRow & { key: string }>,
): Promise<void> {
  const rows = claimed.map((claim) => {
    const row = byKey.get(claim.opportunity_key);
    if (!row) {
      throw new Error(`alerta sem oportunidade: ${claim.opportunity_key}`);
    }
    const asDelivery: DeliveryOpportunity = {
      ...row,
      alert_id: claim.alert_id,
    };
    return {
      fixture_id: row.fixture_id,
      sport: "Futebol",
      league: row.competition,
      betting_market: marketPt(row.market),
      match_description: `${row.home_team_name} × ${row.away_team_name}`,
      bet_description: publishedPickLabel(asDelivery),
      odds: row.best_odd,
      match_date: kickoffDate(row.kickoff_utc).toISOString(),
      market: row.market,
      outcome: row.outcome,
      line_value: row.line_value,
      janela_usada: row.janela_usada,
      score: row.score,
      faixa: row.faixa,
      edge: row.edge,
      prob_justa_fechamento: row.prob_justa_fechamento,
    };
  });
  if (rows.length === 0) return;
  const { data: picks, error } = await supabase.from("daily_opportunity_picks")
    .upsert(rows, { onConflict: "sent_date,fixture_id,bet_description" })
    .select("id, fixture_id, bet_description");
  if (error) throw error;

  const pickByIdentity = new Map<string, string>(
    (picks ?? []).map((pick: any) => [
      `${pick.fixture_id}:${pick.bet_description}`,
      pick.id,
    ]),
  );
  const refs = claimed.map((claim) => {
    const row = byKey.get(claim.opportunity_key)!;
    const label = publishedPickLabel(row);
    const pickId = pickByIdentity.get(`${row.fixture_id}:${label}`);
    if (!pickId) {
      throw new Error(
        `pick de registro não retornou para ${claim.opportunity_key}`,
      );
    }
    return { alert_id: claim.alert_id, pick_id: pickId };
  });
  const { error: refError } = await supabase
    .from("futebol_publication_alert_pick_refs")
    .upsert(refs, { onConflict: "alert_id" });
  if (refError) throw refError;
}

async function deliverPending(
  supabase: any,
  traceId: string,
): Promise<{ sent: number; errors: string[] }> {
  const { data, error } = await supabase.rpc(
    "claim_futebol_publication_alert_deliveries",
  );
  if (error) throw error;
  const deliveries = (data ?? []) as Delivery[];
  let sent = 0;
  const errors: string[] = [];

  for (const delivery of deliveries) {
    let telegramAccepted = false;
    try {
      const alertIds = delivery.opportunities.map((opportunity) =>
        opportunity.alert_id
      );
      const { data: picks, error: picksError } = await supabase
        .from("futebol_publication_alert_pick_refs")
        .select("alert_id, pick_id")
        .in("alert_id", alertIds);
      if (picksError) throw picksError;
      const pickByAlertId = new Map<string, string>(
        (picks ?? []).map((pick: any) => [pick.alert_id, pick.pick_id]),
      );
      const text = await buildMessage(delivery.opportunities, delivery.user_id);
      const cta = delivery.opportunities.length === 1
        ? {
          label: "Ver o porquê dessa pick →",
          url: await trackedUrl(
            delivery.user_id,
            opportunityDestination(delivery.opportunities[0]),
            CAMPAIGN,
          ),
        }
        : {
          label: "Ver oportunidades no painel →",
          url: await trackedUrl(delivery.user_id, "board", CAMPAIGN),
        };
      await sendTelegram(
        delivery.chat_id,
        text,
        cta,
        registerButtons(delivery.opportunities, pickByAlertId),
      );
      telegramAccepted = true;

      const { error: updateError } = await supabase
        .from("futebol_publication_alert_deliveries")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("batch_id", delivery.batch_id)
        .eq("user_id", delivery.user_id)
        .eq("attempt_id", delivery.attempt_id)
        .eq("status", "processing");
      if (updateError) throw updateError;
      sent++;
      await trackEvent(
        "published_opportunities_sent",
        {
          picks_count: delivery.opportunities.length,
          top_score: Math.max(
            ...delivery.opportunities.map((opportunity) => opportunity.score),
          ),
          channel: "telegram",
        },
        delivery.user_id,
        traceId,
      ).catch(() => {});
    } catch (cause) {
      const message = `${delivery.user_id}: ${
        (cause as Error)?.message ?? "erro no envio"
      }`;
      errors.push(message);
      if (telegramAccepted) {
        // O Telegram confirmou o envio, mas o banco não confirmou o estado.
        // Mantemos a reserva auditável em vez de arriscar uma mensagem duplicada.
        continue;
      }
      await supabase
        .from("futebol_publication_alert_deliveries")
        .update({
          status: "failed",
          last_error: message,
        })
        .eq("batch_id", delivery.batch_id)
        .eq("user_id", delivery.user_id)
        .eq("attempt_id", delivery.attempt_id)
        .eq("status", "processing");
    }
  }
  return { sent, errors };
}

serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  const mode = new URL(req.url).searchParams.get("mode") || "send";
  if (mode === "send" && !TELEGRAM_BOT_TOKEN) {
    return json({ error: "TELEGRAM_BOT_TOKEN not set" }, 500);
  }

  const supabase = createClient(
    SUPABASE_URL,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  const traceId = generateTraceId();
  try {
    const { data: board, error: boardError } = await supabase.rpc(
      "get_futebol_value_board",
    );
    if (boardError) throw boardError;
    const now = new Date();
    const { data: existing, error: existingError } = await supabase
      .from("futebol_publication_alerts")
      .select("opportunity_key");
    if (existingError) throw existingError;
    const plan = planPublicationBatch({
      now,
      alreadyAlerted: new Set(
        (existing ?? []).map((row: any) => row.opportunity_key as string),
      ),
      board: (board ?? []) as BoardRow[],
    });

    const { data: recipients, error: recipientsError } = await supabase.rpc(
      "get_futebol_publication_alert_recipients",
    );
    if (recipientsError) throw recipientsError;
    if (mode === "report") {
      return json({
        ok: true,
        mode,
        new_opportunities: plan.newOpportunities.map((row) => ({
          key: row.key,
          jogo: `${row.home_team_name} × ${row.away_team_name}`,
          pick: publishedPickLabel(row),
          odd: row.best_odd,
          score: row.score,
        })),
        detailed_count: plan.detailedOpportunities.length,
        recipients: (recipients ?? []).length,
      });
    }

    const { data: runtime, error: runtimeError } = await supabase
      .from("futebol_publication_alert_runtime")
      .select("initialized_at")
      .eq("singleton", true)
      .maybeSingle();
    if (runtimeError) throw runtimeError;

    const byKey = new Map(plan.newOpportunities.map((row) => [row.key, row]));
    const { data: claimedData, error: claimError } = await supabase.rpc(
      "claim_futebol_publication_alert_batch",
      {
        p_sync_at: now.toISOString(),
        p_opportunities: plan.newOpportunities.map(payload),
      },
    );
    if (claimError) throw claimError;
    const claimed = (claimedData ?? []) as ClaimedAlert[];

    if (!runtime) {
      const { error: initializeError } = await supabase
        .from("futebol_publication_alert_runtime")
        .insert({
          singleton: true,
          initialized_at: now.toISOString(),
          last_sync_at: now.toISOString(),
        });
      if (initializeError) throw initializeError;
      await logMessageRun(supabase, "notify-published-opportunities", {
        candidates: claimed.length,
        sent: 0,
        ok: true,
      });
      return json({
        ok: true,
        mode,
        baseline: true,
        recorded: claimed.length,
        sent: 0,
      });
    }

    if (claimed.length > 0) {
      await persistRegistrationPicks(supabase, claimed, byKey);
      const batchId = claimed[0].batch_id;
      const deliveryRows = ((recipients ?? []) as Recipient[]).map((
        recipient,
      ) => ({
        batch_id: batchId,
        user_id: recipient.user_id,
        chat_id: recipient.chat_id,
      }));
      if (deliveryRows.length > 0) {
        const { error: deliveryError } = await supabase
          .from("futebol_publication_alert_deliveries")
          .upsert(deliveryRows, {
            onConflict: "batch_id,user_id",
            ignoreDuplicates: true,
          });
        if (deliveryError) throw deliveryError;
      }
    }

    const result = await deliverPending(supabase, traceId);
    await logMessageRun(supabase, "notify-published-opportunities", {
      candidates: claimed.length,
      sent: result.sent,
      errors: result.errors,
      ok: true,
    });
    return json({
      ok: true,
      mode,
      published: claimed.length,
      sent: result.sent,
      errors: result.errors,
    });
  } catch (cause) {
    const message = (cause as Error)?.message ?? "Internal error";
    console.error("notify-published-opportunities error:", message);
    if (mode === "send") {
      await logMessageRun(supabase, "notify-published-opportunities", {
        errors: [message],
        ok: false,
      });
    }
    return json({ error: message }, 500);
  }
});
