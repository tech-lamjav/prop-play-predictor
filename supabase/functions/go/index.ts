// ============================================================
// go — redirecionador rastreado das DMs (clique → registro → destino)
// ============================================================
// Os links das mensagens do bot passam por aqui: registramos QUEM clicou
// em QUÊ (notification_clicks) — o que alimenta o funil enviado → clicou
// e ZERA o contador da regra de reativação (2 envios sem clique = para,
// do notify-opportunities) — e mandamos a pessoa pro destino num 302.
//
// URL: /go?u=<user_id>&d=<dest>&s=<hmac>&c=<campanha?>
//   dest permitidos: "board" → /futebol · "jogo-<id>" → /futebol/jogo/<id>
//                    · "bank" → /bets (resumo semanal, item 04)
//   c = campanha (default "daily_opportunities" p/ retrocompat). Só a campanha
//       do daily zera a régua de reativação (opportunity_dispatch_state).
//   s = HMAC-SHA256(CRON_SECRET, "<u>:<d>") — impede forjar clique de outro
//       usuário. Assinatura inválida → redireciona mesmo assim (usuário
//       nunca vê erro), só não registra.
//
// PÚBLICA (--no-verify-jwt): quem chama é o navegador do usuário.
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateTraceId, trackEvent } from "../shared/posthog.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SITE = "https://www.smartbetting.app";
const DAILY_CAMPAIGN = "daily_opportunities";

function destUrl(dest: string, campaign: string): string {
  const utm = `utm_source=telegram&utm_campaign=${encodeURIComponent(campaign)}`;
  if (dest === "board") return `${SITE}/futebol?${utm}`;
  if (dest === "bank") return `${SITE}/bets?${utm}`;
  const jogo = dest.match(/^jogo-(\d+)$/);
  if (jogo) return `${SITE}/futebol/jogo/${jogo[1]}?${utm}`;
  return SITE; // destino desconhecido → home (nunca mostrar erro pro usuário)
}

async function hmacHex(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(CRON_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

serve(async (req) => {
  const url = new URL(req.url);
  const u = url.searchParams.get("u") || "";
  const d = url.searchParams.get("d") || "";
  const s = url.searchParams.get("s") || "";
  const campaign = url.searchParams.get("c") || DAILY_CAMPAIGN;
  const target = destUrl(d, campaign);

  // registra o clique só com assinatura válida — mas SEMPRE redireciona
  try {
    if (u && d && s && CRON_SECRET && s === (await hmacHex(`${u}:${d}`))) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      await supabase.from("notification_clicks").insert({ user_id: u, campaign, destination: d });
      // clique no daily = engajou → zera a régua da reativação (só p/ o daily)
      if (campaign === DAILY_CAMPAIGN) {
        await supabase
          .from("opportunity_dispatch_state")
          .update({ sends_without_click: 0, last_click_at: new Date().toISOString() })
          .eq("user_id", u);
      }
      await trackEvent(
        campaign === DAILY_CAMPAIGN ? "daily_opportunities_click" : "weekly_summary_clicked",
        { destination: d, campaign, channel: "telegram" },
        u, generateTraceId()
      ).catch(() => {});
    }
  } catch (e) {
    console.error("go tracking error:", (e as Error)?.message); // rastreio nunca bloqueia o redirect
  }

  return new Response(null, { status: 302, headers: { Location: target } });
});
