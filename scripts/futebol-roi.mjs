#!/usr/bin/env node
// ============================================================================
// Taxa de acerto e ROI das oportunidades de futebol, medidos em produção
// ============================================================================
// Uso:
//   node scripts/futebol-roi.mjs                       # tudo que é contexto_v1
//   node scripts/futebol-roi.mjs --desde="2026-09-04 14:35"
//   node scripts/futebol-roi.mjs --fonte=picks         # só o que foi ao Telegram
//
// Credencial: `SUPABASE_ACCESS_TOKEN` do ambiente, ou de `.env.local`. Só faz
// SELECT, com `read_only` no endpoint. Nunca imprime segredo.
//
// ── Três armadilhas que este script existe para não deixar você cair ────────
//
// 1. NÃO EXISTE RESULTADO PERSISTIDO. O banco guarda a oportunidade, não se ela
//    bateu. A liquidação é calculada aqui, reproduzindo `src/utils/
//    futebol-settlement.ts` — e `src/utils/futebol-roi-script.test.ts` compara
//    as duas implementações caso a caso, porque cópia de regra diverge sozinha.
//
// 2. DATA DE DETECÇÃO NÃO É DATA DO JOGO. Oportunidade nasce para jogo futuro.
//    Cortar por detecção mede a RÉGUA que produziu a linha; cortar por apito
//    mede o RESULTADO da semana. As duas tabelas saem, e são respostas a
//    perguntas diferentes.
//
// 3. O HISTÓRICO COMEÇOU DE UMA VEZ. Em 03/09/2026 o snapshot capturou o board
//    inteiro, então esse dia concentra centenas de linhas e distorce qualquer
//    leitura por dia de detecção. E em 04/09 ~14h35 UTC o denominador da nota
//    trocou do p95 para o teto de pontos: linha anterior a isso tem Score em
//    OUTRA escala e não é comparável. Para medir a régua de hoje, use
//    `--desde="2026-09-04 14:35"`.
//
// ── O que este script NÃO consegue responder ────────────────────────────────
// ROI por PREMISSA. Quais premissas acenderam em cada linha não existe no
// Postgres — não há coluna de evidência nem array de premissas em
// `fact_value_opportunities_hist`. Isso vive só no mart, no BigQuery.
// ============================================================================

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJETO_PRD = 'lavclmlvvfzkblrstojd';

// ── a regra de liquidação, espelho de src/utils/futebol-settlement.ts ───────

/** Regra asiática pelo saldo `d`: o quanto a aposta está à frente da linha. */
function mapAsian(dRaw) {
  const d = Math.round(dRaw * 4) / 4;
  if (d >= 0.5) return 'won';
  if (d === 0.25) return 'half_won';
  if (d === 0) return 'push';
  if (d === -0.25) return 'half_lost';
  return 'lost';
}

/** `null` quando o jogo não tem placar ou o mercado é desconhecido. */
export function liquidar(market, outcome, line, goalsHome, goalsAway) {
  if (goalsHome == null || goalsAway == null) return null;
  const diff = goalsHome - goalsAway; // ótica do mandante
  const total = goalsHome + goalsAway;
  const res = diff > 0 ? 'Home' : diff < 0 ? 'Away' : 'Draw';

  switch (market) {
    case 'match_winner':
      return outcome === res ? 'won' : 'lost';
    case 'btts':
      return (outcome === 'Yes') === (goalsHome > 0 && goalsAway > 0) ? 'won' : 'lost';
    case 'double_chance': {
      const ok =
        outcome === '1X' ? res === 'Home' || res === 'Draw'
        : outcome === 'X2' ? res === 'Draw' || res === 'Away'
        : res === 'Home' || res === 'Away';
      return ok ? 'won' : 'lost';
    }
    case 'goals_over_under':
      if (line == null) return null;
      return mapAsian(outcome === 'Over' ? total - line : line - total);
    case 'asian_handicap':
      if (line == null) return null;
      return mapAsian(outcome === 'Home' ? diff + line : -diff - line);
    default:
      return null;
  }
}

/** Lucro de uma aposta plana de 1 unidade. */
export function lucroDaAposta(resultado, odd) {
  switch (resultado) {
    case 'won': return odd - 1;
    case 'half_won': return (odd - 1) / 2;
    case 'push': return 0;
    case 'half_lost': return -0.5;
    default: return -1;
  }
}

export const ehAcerto = (r) => r === 'won' || r === 'half_won';

// ── estatística ────────────────────────────────────────────────────────────

/**
 * Média, e o erro-padrão dela.
 *
 * O erro-padrão não é enfeite: com uma semana de amostra, quase toda diferença
 * entre recortes cabe dentro dele. Sem essa coluna, a tabela convida a decidir
 * peso de premissa em cima de ruído.
 */
export function estatistica(linhas) {
  const n = linhas.length;
  if (n === 0) return { n: 0, roi: 0, ep: 0, taxa: null };
  const lucros = linhas.map((l) => l.lucro);
  const media = lucros.reduce((a, b) => a + b, 0) / n;
  const variancia =
    n > 1 ? lucros.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1) : 0;
  const decididas = linhas.filter((l) => l.resultado !== 'push').length;
  const acertos = linhas.filter((l) => ehAcerto(l.resultado)).length;
  return {
    n,
    roi: media,
    ep: Math.sqrt(variancia / n),
    taxa: decididas ? acertos / decididas : null,
  };
}

// ── consulta ───────────────────────────────────────────────────────────────

function tokenDeAcesso() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const env = readFileSync(resolve(RAIZ, '.env.local'), 'utf8');
  const m = /^SUPABASE_ACCESS_TOKEN=(.*)$/m.exec(env);
  if (!m) throw new Error('SUPABASE_ACCESS_TOKEN não encontrado no ambiente nem em .env.local');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function consultar(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJETO_PRD}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenDeAcesso()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql, read_only: true }),
    },
  );
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`consulta falhou: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

/** Só o primeiro snapshot de cada oportunidade: a foto de quando ela nasceu. */
const SQL_BOARD = `
with primeiro as (
  select distinct on (h.opportunity_key)
    h.opportunity_key, h.fixture_id, h.market, h.outcome, h.line_value,
    h.best_odd, h.score, h.faixa, h.competition, h.dbt_valid_from
  from futebol.fact_value_opportunities_hist h
  where h.score_versao = 'contexto_v1'
  order by h.opportunity_key, h.dbt_valid_from asc
)
select p.*, f.status_short, f.goals_home, f.goals_away, f.kickoff_utc
from primeiro p
join futebol.fact_fixtures f on f.fixture_id = p.fixture_id
`;

const SQL_PICKS = `
select p.fixture_id, p.market, p.outcome, p.line_value,
       p.odds as best_odd, p.score, p.faixa, p.sent_date as dbt_valid_from,
       f.competition, f.status_short, f.goals_home, f.goals_away, f.kickoff_utc
from public.daily_opportunity_picks p
join futebol.fact_fixtures f on f.fixture_id = p.fixture_id
`;

// ── apresentação ───────────────────────────────────────────────────────────

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const diaBrt = (iso) =>
  new Date(new Date(`${iso}Z`).getTime() - 3 * 3600000).toISOString().slice(0, 10);

function tabela(titulo, linhas, chave, ordem) {
  const grupos = new Map();
  for (const l of linhas) {
    const k = chave(l);
    if (k == null) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(l);
  }
  console.log(`\n### ${titulo}`);
  console.log('| recorte | n | taxa | ROI | erro-padrão |');
  console.log('|---|---:|---:|---:|---:|');
  const ordenado = [...grupos.entries()].sort(
    ordem ?? ((a, b) => b[1].length - a[1].length),
  );
  for (const [k, ls] of ordenado) {
    const e = estatistica(ls);
    console.log(
      `| ${k} | ${e.n} | ${e.taxa == null ? '—' : pct(e.taxa)} | ${pct(e.roi)} | ±${(e.ep * 100).toFixed(1)}pp |`,
    );
  }
}

const FAIXA_DE_ODD = (o) => {
  const x = Number(o);
  if (x < 1.6) return '1.25–1.59';
  if (x < 2.0) return '1.60–1.99';
  if (x < 2.6) return '2.00–2.59';
  return '2.60–4.00';
};

const CORTE_DE_SCORE = (s) => {
  const n = Number(s);
  if (n < 30) return 'Score <30';
  if (n < 60) return 'Score 30–59';
  if (n < 80) return 'Score 60–79';
  return 'Score 80+';
};

const ORDEM_FAIXA = (a, b) =>
  ['Alta', 'Média', 'Baixa'].indexOf(a[0]) - ['Alta', 'Média', 'Baixa'].indexOf(b[0]);
const ALFABETICA = (a, b) => a[0].localeCompare(b[0]);

async function principal() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split('=');
      return [k, v.join('=') || true];
    }),
  );
  const fonte = args.fonte === 'picks' ? 'picks' : 'board';
  const desde = typeof args.desde === 'string' ? args.desde : null;

  const brutas = await consultar(fonte === 'picks' ? SQL_PICKS : SQL_BOARD);
  const noRecorte = desde
    ? brutas.filter((l) => String(l.dbt_valid_from) >= desde)
    : brutas;

  const liquidadas = [];
  let pendentes = 0;
  for (const l of noRecorte) {
    const encerrado = ['FT', 'AET', 'PEN'].includes(l.status_short);
    const resultado = encerrado
      ? liquidar(l.market, l.outcome, l.line_value, l.goals_home, l.goals_away)
      : null;
    if (resultado == null) { pendentes++; continue; }
    liquidadas.push({ ...l, resultado, lucro: lucroDaAposta(resultado, Number(l.best_odd)) });
  }

  const g = estatistica(liquidadas);
  console.log(`# ${fonte === 'picks' ? 'Picks enviados no Telegram' : 'Board publicado'}${desde ? ` — desde ${desde}` : ''}`);
  console.log(
    `\n${noRecorte.length} no recorte · ${g.n} liquidadas · ${pendentes} pendentes` +
    `\ntaxa ${g.taxa == null ? '—' : pct(g.taxa)} · ROI ${pct(g.roi)} ± ${(g.ep * 100).toFixed(1)}pp`,
  );

  if (g.n === 0) return;

  tabela('Por mercado', liquidadas, (l) => l.market);
  tabela('Por faixa', liquidadas, (l) => l.faixa, ORDEM_FAIXA);
  tabela('Por corte de Score', liquidadas, (l) => CORTE_DE_SCORE(l.score), ALFABETICA);
  tabela('Por faixa de odd', liquidadas, (l) => FAIXA_DE_ODD(l.best_odd), ALFABETICA);
  tabela('Por campeonato', liquidadas, (l) => l.competition);
  tabela('Por dia do JOGO (BRT)', liquidadas, (l) => diaBrt(l.kickoff_utc), ALFABETICA);
  tabela('Por dia da DETECÇÃO', liquidadas, (l) => String(l.dbt_valid_from).slice(0, 10), ALFABETICA);

  console.log(
    '\n> Erro-padrão maior que a diferença entre dois recortes significa que a ' +
    'diferença ainda não existe. Recorte com menos de 30 linhas não decide nada.',
  );
}

// Só executa quando chamado direto: o teste de paridade importa este arquivo.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  principal().catch((e) => {
    console.error(String(e.message ?? e));
    process.exit(1);
  });
}
