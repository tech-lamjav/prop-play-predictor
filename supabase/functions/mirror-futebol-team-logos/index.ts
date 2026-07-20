// ============================================================
// mirror-futebol-team-logos — espelha os brasões dos times no nosso Storage
// ============================================================
// A api-sports serve a imagem (HTTP 200) servidor-a-servidor, mas o <img> no
// navegador falha (hotlink protection). Solução (mesmo padrão de
// mirror-wc-photos): a edge function baixa cada logo e sobe no bucket público
// `futebol-team-logos` como `{team_id}.png`. O frontend monta a URL do nosso
// Storage por team_id (helper getFutebolTeamLogoUrl), sem depender da api-sports.
//
// Fonte da lista: RPC public.get_futebol_teams() (lê bq_futebol.dim_teams via FDW).
// Idempotente (upsert). Deploy com verify_jwt=false; protegida pelo header
// x-cron-secret (CRON_SECRET), padrão mirror-wc-photos. Disparo manual/pg_net.
// Body opcional: { force?: boolean }.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "futebol-team-logos";

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if ((req.headers.get("x-cron-secret") || "") !== cronSecret || !cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    const { data: teams, error } = await supabase.rpc("get_futebol_teams");
    if (error) throw error;

    let mirrored = 0;
    let skipped = 0;
    let failed = 0;

    for (const t of teams ?? []) {
      const id = Number(t.team_id);
      const src: string | null = t.team_logo_url;
      if (!id || !src) { skipped++; continue; }

      try {
        const res = await fetch(src, { redirect: "follow" });
        if (!res.ok) { failed++; continue; }
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength === 0) { failed++; continue; }

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(`${id}.png`, bytes, { contentType: "image/png", upsert: true });
        if (upErr) { failed++; continue; }
        mirrored++;
      } catch {
        failed++;
      }
    }

    return json({ ok: true, total: teams?.length ?? 0, mirrored, skipped, failed });
  } catch (e) {
    console.error("mirror-futebol-team-logos error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
