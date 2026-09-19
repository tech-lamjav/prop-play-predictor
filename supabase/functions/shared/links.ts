// shared/links.ts — links rastreados das DMs (Onda 3: estava duplicado 1:1 em
// notify-opportunities e notify-weekly-summary).
//
// O link passa pelo redirecionador `go`: /go?u=<user>&d=<dest>&s=<hmac>[&c=<campanha>]
// s = HMAC-SHA256(CRON_SECRET, "<u>:<d>") — impede forjar clique de outro usuário.
// `campaign` omitida = daily_opportunities (retrocompat do go).
//
// ── A atribuição, a partir do trabalho de instrumentação ────────────────────
//
// O link passou a carregar também `dl` (entrega), `bt` (lote) e `lk` (link).
// São eles que o `go` devolve ao site, e é o `dl` que liga envio, clique e
// chegada — antes disso o `trace_id` do envio e o do clique eram gerados em
// lugares diferentes e nunca se encontravam.
//
// ⚠️ A ASSINATURA NÃO MUDOU: continua sendo HMAC sobre `<u>:<d>` e só. Isso é
// deliberado, por duas razões. A primeira é que link já entregue precisa
// continuar valendo — mensagem de ontem no celular de alguém não se atualiza, e
// assinar campo novo invalidaria todas de uma vez. A segunda é que estes
// parâmetros são de MEDIÇÃO, não de autorização: forjá-los suja um relatório,
// não dá acesso a nada. O que a assinatura protege — quem clicou e para onde —
// segue protegido igual.

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

export async function hmacHex(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(CRON_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** A atribuição que o link leva até o `go`. Nomes curtos: isto vai numa URL. */
export type AtribuicaoDoLink = {
  deliveryId: string;
  batchId: string;
  linkId: string;
  /** ISO do envio, para o site medir o tempo até a chegada. */
  sentAt?: string | null;
  segment?: string | null;
};

export async function trackedUrl(
  userId: string,
  dest: string,
  campaign?: string,
  atribuicao?: AtribuicaoDoLink,
): Promise<string> {
  const s = await hmacHex(`${userId}:${dest}`);
  const c = campaign ? `&c=${encodeURIComponent(campaign)}` : "";
  const base =
    `${SUPABASE_URL}/functions/v1/go?u=${userId}&d=${encodeURIComponent(dest)}&s=${s}${c}`;
  if (!atribuicao) return base;

  // Opcional porque nem todo link do bot é de campanha medida — e porque o
  // parâmetro ausente precisa continuar funcionando no `go`, que atende links
  // antigos que nunca terão estes campos.
  const extra = new URLSearchParams({
    dl: atribuicao.deliveryId,
    bt: atribuicao.batchId,
    lk: atribuicao.linkId,
  });
  if (atribuicao.sentAt) extra.set("ts", atribuicao.sentAt);
  if (atribuicao.segment) extra.set("sg", atribuicao.segment);
  return `${base}&${extra.toString()}`;
}
