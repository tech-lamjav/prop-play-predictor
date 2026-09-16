import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// O placar e o histórico concordam sobre a foto de nascimento (#436)
// ============================================================================
// Duas telas respondiam "como esta oportunidade nasceu" olhando linhas
// diferentes do snapshot: o placar filtrava a versão da metodologia ANTES de
// pegar a primeira versão, e o histórico pegava a primeira de todas. Para uma
// linha nascida antes do cutover e reavaliada depois, elas apontavam para
// vantagens diferentes — e desde a migration 146 essa vantagem decide o que
// aparece e o que some.
//
// A correção separa as duas perguntas: PREÇO e DATA vêm da primeira versão de
// todas, porque preço não mudou de escala; NOTA continua restrita a
// `contexto_v1`, porque a escala da nota mudou e somar as duas inventa uma série
// que nunca existiu.
//
// ⚠️ O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA.
// Ele prova que o SQL DIZ a coisa certa. Não prova que o Postgres FAZ: não há
// `supabase/tests`, nem pgtap, e o CI não sobe banco. A prova de comportamento
// é a consulta no cabeçalho da migration, para rodar depois de aplicar.
//
// ⚠️ E ELE AFIRMA OS DOIS CTEs INTEIROS, não trechos soltos. A revisão do #435
// mostrou por quê: com substrings, uma implementação com os filtros TROCADOS —
// preço filtrado e nota livre, exatamente o defeito — contém as mesmas palavras
// e passa verde. O corpo inteiro vê a direção; substring, não.
// ============================================================================

const RAIZ = resolve(__dirname, '../../..');
const MIGRATION = resolve(
  RAIZ,
  'supabase/migrations/20260917160000_148_placar_foto_de_nascimento.sql',
);
const SHAPE = resolve(RAIZ, 'docs/futebol-prod-deploy.sql');

const FUNCAO = 'get_futebol_oportunidades_publicadas';

/**
 * O corpo da função nomeada, do `create` até o fim.
 *
 * ⚠️ ANCORAR NA FUNÇÃO É O PONTO. A primeira versão deste arquivo procurava o
 * CTE no arquivo inteiro, e o shape file tem OUTRO `nascimento` — o da RPC do
 * detalhe do jogo (migration 146). O teste comparava com a função errada e
 * falhava sem que houvesse defeito no SQL.
 *
 * O `drop function if exists` que vem antes não casa: ali o `if exists` fica
 * entre a palavra `function` e o nome.
 */
function corpoDaFuncao(sql: string, onde: string): string {
  const inicio = sql.indexOf(`function public.${FUNCAO}(`);
  expect(inicio, `a função ${FUNCAO} não existe em ${onde}`).toBeGreaterThan(-1);
  const fim = sql.indexOf('$function$;', inicio);
  expect(fim, `a função ${FUNCAO} não termina em ${onde}`).toBeGreaterThan(inicio);
  return sql.slice(inicio, fim);
}

/** Um CTE nomeado DENTRO dessa função, sem comentários e com espaço normalizado. */
function cte(sql: string, nome: string, onde: string): string {
  const corpo = corpoDaFuncao(sql, onde);
  const inicio = corpo.indexOf(`${nome} as (`);
  expect(inicio, `o CTE ${nome} não existe em ${onde}`).toBeGreaterThan(-1);
  const fim = corpo.indexOf('\n  )', inicio);
  expect(fim, `o CTE ${nome} não termina em ${onde}`).toBeGreaterThan(inicio);
  return corpo
    .slice(inicio, fim)
    .replace(/--.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Preço, identidade e data: a primeira versão DE TODAS.
const NASCIMENTO_ESPERADO = [
  'nascimento as ( select distinct on (h.opportunity_key)',
  'h.opportunity_key, h.fixture_id, h.market, h.outcome, h.line_value,',
  'h.best_odd, h.edge, h.dbt_valid_from',
  'from futebol.fact_value_opportunities_hist h',
  'order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc',
].join(' ');

// Nota: a primeira versão da metodologia vigente.
const NOTA_ESPERADA = [
  'nota as ( select distinct on (h.opportunity_key)',
  'h.opportunity_key, h.score, h.faixa, h.score_versao,',
  'h.pts_premissas, h.penalidades, h.premissas_sem_dado,',
  'h.modelo_api_concorda, h.linha_sharp_confirma,',
  'h.pen_odd_outlier, h.pen_poucas_casas, h.pen_odd_longshot, h.pen_odd_juice',
  "from futebol.fact_value_opportunities_hist h where h.score_versao = 'contexto_v1'",
  'order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc',
].join(' ');

describe('a foto de nascimento do placar', () => {
  // Aceite 1: a vantagem de nascimento passa a ser a mesma do histórico, que
  // pega a primeira versão sem filtrar.
  it('preço e data vêm da primeira versão de todas, sem filtro de metodologia', () => {
    const migration = readFileSync(MIGRATION, 'utf8');

    expect(cte(migration, 'nascimento', 'na migration 148')).toBe(NASCIMENTO_ESPERADO);
    expect(cte(migration, 'nascimento', 'na migration 148')).not.toContain('score_versao');
  });

  // Aceite 2: a nota continua restrita a `contexto_v1`. O filtro não era
  // bobagem — ele existe para não somar duas escalas.
  it('a nota continua vindo só da metodologia vigente', () => {
    const migration = readFileSync(MIGRATION, 'utf8');

    expect(cte(migration, 'nota', 'na migration 148')).toBe(NOTA_ESPERADA);
  });

  // As duas metades na MESMA linha: o select tem de puxar preço de um CTE e nota
  // do outro. Se alguém trocar os prefixos, a divergência volta sem que os dois
  // testes acima percebam.
  it('o select puxa preço do nascimento e nota da nota', () => {
    const migration = readFileSync(MIGRATION, 'utf8').replace(/--.*$/gm, '');

    expect(migration).toMatch(/n\.dbt_valid_from,/);
    expect(migration).toMatch(/n\.best_odd,\s*n\.edge,/);
    expect(migration).toMatch(/t\.score::int,\s*t\.faixa,\s*t\.score_versao,/);
    // E a junção interna, que mantém fora quem nunca teve versão vigente.
    expect(migration).toMatch(/join\s+nota\s+t\s+on\s+t\.opportunity_key\s*=\s*n\.opportunity_key/);
  });

  // O shape file provisiona ambiente novo. Divergir dele é nascer com a versão
  // errada da regra — foi a #250, onze vezes seguidas.
  it('o shape file traz os MESMOS dois CTEs', () => {
    const shape = readFileSync(SHAPE, 'utf8');

    expect(cte(shape, 'nascimento', 'no shape file')).toBe(NASCIMENTO_ESPERADO);
    expect(cte(shape, 'nota', 'no shape file')).toBe(NOTA_ESPERADA);
  });

  // A consequência deliberada, declarada no cabeçalho: a data andando para trás
  // reclassifica como escala antiga as linhas que cruzam o cutover. Quem mexer
  // aqui depois precisa ler isso antes de "consertar" o que parece defeito.
  it('o cabeçalho declara a consequência na leitura por faixa', () => {
    const migration = readFileSync(MIGRATION, 'utf8');
    const cabecalho = migration.slice(0, migration.indexOf('create or replace function'));

    expect(cabecalho).toContain('CONSEQUÊNCIA DELIBERADA');
    expect(cabecalho).toContain('naEscalaAntiga');
  });
});
