// ============================================================
// go — redirecionador rastreado das DMs (clique → registro → destino)
// ============================================================
// Os links das mensagens do bot passam por aqui: registramos QUEM clicou
// em QUÊ (notification_clicks) — o que alimenta o funil enviado → clicou
// e ZERA o contador da regra de reativação (2 envios sem clique = para,
// do notify-opportunities) — e mandamos a pessoa pro destino num 302.
//
// URL: /go?u=<user_id>&d=<dest>&s=<hmac>
//   dest permitidos: "board" → /futebol · "jogo-<id>" → /futebol/jogo/<id>
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
const CAMPAIGN = "daily_opportunities";

function destUrl(dest: string): string {
  if (dest === "board") return `${SITE}/futebol?utm_source=telegram&utm_campaign=${CAMPAIGN}`;
  const jogo = dest.match(/^jogo-(\d+)$/);
  if (jogo) return `${SITE}/futebol/jogo/${jogo[1]}?utm_source=telegram&utm_campaign=${CAMPAIGN}`;
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
  const target = destUrl(d);

  // registra o clique só com assinatura válida — mas SEMPRE redireciona
  try {
    if (u && d && s && CRON_SECRET && s === (await hmacHex(`${u}:${d}`))) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      await supabase.from("notification_clicks").insert({ user_id: u, campaign: CAMPAIGN, destination: d });
      // clique = engajou → zera a régua da reativação
      await supabase
        .from("opportunity_dispatch_state")
        .update({ sends_without_click: 0, last_click_at: new Date().toISOString() })
        .eq("user_id", u);
      await trackEvent(
        "daily_opportunities_click",
        { destination: d, channel: "telegram" },
        u, generateTraceId()
      ).catch(() => {});
    }
  } catch (e) {
    console.error("go tracking error:", (e as Error)?.message); // rastreio nunca bloqueia o redirect
  }

  return new Response(null, { status: 302, headers: { Location: target } });
});
