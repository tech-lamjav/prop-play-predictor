import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================================
// O placar e o histórico concordam sobre a foto de nascimento (#436)
// ============================================================================
// Duas telas respondiam "como esta oportunidade nasceu" olhando linhas
// diferentes do snapshot: o placar filtrava a versão da metodologia ANTES de
// pegar a primeira versão, e o histórico pega a primeira de todas. Para uma
// linha nascida antes do cutover e reavaliada depois, elas apontavam para
// vantagens diferentes — e desde a migration 146 essa vantagem decide o que
// aparece e o que some.
//
// A correção separa as duas perguntas, e SÓ O PREÇO muda de lado: `best_odd` e
// `edge` passam a vir da primeira versão de todas; a nota E A DATA continuam na
// primeira `contexto_v1`.
//
// ⚠️ POR QUE A DATA FICA COM A NOTA. A primeira versão desta mudança levou a
// data junto com o preço, e a revisão mostrou que isso era regressão: a data
// alimenta o `naEscalaAntiga` do front, que tira da tabela por faixa as linhas
// anteriores à virada do denominador. Como a nota exibida é sempre a
// `contexto_v1`, datá-la pelo nascimento escondia nota que está na escala certa.
// A mesma data ainda move o eixo por detecção, o recorte da vitrine e o filtro
// de período — que decide QUEM entra no placar.
//
// ⚠️ O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA.
// Ele prova que o SQL DIZ a coisa certa. Não prova que o Postgres FAZ: não há
// `supabase/tests`, nem pgtap, e o CI não sobe banco. A prova de comportamento é
// a consulta no cabeçalho da migration, que compara as duas RPCs na mesma linha.
// ============================================================================

const RAIZ = resolve(__dirname, '../../..');
const MIGRATION = resolve(
  RAIZ,
  'supabase/migrations/20260917160000_148_placar_foto_de_nascimento.sql',
);
const SHAPE = resolve(RAIZ, 'docs/futebol-prod-deploy.sql');
const SCRIPT = resolve(RAIZ, 'scripts/futebol-roi.mjs');

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

// Identidade e preço: a primeira versão DE TODAS. Sem data e sem nota.
const NASCIMENTO_ESPERADO = [
  'nascimento as ( select distinct on (h.opportunity_key)',
  'h.opportunity_key, h.fixture_id, h.market, h.outcome, h.line_value,',
  'h.best_odd, h.edge',
  'from futebol.fact_value_opportunities_hist h',
  'order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc',
].join(' ');

// Nota E DATA: a primeira versão da metodologia vigente.
const NOTA_ESPERADA = [
  'nota as ( select distinct on (h.opportunity_key)',
  'h.opportunity_key, h.score, h.faixa, h.score_versao,',
  'h.pts_premissas, h.penalidades, h.premissas_sem_dado,',
  'h.modelo_api_concorda, h.linha_sharp_confirma,',
  'h.pen_odd_outlier, h.pen_poucas_casas, h.pen_odd_longshot, h.pen_odd_juice,',
  'h.dbt_valid_from',
  "from futebol.fact_value_opportunities_hist h where h.score_versao = 'contexto_v1'",
  'order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc',
].join(' ');

/**
 * As quatro afirmações de DIREÇÃO, que rodam nos dois arquivos.
 *
 * O corpo dos CTEs sozinho não basta: o shape file podia trocar os prefixos no
 * select, ou perder a junção interna, e continuar verde — que é exatamente o
 * defeito da #250. Elas rodam onde o SQL vive, e não só na migration.
 */
function afirmaDirecao(sql: string, onde: string) {
  const corpo = corpoDaFuncao(sql, onde).replace(/--.*$/gm, '');

  // Preço do nascimento; data e nota, da nota.
  expect(corpo, onde).toMatch(/n\.best_odd,\s*n\.edge,/);
  expect(corpo, onde).toMatch(/t\.dbt_valid_from,/);
  expect(corpo, onde).toMatch(/t\.score::int,\s*t\.faixa,\s*t\.score_versao,/);
  // A junção interna, que mantém fora quem nunca teve versão vigente.
  expect(corpo, onde).toMatch(/join\s+nota\s+t\s+on\s+t\.opportunity_key\s*=\s*n\.opportunity_key/);
}

describe('a foto de nascimento do placar', () => {
  // Aceite 1: a vantagem de nascimento passa a ser a mesma do histórico, que
  // pega a primeira versão sem filtrar.
  it('o preço vem da primeira versão de todas, sem filtro de metodologia', () => {
    const nascimento = cte(readFileSync(MIGRATION, 'utf8'), 'nascimento', 'na migration 148');

    expect(nascimento).toBe(NASCIMENTO_ESPERADO);
    expect(nascimento).not.toContain('score_versao');
  });

  // Aceite 2: a nota continua restrita a `contexto_v1`. O filtro não era
  // bobagem — ele existe para não somar duas escalas.
  it('a nota e a data continuam vindo só da metodologia vigente', () => {
    expect(cte(readFileSync(MIGRATION, 'utf8'), 'nota', 'na migration 148')).toBe(NOTA_ESPERADA);
  });

  // As duas metades na MESMA linha: se alguém trocar os prefixos, a divergência
  // volta sem que as duas afirmações acima percebam.
  it('o select puxa preço do nascimento, e data e nota da nota', () => {
    afirmaDirecao(readFileSync(MIGRATION, 'utf8'), 'na migration 148');
  });

  // O shape file provisiona ambiente novo. Divergir dele é nascer com a versão
  // errada da regra — foi a #250, onze vezes seguidas.
  it('o shape file traz a MESMA regra, e não outra', () => {
    const shape = readFileSync(SHAPE, 'utf8');

    expect(cte(shape, 'nascimento', 'no shape file')).toBe(NASCIMENTO_ESPERADO);
    expect(cte(shape, 'nota', 'no shape file')).toBe(NOTA_ESPERADA);
    afirmaDirecao(shape, 'no shape file');
  });

  // O ADR 0003 diz que o placar segue o script de terminal. Mudar um lado sem o
  // outro faz a tela e o terminal darem números diferentes justamente nas linhas
  // que cruzam o cutover — e a paridade existente compara aritmética, não
  // consulta, então a divergência seria silenciosa.
  it('o script de terminal faz a mesma separação', () => {
    const script = readFileSync(SCRIPT, 'utf8');

    expect(script).toMatch(/with nascimento as \(/);
    expect(script).toMatch(/nota as \(\s*select distinct on \(h\.opportunity_key\)/);
    expect(script).toMatch(/h\.opportunity_key, h\.score, h\.faixa, h\.dbt_valid_from/);
    expect(script).toMatch(/join nota t on t\.opportunity_key = n\.opportunity_key/);
  });
});
