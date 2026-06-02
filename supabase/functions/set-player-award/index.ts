// ============================================================
// set-player-award — registra vencedor de prêmio e liquida (admin/manual)
// ============================================================
// Usada na noite da final pros prêmios de JÚRI (goleiro/craque/revelação), que a
// API não entrega — o operador informa o player_id oficial. Também serve pra
// corrigir/forçar o artilheiro manualmente. Grava wc_player_awards + dispara
// resolve_player_awards.
//
// Proteção: header x-cron-secret. Body: { award_type, player_id }.
// O jogador precisa existir em wc_players (validação explícita).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VALID = new Set(["top_scorer", "best_goalkeeper", "best_young_player", "best_player"]);

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if ((req.headers.get("x-cron-secret") || "") !== cronSecret || !cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const awardType = String(body?.award_type ?? "");
    const playerId = Number(body?.player_id);

    if (!VALID.has(awardType)) {
      return json({ error: `award_type inválido. Use: ${[...VALID].join(", ")}` }, 400);
    }
    if (!playerId) return json({ error: "player_id obrigatório" }, 400);

    // Jogador precisa existir (FK + sanidade)
    const { data: player } = await supabase
      .from("wc_players").select("player_id, player_name").eq("player_id", playerId).maybeSingle();
    if (!player) return json({ error: `Jogador ${playerId} não está em wc_players` }, 404);

    const { error: awErr } = await supabase
      .from("wc_player_awards")
      .upsert(
        { award_type: awardType, winner_player_id: playerId, resolved_at: new Date().toISOString() },
        { onConflict: "award_type" }
      );
    if (awErr) throw awErr;

    const { data: resolveRes, error: rErr } = await supabase.rpc("resolve_player_awards");
    if (rErr) throw rErr;

    return json({ ok: true, award: awardType, winner: player, resolve: resolveRes });
  } catch (e) {
    console.error("set-player-award error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
