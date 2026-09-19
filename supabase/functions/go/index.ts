// ============================================================
// go — redirecionador rastreado das DMs (clique → registro → destino)
// ============================================================
// Os links das mensagens do bot passam por aqui: registramos QUEM clicou
// em QUÊ (notification_clicks) — o que alimenta o funil enviado → clicou
// e ZERA o contador da regra de reativação (2 envios sem clique = para,
// do notify-opportunities) — e mandamos a pessoa pro destino num 302.
//
// URL: /go?u=<user_id>&d=<dest>&s=<hmac>&c=<campanha?>
//        [&dl=<entrega>&bt=<lote>&lk=<link>&ts=<envio>&sg=<segmento>]
//   dest permitidos: "board" → /futebol · "jogo-<id>" → /futebol/jogo/<id>
//                    · "jogo-<id>|mercado|saída|linha" → leitura exata
//                    · "bank" → /bets (resumo semanal, item 04)
//                    · "assinar" → /futebol/assinar (oferta pós-teste, item 12)
//   c = campanha (default "daily_opportunities" p/ retrocompat). Só a campanha
//       do daily zera a régua de reativação (opportunity_dispatch_state).
//   s = HMAC-SHA256(CRON_SECRET, "<u>:<d>") — impede forjar clique de outro
//       usuário. Assinatura inválida → redireciona mesmo assim (usuário
//       nunca vê erro), só não registra.
//
// ── A corrente de atribuição ────────────────────────────────────────────────
//
// `dl` (delivery_id) é a chave canônica que liga ENVIO, CLIQUE e CHEGADA. Antes
// dela o `trace_id` do evento de envio nascia uma vez por rodada do cron, e
// este arquivo gerava um `generateTraceId()` NOVO no clique: os dois nunca
// coincidiam, e casá-los no PostHog só dava por `distinct_id` mais horário —
// adivinhação. Agora o clique usa o `dl` como trace, e o mesmo `dl` segue para
// o site na URL de destino, onde vira `telegram_opportunity_landing_opened`.
//
// Os parâmetros são OPCIONAIS de propósito: existe link antigo, já entregue no
// celular de alguém, que nunca vai ter estes campos. Sem `dl`, tudo funciona
// como antes — só sem a correlação.
//
// PÚBLICA (--no-verify-jwt): quem chama é o navegador do usuário.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";
import { oportunidadeDoDestino, paramsDaAtribuicao } from "../shared/atribuicao.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SITE = "https://www.smartbetting.app";
const DAILY_CAMPAIGN = "daily_opportunities";
const PUBLISHED_CAMPAIGN = "published_opportunities";

/** O que o link trouxe de atribuição. Tudo opcional: link antigo não tem nada. */
type AtribuicaoRecebida = {
  deliveryId: string;
  batchId: string;
  linkId: string;
  sentAt: string | null;
  segment: string | null;
};

function destUrl(
  dest: string,
  campaign: string,
  atribuicao: AtribuicaoRecebida | null,
): string {
  const params = new URLSearchParams({
    utm_source: "telegram",
    utm_campaign: campaign,
  });
  // A atribuição completa só entra quando o link a trouxe. Ela SUBSTITUI os
  // utm_source/utm_campaign montados acima pelos do contrato (que incluem
  // utm_medium), sem duplicar chave — `URLSearchParams.set` sobrescreve.
  if (atribuicao) {
    for (
      const [k, v] of paramsDaAtribuicao({
        deliveryId: atribuicao.deliveryId,
        batchId: atribuicao.batchId,
        linkId: atribuicao.linkId,
        campaignId: campaign,
        campaignType: campaign,
        segment: atribuicao.segment,
        sentAt: atribuicao.sentAt,
        opportunityId: oportunidadeDoDestino(dest),
        utmContent: atribuicao.linkId,
      })
    ) {
      params.set(k, v);
    }
  }

  if (dest === "board") return `${SITE}/futebol?${params.toString()}`;
  if (dest === "bank") return `${SITE}/bets?${params.toString()}`;
  // O checkout do futebol, e não a landing de aquisição: quem recebeu a oferta
  // pós-teste já testou, e /futebol/comecar oferece começar de graça de novo.
  if (dest === "assinar") return `${SITE}/futebol/assinar?${params.toString()}`;
  const jogo = dest.match(/^jogo-(\d+)(?:\|([^|]+)\|([^|]+)\|([^|]*))?$/);
  if (jogo) {
    if (jogo[2] && jogo[3]) {
      params.set("mercado", jogo[2]);
      params.set("saida", jogo[3]);
      if (jogo[4]) params.set("linha", jogo[4]);
    }
    return `${SITE}/futebol/jogo/${jogo[1]}?${params.toString()}`;
  }
  return SITE; // destino desconhecido → home (nunca mostrar erro pro usuário)
}

async function hmacHex(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CRON_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(msg),
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0"))
    .join("").slice(0, 16);
}

serve(async (req) => {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") || "";
  const d = url.searchParams.get("d") || "";
  const s = url.searchParams.get("s") || "";
  const campaign = url.searchParams.get("c") || DAILY_CAMPAIGN;

  // A atribuição exige o trio: uma entrega sem lote ou sem link não fecha a
  // correlação, e meia atribuição num relatório é pior que nenhuma — ela
  // parece completa.
  const dl = url.searchParams.get("dl");
  const bt = url.searchParams.get("bt");
  const lk = url.searchParams.get("lk");
  const atribuicao: AtribuicaoRecebida | null = dl && bt && lk
    ? {
      deliveryId: dl,
      batchId: bt,
      linkId: lk,
      sentAt: url.searchParams.get("ts"),
      segment: url.searchParams.get("sg"),
    }
    : null;

  const target = destUrl(d, campaign, atribuicao);

  // registra o clique só com assinatura válida — mas SEMPRE redireciona
  try {
    if (u && d && s && CRON_SECRET && s === (await hmacHex(`${u}:${d}`))) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      );
      await supabase.from("notification_clicks").insert({
        user_id: u,
        campaign,
        destination: d,
      });
      // clique no daily = engajou → zera a régua da reativação (só p/ o daily)
      if (campaign === DAILY_CAMPAIGN) {
        await supabase
          .from("opportunity_dispatch_state")
          .update({
            sends_without_click: 0,
            last_click_at: new Date().toISOString(),
          })
          .eq("user_id", u);
      }
      const event = campaign === DAILY_CAMPAIGN
        ? "daily_opportunities_click"
        : campaign === PUBLISHED_CAMPAIGN
        ? "published_opportunities_click"
        : "weekly_summary_clicked";
      await trackEvent(
        event,
        {
          destination: d,
          campaign,
          channel: "telegram",
          // As MESMAS chaves do evento de envio e do de chegada. É o que
          // permite o funil envio → clique → visita sem casar por horário.
          delivery_id: atribuicao?.deliveryId ?? null,
          batch_id: atribuicao?.batchId ?? null,
          link_id: atribuicao?.linkId ?? null,
          campaign_id: campaign,
          campaign_type: campaign,
          opportunity_id: oportunidadeDoDestino(d),
          segment: atribuicao?.segment ?? null,
        },
        u,
        // O `delivery_id` COMO trace. Gerar um novo aqui era o defeito: ele
        // nascia órfão, sem nada do outro lado com que se casar.
        atribuicao?.deliveryId ?? generateTraceId(),
      ).catch(() => {});
    }
  } catch (e) {
    console.error("go tracking error:", (e as Error)?.message); // rastreio nunca bloqueia o redirect
  }

  return new Response(null, { status: 302, headers: { Location: target } });
});
