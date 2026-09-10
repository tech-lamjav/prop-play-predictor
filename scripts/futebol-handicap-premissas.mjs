// ============================================================================
// As premissas do handicap asiático, medidas contra resultado
// ============================================================================
// Uso:
//   node scripts/futebol-handicap-premissas.mjs
//
// Credencial: `SUPABASE_ACCESS_TOKEN` do ambiente, ou de `.env.local`. Só faz
// SELECT, com `read_only` no endpoint. Nunca imprime segredo.
//
// `scripts/futebol-roi.mjs` mede o BOARD: o que foi publicado. Este mede o
// UNIVERSO: toda linha de handicap que teve preço, publicada ou não. São
// perguntas diferentes. A primeira responde "quanto o produto rendeu"; esta
// responde "a premissa separa ganhador de perdedor", e para isso é preciso ver
// também as linhas que a porta recusou — senão a amostra é o próprio filtro que
// se quer avaliar.
//
// ── Quatro armadilhas que este script existe para não deixar você cair ──────
//
// 1. A LINHA TEM DUAS ÓTICAS. `int_futebol_premissas_ah.line_value` e
//    `fact_odds_snapshot.line_value` guardam a linha na ótica do MANDANTE;
//    `side_handicap` guarda na ótica do time apostado. Casar preço com premissa
//    por `side_handicap` casa o azarão de um lado com a odd do favorito do
//    outro, e o relatório sai com ROI de +145% sem reclamar de nada. O join
//    correto é por `line_value`: contra as 600 linhas publicadas, a melhor odd
//    reconstruída assim bate com a que foi ao ar em 598 casos.
//
// 2. `int_futebol_odds_devig` NÃO SERVE DE HISTÓRICO. Ela é recalculada a cada
//    rodada do dbt, então o preço que está lá hoje não é o que foi publicado.
//    Contra as linhas já liquidadas, a odd dela é em média 0,75 mais alta, e o
//    ROI sai +33% em vez de -10,6%. O preço honesto se reconstrói de
//    `fact_odds_snapshot`, que é imutável.
//
// 3. MEDIANA E MELHOR ODD RESPONDEM COISAS DIFERENTES. A melhor odd entre as
//    casas é o que o assinante consegue, e é o número do produto. A mediana é o
//    mercado, e é a régua para comparar recortes sem que o vencedor de cada
//    recorte seja "quem teve uma casa fora da curva". As duas saem.
//
// 4. TAMANHO DE HANDICAP CONFUNDE TUDO. Um -2,5 perde muito mais que um -0,5,
//    e as premissas do favorito acendem mais nos handicaps grandes. Comparar
//    "premissa acesa" com "premissa apagada" sem separar por linha mede o
//    tamanho do handicap e chama isso de premissa. Por isso a coluna que decide
//    é a DIFERENÇA ESTRATIFICADA: acesa contra apagada dentro de cada linha, e
//    só depois somada.
// ============================================================================

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liquidar, lucroDaAposta, ehAcerto } from './futebol-roi.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJETO_PRD = 'lavclmlvvfzkblrstojd';

/** As nove colunas de premissa do mart. A nona não existe no catálogo da tela. */
const PREMISSAS = [
  'supremacia', 'tende_golear', 'adversario_fragil_fora', 'mando_forte',
  'sem_rodizio', 'raramente_perde_por_2', 'defesa_fora_solida',
  'favorito_irregular', 'handicap_alto',
];

// ── consulta ───────────────────────────────────────────────────────────────

function tokenDeAcesso() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  let env;
  try {
    env = readFileSync(resolve(RAIZ, '.env.local'), 'utf8');
  } catch {
    throw new Error('sem SUPABASE_ACCESS_TOKEN no ambiente e sem .env.local para ler.');
  }
  const m = /^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(env);
  if (!m) throw new Error('SUPABASE_ACCESS_TOKEN não encontrado no ambiente nem em .env.local');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function consultar(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJETO_PRD}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenDeAcesso()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, read_only: true }),
  });
  const corpo = await r.text();
  if (!r.ok) throw new Error(`consulta recusada (HTTP ${r.status}): ${corpo.slice(0, 300)}`);
  const j = JSON.parse(corpo);
  if (!Array.isArray(j)) throw new Error(`consulta falhou: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

/**
 * Toda linha de handicap com preço, em jogo já encerrado.
 *
 * O corte de três casas é o mesmo piso que o produto usa para não publicar
 * linha de casa única, e as oito linhas de meio gol são as únicas que o produto
 * publica — deixar o quarto de gol entrar aqui compararia o método com um
 * universo que ele não aposta.
 */
const SQL_UNIVERSO = `
with odds as (
  select fixture_id, outcome_side, line_value,
         max(odd_decimal) melhor,
         percentile_cont(0.5) within group (order by odd_decimal) mediana,
         count(distinct bookmaker_id) casas
  from futebol.fact_odds_snapshot
  where market_name = 'Asian Handicap'
    and collection_window = 't24h'
    and line_value in (-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5)
  group by 1, 2, 3
  having count(distinct bookmaker_id) >= 3
)
select a.fixture_id, a.outcome, a.line_value, a.side_handicap,
       a.is_favorito, a.is_azarao, a.competition, a.pts_premissas,
       ${PREMISSAS.map((p) => `a.${p}`).join(', ')},
       o.melhor, o.mediana, o.casas,
       f.goals_home, f.goals_away
from futebol.int_futebol_premissas_ah a
join odds o
  on o.fixture_id = a.fixture_id
 and o.outcome_side = a.outcome
 and o.line_value = a.line_value
join futebol.fact_fixtures f on f.fixture_id = a.fixture_id
where f.status_short in ('FT', 'AET', 'PEN')
`;

/** O board publicado, com a foto de quando cada oportunidade nasceu. */
const SQL_BOARD = `
with primeiro as (
  select distinct on (h.opportunity_key)
    h.fixture_id, h.outcome, h.line_value, h.best_odd, h.edge, h.score,
    h.pts_premissas, h.competition, h.linha_sharp_confirma, h.modelo_api_concorda
  from futebol.fact_value_opportunities_hist h
  where h.score_versao = 'contexto_v1' and h.market = 'asian_handicap'
  order by h.opportunity_key, h.dbt_valid_from asc
)
select p.*, a.side_handicap, a.is_favorito,
       ${PREMISSAS.map((p) => `a.${p}`).join(', ')},
       f.status_short, f.goals_home, f.goals_away
from primeiro p
join futebol.int_futebol_premissas_ah a
  on a.fixture_id = p.fixture_id and a.outcome = p.outcome and a.line_value = p.line_value
join futebol.fact_fixtures f on f.fixture_id = p.fixture_id
`;

// ── estatística ────────────────────────────────────────────────────────────

/** Média, erro-padrão e taxa de acerto. Ver o cabeçalho de `futebol-roi.mjs`. */
function estatistica(linhas, campo = 'lucro') {
  const n = linhas.length;
  if (n === 0) return { n: 0, roi: 0, ep: 0, taxa: null };
  const lucros = linhas.map((l) => l[campo]);
  const media = lucros.reduce((a, b) => a + b, 0) / n;
  const variancia = n > 1 ? lucros.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1) : 0;
  const decididas = linhas.filter((l) => l.resultado !== 'push').length;
  return {
    n,
    roi: media,
    ep: Math.sqrt(variancia / n),
    taxa: decididas ? linhas.filter((l) => ehAcerto(l.resultado)).length / decididas : null,
  };
}

/**
 * Quanto a premissa acrescenta, já descontado o tamanho do handicap.
 *
 * Dentro de cada linha compara acesa contra apagada; depois soma as diferenças
 * pesadas pelo número de linhas acesas. Célula com menos de dez de cada lado
 * fica de fora: ela não mede, só balança o total.
 */
function diferencaEstratificada(linhas, premissa) {
  const celulas = new Map();
  for (const l of linhas) {
    const k = Number(l.side_handicap);
    if (!celulas.has(k)) celulas.set(k, []);
    celulas.get(k).push(l);
  }
  let peso = 0, soma = 0, variancia = 0;
  let nAcesa = 0, roiAcesa = 0, nApagada = 0, roiApagada = 0;
  for (const [, v] of celulas) {
    const acesa = v.filter((x) => x[premissa] === true);
    const apagada = v.filter((x) => x[premissa] === false);
    if (acesa.length < 10 || apagada.length < 10) continue;
    const a = estatistica(acesa), b = estatistica(apagada);
    peso += a.n;
    soma += a.n * (a.roi - b.roi);
    variancia += a.n * a.n * (a.ep ** 2 + b.ep ** 2);
    nAcesa += a.n; roiAcesa += a.n * a.roi;
    nApagada += b.n; roiApagada += b.n * b.roi;
  }
  if (!peso) return null;
  return {
    dif: soma / peso, ep: Math.sqrt(variancia) / peso,
    nAcesa, roiAcesa: roiAcesa / nAcesa,
    nApagada, roiApagada: roiApagada / nApagada,
  };
}

// ── apresentação ───────────────────────────────────────────────────────────

const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)}%`);
const pp = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}pp`;

function cabecalho(titulo, coluna = 'ROI') {
  console.log(`\n### ${titulo}`);
  console.log(`| recorte | n | taxa | ${coluna} | erro-padrão |`);
  console.log('|---|---:|---:|---:|---:|');
}

function linha(rotulo, linhas, campo = 'lucro') {
  const e = estatistica(linhas, campo);
  console.log(`| ${rotulo} | ${e.n} | ${pct(e.taxa)} | ${pct(e.roi)} | ±${(e.ep * 100).toFixed(1)}pp |`);
}

function tabela(titulo, linhas, chave, campo = 'lucro', coluna = 'ROI') {
  const grupos = new Map();
  for (const l of linhas) {
    const k = chave(l);
    if (k == null) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(l);
  }
  cabecalho(titulo, coluna);
  for (const [k, v] of [...grupos.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
    linha(k, v, campo);
  }
}

const faixaDeOdd = (o) => {
  const x = Number(o);
  if (x < 1.4) return '1.00–1.39';
  if (x < 1.6) return '1.40–1.59';
  if (x < 2.0) return '1.60–1.99';
  if (x < 2.6) return '2.00–2.59';
  if (x < 4.0) return '2.60–3.99';
  return '4.00+';
};

// ── programa ───────────────────────────────────────────────────────────────

function liquidarLinhas(brutas, odd, extras = () => ({})) {
  const saida = [];
  for (const l of brutas) {
    const r = liquidar('asian_handicap', l.outcome, l.line_value, l.goals_home, l.goals_away);
    if (r == null) continue;
    saida.push({
      ...l, ...extras(l), resultado: r,
      lado: l.is_favorito ? 'favorito' : 'azarao',
      lucro: lucroDaAposta(r, Number(odd(l))),
    });
  }
  return saida;
}

async function principal() {
  const universo = liquidarLinhas(await consultar(SQL_UNIVERSO), (l) => l.melhor, (l) => ({
    lucroMediana: lucroDaAposta(
      liquidar('asian_handicap', l.outcome, l.line_value, l.goals_home, l.goals_away),
      Number(l.mediana),
    ),
  }));
  const board = liquidarLinhas(
    (await consultar(SQL_BOARD)).filter((l) => ['FT', 'AET', 'PEN'].includes(l.status_short)),
    (l) => l.best_odd,
  );

  console.log('# Premissas do handicap asiático, contra resultado');
  console.log(`\n> Fonte: projeto ${PROJETO_PRD} (PRODUÇÃO), somente leitura.`);
  console.log(
    `\n${universo.length} linhas cotadas e liquidadas no universo · ` +
    `${board.length} delas publicadas no board.`,
  );

  const g = estatistica(universo);
  const gm = estatistica(universo, 'lucroMediana');
  console.log(
    `\nUniverso inteiro: taxa ${pct(g.taxa)} · ROI na melhor odd ${pct(g.roi)} ± ` +
    `${(g.ep * 100).toFixed(1)}pp · na mediana ${pct(gm.roi)}`,
  );

  const favorito = universo.filter((l) => l.lado === 'favorito');
  const azarao = universo.filter((l) => l.lado === 'azarao');

  tabela('Universo, por lado', universo, (l) => l.lado);
  tabela('Universo, por tamanho do handicap', universo, (l) => Number(l.side_handicap).toFixed(1).padStart(5));
  tabela('Universo, por faixa de odd', universo, (l) => faixaDeOdd(l.melhor));
  tabela('Universo, por mando', universo, (l) => (l.outcome === 'Home' ? 'mandante' : 'visitante'));

  for (const [nome, linhas] of [['FAVORITO', favorito], ['AZARÃO', azarao]]) {
    const e = estatistica(linhas);
    console.log(`\n### ${nome} — o que cada premissa acrescenta (${linhas.length} linhas, ROI base ${pct(e.roi)})`);
    console.log('| premissa | n acesa | ROI acesa | n apagada | ROI apagada | diferença estratificada |');
    console.log('|---|---:|---:|---:|---:|---:|');
    for (const p of PREMISSAS) {
      const d = diferencaEstratificada(linhas, p);
      if (!d) continue;
      console.log(
        `| ${p} | ${d.nAcesa} | ${pct(d.roiAcesa)} | ${d.nApagada} | ${pct(d.roiApagada)} | ` +
        `${pp(d.dif)} ± ${(d.ep * 100).toFixed(1)} |`,
      );
    }
  }

  cabecalho('Empilhando as premissas que separam');
  linha('favorito, base', favorito);
  linha('favorito, supremacia', favorito.filter((l) => l.supremacia));
  linha('favorito, supremacia + tende_golear', favorito.filter((l) => l.supremacia && l.tende_golear));
  linha('azarão, base', azarao);
  linha('azarão, favorito_irregular', azarao.filter((l) => l.favorito_irregular));
  const duas = azarao.filter((l) => l.favorito_irregular && l.raramente_perde_por_2);
  linha('azarão, favorito_irregular + raramente_perde_por_2', duas);
  linha('as duas, odd entre 1,40 e 2,00', duas.filter((l) => Number(l.melhor) >= 1.4 && Number(l.melhor) < 2.0));
  linha('as duas, odd entre 1,40 e 2,00, visitante', duas.filter(
    (l) => Number(l.melhor) >= 1.4 && Number(l.melhor) < 2.0 && l.outcome === 'Away',
  ));

  cabecalho('Board publicado, pelo preço que a nota não olha');
  linha('vantagem acima de zero', board.filter((l) => Number(l.edge) > 0));
  linha('vantagem entre -2% e zero', board.filter((l) => Number(l.edge) <= 0 && Number(l.edge) > -0.02));
  linha('vantagem abaixo de -2%', board.filter((l) => Number(l.edge) <= -0.02));
  tabela('Board publicado, por faixa de odd', board, (l) => faixaDeOdd(l.best_odd));
  tabela('Board publicado, por campeonato', board, (l) => l.competition);

  console.log(
    '\n> Erro-padrão maior que a diferença entre dois recortes significa que a ' +
    'diferença ainda não existe. Recorte com menos de 30 linhas não decide nada.',
  );
}

principal().catch((e) => {
  console.error(String(e.message ?? e));
  process.exit(1);
});
