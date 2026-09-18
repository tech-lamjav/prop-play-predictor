// ============================================================================
// A âncora da evidência, medida em produção (#464)
// ============================================================================
// Uso:
//   node scripts/futebol-evidencia-ancorada.mjs
//   node scripts/futebol-evidencia-ancorada.mjs --competicao="Brasileirão"
//
// Credencial: `SUPABASE_ACCESS_TOKEN` do ambiente, ou de `.env.local`. Só faz
// SELECT, com `read_only` no endpoint. Nunca imprime segredo.
//
// ── O que este script responde ──────────────────────────────────────────────
//
// `superioridade_tabela` e `h2h_favoravel` mostram na tela um número que vinha
// da RPC 094 SEM âncora na data do jogo: a classificação de hoje e o confronto
// direto inteiro, inclusive partidas posteriores ao jogo. A #464 ancorou as
// duas. Este script mede se a âncora funcionou.
//
// ── Por que ele NÃO mede "veredito trocado" contra a regra ──────────────────
//
// Porque a regra não existe aqui. `src/utils/futebol-criterio.ts` só transcreve
// os critérios do mercado de Gols; o corte destas duas vive no dbt, e a seção 7
// de `docs/futebol-metodologia-por-mercado.md` registra isso como lacuna.
//
// Então a pergunta é invertida. O booleano do mart É point-in-time por
// construção: ele foi calculado sobre os jogos anteriores ao apito. Logo, o
// número ANCORADO deve reproduzi-lo e o número DE HOJE não. A medição vira
// concordância com o mart, e a prova da âncora é a distância entre as duas
// taxas de discordância.
//
// ── Três armadilhas ─────────────────────────────────────────────────────────
//
// 1. O CORTE É INFERIDO, NÃO SABIDO. Para virar veredito, o número precisa de
//    um limiar. Ele é ajustado aqui, procurando o que melhor reproduz o mart.
//    Ajustar e avaliar na mesma amostra infla o resultado, então a amostra é
//    partida: o corte sai da primeira metade e a taxa é medida na segunda.
//
// 2. O CORTE É AJUSTADO SOBRE O ANCORADO, e depois aplicado aos DOIS. Ajustar
//    um corte para cada rota mediria "qual rota tem corte melhor", que é outra
//    pergunta. Aqui o corte é um só e o que muda é de onde vem o número.
//
// 3. FOTO DA ÉPOCA SÓ EXISTE DESDE 11/06/2026. Jogo anterior a isso não tem
//    classificação ancorada — na tela ele passa a OMITIR o número, e aqui ele
//    sai da conta da `superioridade_tabela` em vez de contar como acerto ou
//    erro. A linha "sem foto" do relatório diz quantos são: é o custo da
//    decisão de omitir, e precisa ficar visível.
//    O `h2h_favoravel` não tem esse piso: a âncora dele é a data de cada
//    confronto, então cobre o histórico inteiro.
// ============================================================================

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJETO_PRD = 'lavclmlvvfzkblrstojd';

// ── consulta ───────────────────────────────────────────────────────────────

let tokenEmCache = null;

/**
 * O `.env.local` da raiz, ou do primeiro diretório acima que o tenha.
 *
 * Subir importa: este repositório é trabalhado em worktrees sob
 * `.claude/worktrees/`, e `.env.local` é ignorado pelo git — então ele existe no
 * checkout principal e NUNCA numa worktree. Olhando só a raiz, o script falha
 * exatamente no modo normal de trabalho daqui, que é o contrário de uma medição
 * reproduzível por outra pessoa.
 */
function envLocal() {
  let dir = RAIZ;
  for (let i = 0; i < 6; i++) {
    try {
      return readFileSync(resolve(dir, '.env.local'), 'utf8');
    } catch {
      const acima = dirname(dir);
      if (acima === dir) return null;
      dir = acima;
    }
  }
  return null;
}

function tokenDeAcesso() {
  if (tokenEmCache) return tokenEmCache;
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    tokenEmCache = process.env.SUPABASE_ACCESS_TOKEN;
    return tokenEmCache;
  }
  const env = envLocal();
  if (env == null) {
    throw new Error('sem SUPABASE_ACCESS_TOKEN no ambiente e sem .env.local para ler');
  }
  const m = env.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m);
  if (!m) throw new Error('.env.local não tem SUPABASE_ACCESS_TOKEN');
  tokenEmCache = m[1].trim();
  return tokenEmCache;
}

/**
 * Uma consulta somente leitura na produção.
 *
 * O status HTTP é checado antes do corpo, como fazem os outros scripts: sem
 * isso, um 401 ou um HTML de gateway viram `SyntaxError: Unexpected token '<'`
 * e o motivo real da falha se perde.
 */
async function consultar(sql) {
  let r;
  try {
    r = await fetch(`https://api.supabase.com/v1/projects/${PROJETO_PRD}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenDeAcesso()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql, read_only: true }),
    });
  } catch (e) {
    throw new Error(`não consegui falar com a API do Supabase: ${e.message}`);
  }
  const corpo = await r.text();
  if (!r.ok) throw new Error(`consulta recusada (HTTP ${r.status}): ${corpo.slice(0, 300)}`);
  try {
    return JSON.parse(corpo);
  } catch {
    throw new Error(`resposta não era JSON: ${corpo.slice(0, 300)}`);
  }
}

// ── as duas leituras do mesmo número ────────────────────────────────────────
//
// `atual` reproduz o que a RPC fazia ANTES da #464: classificação pela foto mais
// recente da competição, confronto direto sem filtro de data.
// `ancorado` reproduz o que ela faz DEPOIS: foto anterior à data do jogo,
// confronto anterior ao apito.

const CONSULTA = `
with jogos as (
  select p.fixture_id, p.competition, p.season, p.outcome,
         p.superioridade_tabela as mart_tabela,
         p.h2h_favoravel        as mart_h2h,
         f.home_team_id, f.away_team_id, f.date_utc, f.kickoff_utc
  from futebol.int_futebol_premissas_1x2 p
  join futebol.fact_fixtures f on f.fixture_id = p.fixture_id
  -- lower(), e não o literal 'Home': o mercado de Resultado grava a saída
  -- capitalizada, e comparar com o caso errado devolve ZERO linha sem erro
  -- nenhum, que foi exatamente como esta medição saiu vazia da primeira vez.
  -- (Sem crase neste comentário: ele vive dentro de um template literal.)
  where lower(p.outcome) in ('home','away')
    and f.status_short in ('FT','AET','PEN')
    and f.kickoff_utc is not null
),
lado as (
  select j.*,
         case when lower(j.outcome) = 'home' then j.home_team_id else j.away_team_id end as time_id,
         case when lower(j.outcome) = 'home' then j.away_team_id else j.home_team_id end as adv_id
  from jogos j
),
-- classificação como a RPC via ANTES: a foto mais recente da competição
tabela_atual as (
  select distinct on (s.competition, s.season, s.team_id)
         s.competition, s.season, s.team_id, s."rank" as pos, s.points as pts
  from futebol.fact_standings_snapshot s
  order by s.competition, s.season, s.team_id, s.snapshot_date desc
),
-- classificação como a RPC vê DEPOIS: a foto anterior à data do jogo
tabela_ancorada as (
  select l.fixture_id, l.outcome, l.time_id, l.adv_id,
         (select s."rank" from futebol.fact_standings_snapshot s
           where s.competition = l.competition and s.season = l.season
             and s.team_id = l.time_id and s.snapshot_date < l.date_utc
           order by s.snapshot_date desc limit 1) as pos_time,
         (select s.points from futebol.fact_standings_snapshot s
           where s.competition = l.competition and s.season = l.season
             and s.team_id = l.time_id and s.snapshot_date < l.date_utc
           order by s.snapshot_date desc limit 1) as pts_time,
         (select s."rank" from futebol.fact_standings_snapshot s
           where s.competition = l.competition and s.season = l.season
             and s.team_id = l.adv_id and s.snapshot_date < l.date_utc
           order by s.snapshot_date desc limit 1) as pos_adv,
         (select s.points from futebol.fact_standings_snapshot s
           where s.competition = l.competition and s.season = l.season
             and s.team_id = l.adv_id and s.snapshot_date < l.date_utc
           order by s.snapshot_date desc limit 1) as pts_adv
  from lado l
),
h2h as (
  select l.fixture_id, l.outcome,
         count(*) filter (where h.kickoff_utc < l.kickoff_utc) as anc_jogos,
         count(*) filter (
           where h.kickoff_utc < l.kickoff_utc
             and ((h.home_team_id = l.time_id and h.goals_home > h.goals_away)
               or (h.away_team_id = l.time_id and h.goals_away > h.goals_home))
         ) as anc_vitorias,
         count(*) as atu_jogos,
         count(*) filter (
           where (h.home_team_id = l.time_id and h.goals_home > h.goals_away)
              or (h.away_team_id = l.time_id and h.goals_away > h.goals_home)
         ) as atu_vitorias
  from lado l
  join futebol.fact_h2h h
    on (h.home_team_id = l.home_team_id and h.away_team_id = l.away_team_id)
    or (h.home_team_id = l.away_team_id and h.away_team_id = l.home_team_id)
  where h.goals_home is not null and h.goals_away is not null
  group by l.fixture_id, l.outcome
)
select l.fixture_id, l.competition, l.date_utc,
       l.mart_tabela, l.mart_h2h,
       ta.pts - tb.pts              as atu_dif_pts,
       an.pts_time - an.pts_adv     as anc_dif_pts,
       h.atu_vitorias, h.atu_jogos, h.anc_vitorias, h.anc_jogos
from lado l
left join tabela_atual ta on ta.competition = l.competition and ta.season = l.season and ta.team_id = l.time_id
left join tabela_atual tb on tb.competition = l.competition and tb.season = l.season and tb.team_id = l.adv_id
left join tabela_ancorada an on an.fixture_id = l.fixture_id and an.outcome = l.outcome
left join h2h h on h.fixture_id = l.fixture_id and h.outcome = l.outcome
order by l.date_utc
`;

// ── o corte inferido ────────────────────────────────────────────────────────

/**
 * O limiar que melhor reproduz o booleano do mart, procurado por varredura.
 *
 * Devolve `null` quando não há amostra suficiente: melhor não medir do que
 * medir contra um corte tirado de vinte linhas.
 */
export function corteQueMelhorExplica(amostra, valorDe) {
  const valores = amostra.map(valorDe).filter((v) => v != null && Number.isFinite(v));
  if (valores.length < 200) return null;

  const candidatos = [...new Set(valores)].sort((a, b) => a - b);
  let melhor = { corte: null, acertos: -1 };
  for (const c of candidatos) {
    let acertos = 0;
    for (const l of amostra) {
      const v = valorDe(l);
      if (v == null) continue;
      if ((v >= c) === l.mart) acertos++;
    }
    if (acertos > melhor.acertos) melhor = { corte: c, acertos };
  }
  return melhor.corte;
}

export const discordancia = (amostra, valorDe, corte) => {
  let n = 0;
  let erros = 0;
  for (const l of amostra) {
    const v = valorDe(l);
    if (v == null) continue;
    n++;
    if ((v >= corte) !== l.mart) erros++;
  }
  return { n, erros, taxa: n ? erros / n : null };
};

// ── apresentação ────────────────────────────────────────────────────────────

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);

function relatorio(titulo, amostraBruta, atual, ancorado, semDado) {
  console.log(`\n### ${titulo}`);

  // Só linhas em que AS DUAS rotas têm valor. Medir uma em 8.537 linhas e a
  // outra em 6.383 compara populações diferentes, e aí a diferença de taxa
  // carrega "quais linhas entraram" junto com "de onde veio o número" — que é
  // o defeito que essa medição existe para não cometer.
  const amostra = amostraBruta.filter((l) => atual(l) != null && ancorado(l) != null);
  const fora = amostraBruta.length - amostra.length;

  // Alternado, e NÃO as duas metades por data. Ordenar por data e partir ao
  // meio põe os jogos antigos de um lado só: as fotos de classificação começam
  // em 11/06/2026, então a metade de ajuste ficava sem nenhum valor e o corte
  // nunca saía. É a mesma armadilha registrada na #448 sobre estratificar por
  // data em vez de por competição.
  const ajuste = amostra.filter((_, i) => i % 2 === 0);
  const aval = amostra.filter((_, i) => i % 2 === 1);

  const corte = corteQueMelhorExplica(ajuste, ancorado);
  if (corte == null) {
    console.log(
      `> amostra insuficiente para inferir o corte: ${amostra.length} linhas com valor ` +
      'nas duas rotas (são precisas 200 na metade de ajuste).',
    );
    if (fora > 0) console.log(`> ${fora} linhas ficaram fora por faltar valor em alguma das rotas.`);
    return;
  }

  const a = discordancia(aval, atual, corte);
  const b = discordancia(aval, ancorado, corte);
  console.log(`> corte inferido em metade alternada da amostra: ${corte}.`);
  if (fora > 0) {
    console.log(`> ${fora} linhas fora da comparação por faltar valor em alguma das rotas.`);
  }
  console.log('\n| rota | n | discorda do mart |');
  console.log('|---|---:|---:|');
  console.log(`| como estava (foto de hoje) | ${a.n} | ${pct(a.taxa)} |`);
  console.log(`| ancorada na data do jogo | ${b.n} | ${pct(b.taxa)} |`);
  if (semDado > 0) {
    console.log(
      `\n> ${semDado} linhas sem foto da época ficaram FORA da conta: na tela elas ` +
      'passam a omitir o número, que é a decisão registrada na #464.',
    );
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const filtro = process.argv.find((a) => a.startsWith('--competicao='))?.split('=')[1] ?? null;

  const linhas = await consultar(CONSULTA);
  const usadas = filtro ? linhas.filter((l) => l.competition === filtro) : linhas;

  console.log('# A âncora da evidência (#464)');
  console.log(`\n> Fonte: projeto ${PROJETO_PRD} (PRODUÇÃO), somente leitura.`);
  console.log(`> ${usadas.length} linhas de 1X2 em jogos encerrados${filtro ? `, ${filtro}` : ''}.`);
  console.log(
    '>\n> O corte destas duas premissas não existe no repositório (vive no dbt), ' +
    'então ele é INFERIDO do próprio booleano do mart. Ver o cabeçalho do script.',
  );

  const tabela = usadas
    .filter((l) => l.mart_tabela != null)
    .map((l) => ({ ...l, mart: l.mart_tabela }));
  const semFoto = tabela.filter((l) => l.anc_dif_pts == null).length;

  relatorio(
    'superioridade_tabela — diferença de pontos',
    tabela,
    (l) => (l.atu_dif_pts == null ? null : Number(l.atu_dif_pts)),
    (l) => (l.anc_dif_pts == null ? null : Number(l.anc_dif_pts)),
    semFoto,
  );

  const h2h = usadas
    .filter((l) => l.mart_h2h != null)
    .map((l) => ({ ...l, mart: l.mart_h2h }));

  relatorio(
    'h2h_favoravel — vitórias no confronto direto',
    h2h,
    (l) => (l.atu_jogos ? Number(l.atu_vitorias) : null),
    (l) => (l.anc_jogos ? Number(l.anc_vitorias) : null),
    0,
  );
}

// Só roda quando chamado direto. Sem esta guarda, importar as funções puras num
// teste dispararia uma consulta à PRODUÇÃO no momento do import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
