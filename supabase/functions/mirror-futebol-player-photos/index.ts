// ============================================================
// mirror-futebol-player-photos — espelha fotos dos jogadores (futebol) no Storage
// ============================================================
// Mesmo padrão de mirror-wc-photos / mirror-futebol-team-logos. A api-sports
// serve a foto server-a-server, mas o <img> no navegador falha (hotlink). Aqui
// baixamos media.api-sports.io/football/players/{id}.png e subimos no bucket
// público futebol-player-photos como {player_id}.png. O front serve por player_id.
//
// Coleta os player_id dos ARTILHEIROS+cartões via RPC get_futebol_leaders (já
// público). Idempotente (upsert). Deploy com verify_jwt=false; protegida pelo
// header x-cron-secret (CRON_SECRET) — o gate por ?token= hardcoded do
// protótipo dev foi substituído ao versionar. Body: { pairs?: [{c,s}] }.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "futebol-player-photos";
const DEFAULT_PAIRS = [
  { c: "brasileirao", s: 2026 },
  { c: "brasileirao", s: 2025 },
  { c: "brasileirao", s: 2024 },
  { c: "copa_mundo", s: 2026 },
];

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if ((req.headers.get("x-cron-secret") || "") !== cronSecret || !cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  let pairs = DEFAULT_PAIRS;
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.pairs) && body.pairs.length > 0) {
      pairs = body.pairs;
    }
  } catch {
    // sem body
  }

  const ids = new Set<number>();
  for (const p of pairs) {
    const { data, error } = await supabase.rpc("get_futebol_leaders", {
      p_competition: p.c,
      p_season: p.s,
    });
    if (error || !data) continue;
    for (const x of data.scorers ?? []) {
      if (x && x.player_id) ids.add(Number(x.player_id));
    }
    for (const x of data.cards ?? []) {
      if (x && x.player_id) ids.add(Number(x.player_id));
    }
  }

  let mirrored = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const url = `https://media.api-sports.io/football/players/${id}.png`;
      const res = await fetch(url, { redirect: "follow" });
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
  return json({ ok: true, total: ids.size, mirrored, failed });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
