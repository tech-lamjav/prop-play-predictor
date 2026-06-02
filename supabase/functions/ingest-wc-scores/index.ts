// ============================================================
// ingest-wc-scores — ingestão de placar da Copa (API-Sports → wc_matches)
// ============================================================
// Job de cron (não user-facing). Puxa os fixtures da Copa 2026 na API-Sports,
// atualiza placar + is_finished em wc_matches (casando por api_fixture_id) e
// dispara calculate_bolao_scores nos jogos que mudaram pra finalizado.
//
// Proteção: header `x-cron-secret` == env CRON_SECRET (evita chamada pública).
// Segredos (env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, API_SPORTS_KEY, CRON_SECRET.
//
// Idempotente: só escreve quando o valor muda; só recalcula pontos quando o jogo
// vira finalizado ou o placar muda.
//
// Escopo atual: fase de grupos (api_fixture_id já semeado na migration 047). O
// mata-mata (32 jogos) ainda não carregou na API e tem times TBD no nosso seed —
// o auto-link dele entra numa iteração futura (ver TODO no fim).
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;
const FINISHED = new Set(["FT", "AET", "PEN"]); // status.short que contam como encerrado

serve(async (req) => {
  // Auth de cron: header secreto
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
    // 1) Puxa todos os fixtures da Copa (1 request — escala trivial p/ 1 liga)
    const res = await fetch(
      `${API_BASE}/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      { headers: { "x-apisports-key": apiKey } }
    );
    if (!res.ok) return json({ error: `API ${res.status}` }, 502);
    const payload = await res.json();
    const fixtures: any[] = payload?.response ?? [];

    // 2) Carrega o estado atual dos jogos já linkados (api_fixture_id NOT NULL)
    const { data: rows, error: selErr } = await supabase
      .from("wc_matches")
      .select("id, api_fixture_id, home_score, away_score, is_finished")
      .not("api_fixture_id", "is", null);
    if (selErr) throw selErr;

    const byFixture = new Map<number, any>();
    for (const r of rows ?? []) byFixture.set(Number(r.api_fixture_id), r);

    const changedMatchIds: number[] = [];
    let updated = 0;
    let skippedUnlinked = 0;

    // 3) Para cada fixture, atualiza o jogo correspondente se algo mudou
    for (const fx of fixtures) {
      const fid = Number(fx?.fixture?.id);
      const row = byFixture.get(fid);
      if (!row) {
        skippedUnlinked++; // mata-mata ainda não linkado, etc.
        continue;
      }

      const status = fx?.fixture?.status?.short ?? "";
      const isFinished = FINISHED.has(status);
      const homeScore = fx?.goals?.home ?? null; // resultado (AET incluso; pênaltis à parte)
      const awayScore = fx?.goals?.away ?? null;

      const scoreChanged =
        row.home_score !== homeScore || row.away_score !== awayScore;
      const finishedChanged = row.is_finished !== isFinished;
      if (!scoreChanged && !finishedChanged) continue;

      const { error: updErr } = await supabase
        .from("wc_matches")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          is_finished: isFinished,
        })
        .eq("id", row.id);
      if (updErr) throw updErr;
      updated++;

      // Recalcula pontos só quando o jogo (passa a) estar finalizado
      if (isFinished) changedMatchIds.push(row.id);
    }

    // 4) Dispara o cálculo de pontos dos bolões pros jogos que mudaram
    const scored: number[] = [];
    for (const matchId of changedMatchIds) {
      const { error: rpcErr } = await supabase.rpc("calculate_bolao_scores", {
        p_match_id: matchId,
      });
      if (rpcErr) {
        console.error(`calculate_bolao_scores(${matchId}) falhou:`, rpcErr.message);
        continue;
      }
      scored.push(matchId);
    }

    return json({
      ok: true,
      fixtures_recebidos: fixtures.length,
      jogos_atualizados: updated,
      jogos_recalculados: scored.length,
      fixtures_sem_link: skippedUnlinked, // esperado p/ mata-mata por enquanto
    });
  } catch (e) {
    console.error("ingest-wc-scores error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// TODO (iteração futura): auto-link do mata-mata. Quando a API carregar os 32
// jogos do knockout (com times reais) e o nosso bracket resolver os TBD, casar
// por par de times via wc_team_map e gravar api_fixture_id nas linhas knockout.
