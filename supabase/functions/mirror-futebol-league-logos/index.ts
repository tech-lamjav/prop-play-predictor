// ============================================================
// mirror-futebol-league-logos — espelha os brasões dos campeonatos no Storage
// ============================================================
// Mesmo motivo do mirror-futebol-team-logos: a api-sports entrega a imagem
// servidor-a-servidor, mas bloqueia o <img> no navegador (hotlink). A função
// baixa o brasão de cada liga e sobe no bucket público `futebol-league-logos`.
//
// Duas diferenças em relação ao mirror dos times:
//
// 1. O arquivo é salvo pelo SLUG DO MART (`brasileirao.png`), não pelo id da
//    API. Assim o front monta a URL com o que já tem em mãos
//    (futebol.fact_fixtures.competition) e ninguém precisa carregar o id da
//    API-Football pela tela. O de-para mora aqui e em COMPETITION_API_IDS
//    (src/utils/futebol-competitions.ts); liga nova entra nos dois.
//
// 2. A imagem é REDIMENSIONADA antes de subir. O original vem em ~150px e 80 a
//    160 KB (PNG de 32 bits) para aparecer a 26px na tela. O resize para 96px
//    derruba pra faixa de 1 a 10 KB. Se o encoder falhar por qualquer motivo, o
//    original sobe do mesmo jeito: brasão pesado é melhor que brasão faltando.
//
// Idempotente (upsert). Deploy com verify_jwt=false; protegida pelo header
// x-cron-secret (CRON_SECRET), padrão dos outros mirrors. Disparo manual: são
// ~12 arquivos que quase nunca mudam, não vale cron.
//
// Disparo (SQL editor, o segredo sai do vault e não aparece em lugar nenhum):
//   select net.http_post(
//     url := 'https://<ref>.supabase.co/functions/v1/mirror-futebol-league-logos',
//     headers := jsonb_build_object(
//       'Content-Type', 'application/json',
//       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
//                         where name = 'ingest_fixtures_cron_secret')),
//     body := '{}'::jsonb);
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

const BUCKET = "futebol-league-logos";
const LADO = 96; // a tela usa 26px; 96 cobre retina com folga

// slug do mart → id da liga na API-Football (mesma numeração de leagues_config).
// Copa do Mundo (id 1) fica de fora de propósito: o CDN responde 200 mas entrega
// o escudo cinza de "sem imagem", que em tela fica pior que o ícone de troféu.
// Se um dia subirem o brasão de verdade, é só voltar `copa_mundo: 1` aqui.
const LIGAS: Record<string, number> = {
  champions_league: 2,
  sudamericana: 11,
  libertadores: 13,
  premier_league: 39,
  ligue_1: 61,
  brasileirao: 71,
  serie_b: 72,
  copa_do_brasil: 73,
  bundesliga: 78,
  primeira_liga: 94,
  serie_a_ita: 135,
  la_liga: 140,
};

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
    let mirrored = 0;
    let failed = 0;
    const erros: string[] = [];
    const tamanhos: Record<string, number> = {};

    for (const [slug, leagueId] of Object.entries(LIGAS)) {
      try {
        const res = await fetch(`https://media.api-sports.io/football/leagues/${leagueId}.png`, {
          redirect: "follow",
        });
        if (!res.ok) { failed++; erros.push(`${slug}: http ${res.status}`); continue; }
        const original = new Uint8Array(await res.arrayBuffer());
        if (original.byteLength === 0) { failed++; erros.push(`${slug}: vazio`); continue; }

        let bytes = original;
        try {
          const img = await Image.decode(original);
          const escala = LADO / Math.max(img.width, img.height);
          if (escala < 1) {
            bytes = await img
              .resize(Math.round(img.width * escala), Math.round(img.height * escala))
              .encode();
          }
        } catch (e) {
          erros.push(`${slug}: resize falhou (subiu original) — ${(e as Error)?.message ?? "erro"}`);
        }

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(`${slug}.png`, bytes, { contentType: "image/png", upsert: true });
        if (upErr) { failed++; erros.push(`${slug}: ${upErr.message}`); continue; }
        mirrored++;
        tamanhos[slug] = bytes.byteLength;
      } catch (e) {
        failed++;
        erros.push(`${slug}: ${(e as Error)?.message ?? "erro"}`);
      }
    }

    return json({ ok: true, total: Object.keys(LIGAS).length, mirrored, failed, erros, tamanhos });
  } catch (e) {
    console.error("mirror-futebol-league-logos error:", e);
    return json({ error: (e as Error)?.message ?? "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
