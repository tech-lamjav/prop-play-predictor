// ============================================================
// enrich-wc-players — preenche birth_date em wc_players (via players/profiles)
// ============================================================
// O endpoint /players/squads NÃO traz data de nascimento (só age). Esta função
// busca /players/profiles?player=ID e grava birth_date — necessário pro filtro de
// elegibilidade do Melhor Jovem (Revelação).
//
// Processa em LOTES com cursor (p_after = último player_id processado) pra não
// estourar o tempo de execução. Chamar repetidamente passando next_after até done.
// Só chama profiles pra quem está sem birth_date (re-runs ficam baratos), mas o
// cursor avança sempre (não trava no "tail" de jogadores sem data na API).
//
// Proteção: header `x-cron-secret`. Body opcional: { after?: number, batch?: number }.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://v3.football.api-sports.io";
const DEFAULT_BATCH = 120;

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if ((req.headers.get("x-cron-secret") || "") !== cronSecret || !cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  const apiKey = Deno.env.get("API_SPORTS_KEY") || "";
  if (!apiKey) return json({ error: "API_SPORTS_KEY not set" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  let after = 0;
  let batch = DEFAULT_BATCH;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.after === "number") after = body.after;
    if (typeof body?.batch === "number") batch = Math.min(Math.max(body.batch, 1), 200);
  } catch { /* sem body */ }

  try {
    // Lote por cursor (player_id crescente)
    const { data: rows, error: selErr } = await supabase
      .from("wc_players")
      .select("player_id, birth_date")
      .gt("player_id", after)
      .order("player_id", { ascending: true })
      .limit(batch);
    if (selErr) throw selErr;

    let enriched = 0;
    let lastId = after;
    for (const row of rows ?? []) {
      lastId = Number(row.player_id);
      if (row.birth_date) continue; // já tem — pula a chamada

      const res = await fetch(`${API_BASE}/players/profiles?player=${row.player_id}`, {
        headers: { "x-apisports-key": apiKey },
      });
      if (!res.ok) continue;
      const payload = await res.json();
      const birth = payload?.response?.[0]?.player?.birth?.date ?? null;
      if (!birth) continue;

      const { error: upErr } = await supabase
        .from("wc_players")
        .update({ birth_date: birth })
        .eq("player_id", row.player_id);
      if (!upErr) enriched++;
    }

    const done = (rows?.length ?? 0) < batch;
    return json({
      ok: true,
      processados: rows?.length ?? 0,
      enriquecidos: enriched,
      next_after: lastId,
      done,
    });
  } catch (e) {
    console.error("enrich-wc-players error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
