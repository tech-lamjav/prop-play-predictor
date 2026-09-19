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
// A migration que deu a regra de visibilidade ao board e ao detalhe do jogo. Ela
// entra aqui só para a asserção das QUATRO cópias, abaixo.
const MIGRATION_161 = resolve(
  RAIZ,
  'supabase/migrations/20260919120000_161_futebol_nascimento_visivel.sql',
);

/**
 * O coração da regra de visibilidade, como ele tem de aparecer em TODA cópia.
 *
 * ⚠️ Esta constante fecha um buraco que o code review achou: as guardas
 * afirmavam os CTEs pelo nome e pela forma, e ninguém comparava ESTE bloco. Uma
 * mudança no `least` — inverter o `coalesce`, trocar o `>` por `>=`, perder o
 * ramo da vigência — passava verde nas duas guardas ao mesmo tempo.
 */
const REGRA_DA_JANELA = [
  'least(',
  "coalesce(h.dbt_valid_to, 'infinity'::timestamp),",
  'case when lv.market is null or h.edge > lv.limiar::double precision',
  "then 'infinity'::timestamp",
  "else (lv.vigente_desde at time zone 'UTC') end",
  ') as fim',
].join(' ');

const semEspaco = (s: string) => s.replace(/\s+/g, ' ').trim();

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

  // ⚠️ O preço vem da ESTREIA, caindo para o nascimento quando não houve uma, e
  // as duas colunas saem da MESMA linha.
  //
  // Dois `coalesce` independentes — como estava na primeira versão — devolvem a
  // odd da estreia com a vantagem do nascimento quando a estreia tem odd e não
  // tem vantagem. Isso é uma linha que nunca existiu em versão nenhuma.
  expect(corpo, onde).toMatch(
    /case when e\.opportunity_key is null then s\.best_odd\s+else e\.best_odd\s+end,/,
  );
  expect(corpo, onde).toMatch(
    /case when e\.opportunity_key is null then s\.edge\s+else e\.edge\s+end,/,
  );
  expect(corpo, onde, ).not.toMatch(/coalesce\(e\.(best_odd|edge),/);

  // ⚠️ E a vantagem da estreia CRUA, sem queda, numa coluna própria. É ela que
  // responde "o assinante viu isto?", e é o recorte "Só a vitrine" que a lê.
  // Sem ela, o front decidia pelo preço de reserva e mantinha na vitrine
  // exatamente a linha que nunca esteve nela.
  expect(corpo, onde).toMatch(/edge_publicacao double precision,/);
  // ⚠️ Ancorado nos VIZINHOS, e não em quebra de linha. A primeira versão desta
  // asserção procurava `\n\s*e.edge,\n`, e falhava com o SQL correto: o corpo
  // chega aqui sem comentários, e o que sobra no lugar deles é espaço em branco
  // que o padrão não previa. Âncora frágil reprova código certo.
  expect(semEspaco(corpo), onde).toContain('else e.edge end, e.edge, s.score::int,');

  expect(corpo, onde).toMatch(/left\s+join\s+estreia\s+e\s+on\s+e\.opportunity_key\s*=\s*s\.opportunity_key/);
  // Data e nota continuam vindo da nota, e a identidade do nascimento.
  expect(corpo, onde).toMatch(/s\.dbt_valid_from,/);
  expect(corpo, onde).toMatch(/s\.score::int,\s*s\.faixa,\s*s\.score_versao,/);
  // A junção interna, que mantém fora quem nunca teve versão vigente.
  expect(corpo, onde).toMatch(/join\s+nota\s+t\s+on\s+t\.opportunity_key\s*=\s*n\.opportunity_key/);
  // ⚠️ O recorte de período tem UM dono, e é ele que dirige o select.
  expect(corpo, onde).toMatch(/from\s+selecionadas\s+s/);

  // ⚠️ JUNÇÃO, e não `in (select ...)`. O `in` contra um CTE materializado vira
  // semi-junção por hash e varre a tabela inteira do mesmo jeito — o comentário
  // que dizia o contrário era falso, e o code review pegou. A junção na chave
  // permite laço aninhado sobre o índice que já existe.
  expect(corpo, onde).toMatch(/join selecionadas s on s\.opportunity_key = h\.opportunity_key/);
  expect(corpo, onde).not.toMatch(/opportunity_key in \(select s\.opportunity_key/);
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

// ============================================================================
// ⚠️ As QUATRO cópias da regra de visibilidade
// ============================================================================
// O code review achou o buraco: a guarda da 161 cobre as duas RPCs dela, esta
// cobre as do placar, e NINGUÉM comparava o bloco que de fato decide. Mudar o
// `least` passava verde nas duas ao mesmo tempo.
//
// A regra vive copiada de propósito — é a mesma dívida da cascata de evidências,
// registrada em `docs/futebol-prod-deploy.md` — e o preço de aceitar a cópia é
// manter uma guarda que alcance todas elas.
// ============================================================================

describe('a regra de visibilidade é a mesma nas quatro cópias', () => {
  it.each([
    ['migration 161 (board e detalhe do jogo)', MIGRATION_161],
    ['migration 162 (placar)', MIGRATION],
    ['arquivo de provisionamento', SHAPE],
    ['script de terminal', SCRIPT],
  ])('%s', (_nome, arquivo) => {
    expect(semEspaco(readFileSync(arquivo, 'utf8'))).toContain(REGRA_DA_JANELA);
  });
});

describe('a migration 162 e o arquivo de provisionamento não se afastam', () => {
  // O outro buraco do mesmo review: nada comparava a 162 com o provisionamento
  // CORPO A CORPO, como a guarda da 161 já faz com as dela. O `selecionadas` —
  // com o fuso de Brasília e o OU das duas datas — podia divergir entre os dois
  // arquivos sem quebrar nada, e ambiente novo nasceria com outra regra.
  it('o corpo da função é idêntico nos dois arquivos', () => {
    expect(semEspaco(corpoDaFuncao(readFileSync(SHAPE, 'utf8'), 'no shape file'))).toBe(
      semEspaco(corpoDaFuncao(readFileSync(MIGRATION, 'utf8'), 'na migration 162')),
    );
  });
});
