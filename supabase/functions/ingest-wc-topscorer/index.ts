// ============================================================
// ingest-wc-topscorer — resolve o ARTILHEIRO automático (pós-final)
// ============================================================
// Puxa /players/topscorers da Copa, aplica o desempate oficial da Chuteira de
// Ouro (mais gols → mais assistências → menos minutos jogados), grava o vencedor
// em wc_player_awards('top_scorer') e dispara resolve_player_awards.
//
// Rodar UMA vez após a final (manual ou no botão do admin). Idempotente.
// Proteção: header x-cron-secret. Garante que o jogador exista em wc_players
// (upsert mínimo via wc_team_map) antes de gravar o award (FK).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

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

  try {
    const res = await fetch(
      `${API_BASE}/players/topscorers?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      { headers: { "x-apisports-key": apiKey } }
    );
    if (!res.ok) return json({ error: `API ${res.status}` }, 502);
    const payload = await res.json();
    const list: any[] = payload?.response ?? [];
    if (list.length === 0) {
      return json({ ok: true, message: "Sem dados de artilheiro ainda (torneio não começou/terminou)." });
    }

    // Desempate oficial: gols ↓, assists ↓, minutos ↑
    const ranked = list
      .map((e) => {
        const st = e?.statistics?.[0] ?? {};
        return {
          player_id: Number(e?.player?.id),
          name: e?.player?.name ?? null,
          birth: e?.player?.birth?.date ?? null,
          photo: e?.player?.photo ?? null,
          api_team_id: Number(st?.team?.id) || null,
          goals: st?.goals?.total ?? 0,
          assists: st?.goals?.assists ?? 0,
          minutes: st?.games?.minutes ?? 999999,
        };
      })
      .filter((p) => p.player_id)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.minutes - b.minutes);

    const winner = ranked[0];

    // Garante que o jogador exista em wc_players (FK do award)
    const { data: existing } = await supabase
      .from("wc_players").select("player_id").eq("player_id", winner.player_id).maybeSingle();

    if (!existing && winner.api_team_id) {
      const { data: tm } = await supabase
        .from("wc_team_map").select("team_code").eq("api_team_id", winner.api_team_id).maybeSingle();
      if (tm?.team_code) {
        await supabase.from("wc_players").insert({
          player_id: winner.player_id,
          player_name: winner.name ?? `#${winner.player_id}`,
          api_team_id: winner.api_team_id,
          team_code: tm.team_code,
          birth_date: winner.birth,
          photo_url: winner.photo,
        });
      }
    }

    // Grava o vencedor + settle
    const { error: awErr } = await supabase
      .from("wc_player_awards")
      .upsert(
        { award_type: "top_scorer", winner_player_id: winner.player_id, resolved_at: new Date().toISOString() },
        { onConflict: "award_type" }
      );
    if (awErr) throw awErr;

    const { data: resolveRes, error: rErr } = await supabase.rpc("resolve_player_awards");
    if (rErr) throw rErr;

    return json({
      ok: true,
      artilheiro: { player_id: winner.player_id, name: winner.name, goals: winner.goals, assists: winner.assists },
      resolve: resolveRes,
    });
  } catch (e) {
    console.error("ingest-wc-topscorer error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
