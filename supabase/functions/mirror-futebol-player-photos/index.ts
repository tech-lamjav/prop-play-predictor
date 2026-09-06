// ============================================================
// mirror-futebol-player-photos — espelha fotos dos jogadores (futebol) no Storage
// ============================================================
// Mesmo padrão de mirror-wc-photos / mirror-futebol-team-logos. A api-sports
// serve a foto server-a-server, mas o <img> no navegador falha (hotlink). Aqui
// baixamos media.api-sports.io/football/players/{id}.png e subimos no bucket
// público futebol-player-photos como {player_id}.png. O front serve por player_id.
//
// Duas fontes de player_id, e as duas importam:
//
//   ARTILHEIROS + cartões, via RPC get_futebol_leaders. É a original, e serve a
//   tela de artilheiros.
//
//   ESCALAÇÕES dos jogos numa janela em torno de hoje, via get_futebol_fixture_extras.
//   Entrou porque o campo da aba de Escalações mostra os onze de cada lado, e com
//   só os artilheiros a cobertura era de 6 e 9 titulares em 22 — um terço com
//   rosto e dois terços com sigla, que lê como defeito e não como fallback.
//
// Idempotente (upsert). Deploy com verify_jwt=false; protegida pelo header
// x-cron-secret (CRON_SECRET) — o gate por ?token= hardcoded do protótipo dev
// foi substituído ao versionar.
// Body: { pairs?: [{c,s}], dias?: number, fontes?: ('leaders'|'escalacoes')[] }.
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "futebol-player-photos";
// Todas as competições que o produto cobre hoje, e não só as brasileiras.
//
// A lista antiga tinha Brasileirão e Copa do Mundo, e ficou para trás quando as
// ligas europeias entraram: 137 fotos no bucket contra 593 times em catálogo, e
// nenhum artilheiro de Bundesliga, Premier League, La Liga, Ligue 1, Serie A,
// Primeira Liga ou Champions. A tela de artilheiros mostrava silhueta.
//
// Sem temporada anterior de propósito: o artilheiro de 2024 não aparece em tela
// nenhuma, e cada par é uma varredura a mais.
const DEFAULT_PAIRS = [
  { c: "brasileirao", s: 2026 },
  { c: "serie_b", s: 2026 },
  { c: "copa_do_brasil", s: 2026 },
  { c: "libertadores", s: 2026 },
  { c: "sudamericana", s: 2026 },
  { c: "premier_league", s: 2026 },
  { c: "la_liga", s: 2026 },
  { c: "bundesliga", s: 2026 },
  { c: "serie_a_ita", s: 2026 },
  { c: "ligue_1", s: 2026 },
  { c: "primeira_liga", s: 2026 },
  { c: "champions_league", s: 2026 },
  { c: "copa_mundo", s: 2026 },
];

/**
 * Quantos dias para trás e para frente varrer atrás de escalação.
 *
 * Três de propósito, e não a temporada inteira: o que a tela desenha é o jogo
 * que está por vir ou acabou de sair, e cada dia a mais é uma rodada de RPCs
 * dentro do tempo da edge. O `jaTem` segura o resto — quem já foi baixado numa
 * passada anterior não volta a ser.
 */
const DIAS_PADRAO = 3;

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
  let force = false;
  let dias = DIAS_PADRAO;
  let fontes: string[] = ["leaders", "escalacoes"];
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.pairs) && body.pairs.length > 0) {
      pairs = body.pairs;
    }
    if (Number.isFinite(body?.dias)) dias = Number(body.dias);
    if (Array.isArray(body?.fontes) && body.fontes.length > 0) fontes = body.fontes;
    force = body?.force === true;
  } catch {
    // sem body
  }

  const ids = new Set<number>();

  if (fontes.includes("leaders")) {
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
  }

  // Escalações da janela. Um jogo por RPC, porque é assim que o extras é servido
  // — não existe endpoint de "todas as escalações", e a tabela de fatos não está
  // no schema que o PostgREST expõe.
  let jogosLidos = 0;
  if (fontes.includes("escalacoes")) {
    const agora = Date.now();
    const iso = (delta: number) => new Date(agora + delta * 86400000).toISOString();
    const { data: jogos } = await supabase
      .from("fixtures")
      .select("fixture_id")
      .gte("kickoff_utc", iso(-dias))
      .lte("kickoff_utc", iso(dias));

    for (const j of jogos ?? []) {
      const { data, error } = await supabase.rpc("get_futebol_fixture_extras", {
        p_fixture_id: j.fixture_id,
      });
      if (error || !data) continue;
      jogosLidos++;
      for (const x of data.lineup_players ?? []) {
        if (x && x.player_id) ids.add(Number(x.player_id));
      }
    }
  }

  // O que já está no bucket não é baixado de novo.
  //
  // Sem isto, uma passada com as treze competições rebaixa CENTENAS de imagens
  // que não mudaram — e a função estoura o tempo da edge antes de chegar nas que
  // faltam. Com `force: true` no body ela volta a baixar tudo, que é o caminho
  // para quando a fonte trocar a arte.
  const jaTem = new Set<string>();
  if (!force) {
    const { data: existentes } = await supabase.storage.from(BUCKET).list("", { limit: 10000 });
    for (const f of existentes ?? []) jaTem.add(f.name);
  }

  let mirrored = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    if (jaTem.has(`${id}.png`)) { skipped++; continue; }
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
  return json({ ok: true, total: ids.size, jogosLidos, mirrored, skipped, failed });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
