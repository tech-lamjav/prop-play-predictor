// ============================================================
// ingest-wc-squads — ingestão de elencos da Copa (API-Sports → wc_players)
// ============================================================
// Disparada sob demanda (admin) quando os elencos forem confirmados. Lê os 48
// times do wc_team_map, puxa /players/squads?team=ID de cada, e faz upsert em
// wc_players (nome, posição, número, foto). birth_date NÃO vem no squads (só age)
// — fica null aqui e é preenchido pelo passo de enriquecimento via profiles.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET (mesma do ingest-wc-scores).
// Idempotente: upsert por player_id.
//
// Atenção: o squads retorna o POOL nacional amplo (~40-50/seleção), não os 26 da
// Copa. Re-rodar perto da convocação oficial pra refletir a lista enxuta.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://v3.football.api-sports.io";

serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (!cronSecret || provided !== cronSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const apiKey = Deno.env.get("API_SPORTS_KEY") || "";
  if (!apiKey) return json({ error: "API_SPORTS_KEY not set" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );

  try {
    // 1) Times da Copa (de↔para api_team_id → team_code)
    const { data: teams, error: teamErr } = await supabase
      .from("wc_team_map")
      .select("api_team_id, team_code");
    if (teamErr) throw teamErr;

    let totalPlayers = 0;
    const teamErrors: { api_team_id: number; error: string }[] = [];

    // 2) Para cada seleção, puxa o elenco e faz upsert
    for (const t of teams ?? []) {
      const res = await fetch(`${API_BASE}/players/squads?team=${t.api_team_id}`, {
        headers: { "x-apisports-key": apiKey },
      });
      if (!res.ok) {
        teamErrors.push({ api_team_id: t.api_team_id, error: `API ${res.status}` });
        continue;
      }
      const payload = await res.json();
      const players: any[] = payload?.response?.[0]?.players ?? [];

      const rows = players
        .filter((p) => p?.id != null)
        .map((p) => ({
          player_id: Number(p.id),
          player_name: String(p.name ?? "").trim() || `#${p.id}`,
          api_team_id: t.api_team_id,
          team_code: t.team_code,
          position: p.position ?? null,
          shirt_number: p.number ?? null,
          photo_url: p.photo ?? null,
          updated_at: new Date().toISOString(),
          // birth_date: preenchido no passo de enriquecimento (profiles)
        }));

      if (rows.length > 0) {
        const { error: upErr } = await supabase
          .from("wc_players")
          .upsert(rows, { onConflict: "player_id" });
        if (upErr) {
          teamErrors.push({ api_team_id: t.api_team_id, error: upErr.message });
          continue;
        }
        totalPlayers += rows.length;
      }
    }

    return json({
      ok: teamErrors.length === 0,
      times_processados: (teams?.length ?? 0) - teamErrors.length,
      jogadores_upsertados: totalPlayers,
      erros: teamErrors,
    });
  } catch (e) {
    console.error("ingest-wc-squads error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
