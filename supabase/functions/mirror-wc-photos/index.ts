// ============================================================
// mirror-wc-photos — espelha as fotos dos jogadores no nosso Storage
// ============================================================
// A api-sports serve a foto (HTTP 200) servidor-a-servidor, mas o <img> no
// navegador falha (hotlink protection / rede). Solução: a edge function baixa a
// imagem e sobe no bucket público wc-player-photos; reescreve wc_players.photo_url
// pra URL do nosso Storage (que o navegador alcança sem hotlink).
//
// Lotes com cursor (after/batch). Idempotente: pula quem já aponta pro Storage.
// Proteção: header x-cron-secret. Body: { after?: number, batch?: number }.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "wc-player-photos";
const DEFAULT_BATCH = 80;

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if ((req.headers.get("x-cron-secret") || "") !== cronSecret || !cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  let after = 0;
  let batch = DEFAULT_BATCH;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.after === "number") after = body.after;
    if (typeof body?.batch === "number") batch = Math.min(Math.max(body.batch, 1), 150);
  } catch { /* sem body */ }

  try {
    const { data: rows, error: selErr } = await supabase
      .from("wc_players")
      .select("player_id, photo_url")
      .gt("player_id", after)
      .order("player_id", { ascending: true })
      .limit(batch);
    if (selErr) throw selErr;

    let mirrored = 0;
    let lastId = after;
    for (const row of rows ?? []) {
      lastId = Number(row.player_id);
      const src: string | null = row.photo_url;
      // pula quem não tem foto de origem ou já está no nosso storage
      if (!src || src.includes("/storage/v1/object/public/")) continue;

      const res = await fetch(src, { redirect: "follow" });
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) continue;

      const path = `${row.player_id}.png`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) continue;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("wc_players")
        .update({ photo_url: pub.publicUrl })
        .eq("player_id", row.player_id);
      if (!updErr) mirrored++;
    }

    const done = (rows?.length ?? 0) < batch;
    return json({ ok: true, processados: rows?.length ?? 0, espelhados: mirrored, next_after: lastId, done });
  } catch (e) {
    console.error("mirror-wc-photos error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
