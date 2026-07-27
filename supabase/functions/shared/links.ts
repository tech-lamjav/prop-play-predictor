// shared/links.ts — links rastreados das DMs (Onda 3: estava duplicado 1:1 em
// notify-opportunities e notify-weekly-summary).
//
// O link passa pelo redirecionador `go`: /go?u=<user>&d=<dest>&s=<hmac>[&c=<campanha>]
// s = HMAC-SHA256(CRON_SECRET, "<u>:<d>") — impede forjar clique de outro usuário.
// `campaign` omitida = daily_opportunities (retrocompat do go).

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

export async function hmacHex(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(CRON_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export async function trackedUrl(userId: string, dest: string, campaign?: string): Promise<string> {
  const s = await hmacHex(`${userId}:${dest}`);
  const c = campaign ? `&c=${encodeURIComponent(campaign)}` : "";
  return `${SUPABASE_URL}/functions/v1/go?u=${userId}&d=${encodeURIComponent(dest)}&s=${s}${c}`;
}
