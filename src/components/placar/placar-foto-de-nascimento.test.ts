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
// ⚠️ A 162 é a ÚLTIMA definição da função, e a última é a que vale: ela leva o
// preço para a primeira versão visível. A 148 continua no repositório e continua
// dizendo a regra antiga — apontar para ela aqui seria cobrar do banco uma regra
// que ele não roda mais.
const MIGRATION = resolve(
  RAIZ,
  'supabase/migrations/20260919180000_162_placar_concorda_com_o_board.sql',
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

// Identidade e preço DE RESERVA: a primeira versão DE TODAS. Sem data e sem nota.
const NASCIMENTO_ESPERADO = [
  'nascimento as ( select distinct on (h.opportunity_key)',
  'h.opportunity_key, h.fixture_id, h.market, h.outcome, h.line_value,',
  'h.best_odd, h.edge',
  'from futebol.fact_value_opportunities_hist h',
  'order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc',
].join(' ');

// O PREÇO que vale: a primeira versão VISÍVEL (migration 162). Mesma regra da
// 161, que fez o board e o detalhe do jogo julgarem por ela.
const ESTREIA_ESPERADA = [
  'estreia as ( select distinct on (j.opportunity_key)',
  'j.opportunity_key, j.edge, j.best_odd',
  'from janelas j',
  'where j.dbt_valid_from < j.fim',
  'and (j.escondido_de is null',
  'or j.dbt_valid_from < j.escondido_de',
  'or (j.escondido_ate is not null and j.fim > j.escondido_ate))',
  'order by j.opportunity_key, j.dbt_valid_from asc, j.dbt_scd_id asc',
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

  // ⚠️ O preço vem da ESTREIA, caindo para o nascimento quando não houve uma.
  // Sem a queda, a linha que nunca esteve visível chegaria sem preço e sairia da
  // conta — e o botão "Só a vitrine" desligado deixaria de mostrar o board
  // inteiro, que é a razão de ele existir.
  expect(corpo, onde).toMatch(/coalesce\(e\.best_odd,\s*s\.best_odd\),/);
  expect(corpo, onde).toMatch(/coalesce\(e\.edge,\s*s\.edge\),/);
  expect(corpo, onde).toMatch(/left\s+join\s+estreia\s+e\s+on\s+e\.opportunity_key\s*=\s*s\.opportunity_key/);
  // Data e nota continuam vindo da nota, e a identidade do nascimento.
  expect(corpo, onde).toMatch(/s\.dbt_valid_from,/);
  expect(corpo, onde).toMatch(/s\.score::int,\s*s\.faixa,\s*s\.score_versao,/);
  // A junção interna, que mantém fora quem nunca teve versão vigente.
  expect(corpo, onde).toMatch(/join\s+nota\s+t\s+on\s+t\.opportunity_key\s*=\s*n\.opportunity_key/);
  // ⚠️ O recorte de período tem UM dono, e é ele que dirige o select.
  expect(corpo, onde).toMatch(/from\s+selecionadas\s+s/);
  // E a regra de visibilidade roda só sobre as chaves que o período selecionou.
  expect(corpo, onde).toMatch(/h\.opportunity_key in \(select s\.opportunity_key from selecionadas s\)/);
}

describe('a foto de nascimento do placar', () => {
  // Aceite 1: a identidade e o preço DE RESERVA seguem na primeira versão de
  // todas, sem filtro de metodologia.
  it('a identidade vem da primeira versão de todas, sem filtro de metodologia', () => {
    const nascimento = cte(readFileSync(MIGRATION, 'utf8'), 'nascimento', 'na migration 162');

    expect(nascimento).toBe(NASCIMENTO_ESPERADO);
    expect(nascimento).not.toContain('score_versao');
  });

  // Aceite 2: a nota continua restrita a `contexto_v1`. O filtro não era
  // bobagem — ele existe para não somar duas escalas.
  it('a nota e a data continuam vindo só da metodologia vigente', () => {
    expect(cte(readFileSync(MIGRATION, 'utf8'), 'nota', 'na migration 162')).toBe(NOTA_ESPERADA);
  });

  // ⚠️ Aceite 3, a razão desta migration: o PREÇO vem da primeira versão
  // VISÍVEL, que é a mesma regra que a 161 deu ao board e ao detalhe do jogo.
  // Sem isto, as duas telas dizem números diferentes sobre a mesma linha.
  it('o preço vem da primeira versão VISÍVEL, como no board', () => {
    expect(cte(readFileSync(MIGRATION, 'utf8'), 'estreia', 'na migration 162')).toBe(
      ESTREIA_ESPERADA,
    );
  });

  // As duas metades na MESMA linha: se alguém trocar os prefixos, a divergência
  // volta sem que as afirmações acima percebam.
  it('o select puxa preço da estreia, com queda, e data e nota da nota', () => {
    afirmaDirecao(readFileSync(MIGRATION, 'utf8'), 'na migration 162');
  });

  // O shape file provisiona ambiente novo. Divergir dele é nascer com a versão
  // errada da regra — foi a #250, onze vezes seguidas.
  it('o shape file traz a MESMA regra, e não outra', () => {
    const shape = readFileSync(SHAPE, 'utf8');

    expect(cte(shape, 'nascimento', 'no shape file')).toBe(NASCIMENTO_ESPERADO);
    expect(cte(shape, 'nota', 'no shape file')).toBe(NOTA_ESPERADA);
    expect(cte(shape, 'estreia', 'no shape file')).toBe(ESTREIA_ESPERADA);
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

  // ⚠️ E o script leva a ESTREIA junto, senão o terminal mede com um preço e a
  // tela com outro — exatamente o que a ADR 0003 manda não deixar acontecer.
  //
  // O SQL dos dois não é idêntico de propósito: a RPC restringe a regra às
  // chaves do período porque serve uma tela, e o script varre tudo porque já
  // varre e roda fora do caminho de requisição. O que tem de bater é a REGRA.
  it('o script leva a estreia junto, com a mesma regra de visibilidade', () => {
    const script = readFileSync(SCRIPT, 'utf8');

    expect(script).toMatch(/estreia as \(\s*select distinct on \(j\.opportunity_key\)/);
    expect(script).toMatch(/j\.dbt_valid_from < j\.fim/);
    expect(script).toMatch(/j\.escondido_ate is not null and j\.fim > j\.escondido_ate/);
    expect(script).toMatch(/coalesce\(e\.best_odd, n\.best_odd\)/);
  });
});
