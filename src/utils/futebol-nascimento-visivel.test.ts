import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// A foto de nascimento é a primeira versão VISÍVEL (migration 161)
// ============================================================================
// A 146 chamou de nascimento a primeira versão que existe no snapshot. Mas o
// snapshot grava o BOARD, que é o universo — mercado fora da vitrine e linha
// abaixo do limiar de valor incluídos. Para a linha que atravessa uma dessas
// duas regras, a primeira versão do snapshot é de um instante em que ninguém
// podia ver aquilo.
//
// Foi assim que o Brentford +0,5 de 18/09 sumiu do detalhe do jogo: nasceu em
// 12/09 com −2,96%, com o handicap ainda fora da vitrine; apareceu de verdade em
// 16/09 às 02h10, com −1,94%; e a tela o escondeu pela vantagem de 12/09.
//
// A regra de visibilidade está COPIADA nas duas RPCs, verbatim, como a cascata
// de evidências já está nas três (`docs/futebol-prod-deploy.md`). Este arquivo é
// a guarda que obriga as cópias a andarem juntas — e a migration a andar junto
// com o arquivo de provisionamento, senão um ambiente novo nasce com o defeito.
//
// Roda ARQUIVO contra ARQUIVO, sem banco, no mesmo espírito do
// `futebol-contrato-score.test.ts`.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');
const SHAPE = readFileSync(resolve(RAIZ, 'docs/futebol-prod-deploy.sql'), 'utf8');
// ⚠️ O nome mudou de `20260919120000_161` para `20260919130000_162`: a migration
// foi re-carimbada porque colidia, no carimbo E no número, com a dos índices das
// premissas — e o Supabase identifica migration pelo carimbo, então o deploy da
// develop morria em `duplicate key`. O porquê está no cabeçalho do próprio
// arquivo. Este teste foi quem acusou a renomeação, que é o papel dele.
const MIGRATION = readFileSync(
  resolve(RAIZ, 'supabase/migrations/20260919130000_162_futebol_nascimento_visivel.sql'),
  'utf8',
);

const RPCS = ['get_futebol_value_history', 'get_futebol_fixture_value'] as const;

/**
 * Compara SEM espaço em branco, e isso não é asseio.
 *
 * ⚠️ Os arquivos deste repositório estão em CRLF e o texto escrito aqui dentro
 * sai em LF. Comparar cru faz toda asserção de bloco falhar por um `\r`
 * invisível — ou, pior, passar por engano no dia em que alguém "consertar" o
 * teste comparando menos coisa. Normalizar os dois lados é o que torna a
 * comparação sobre a REGRA, e não sobre o final de linha.
 */
const semEspaco = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * O corpo da ÚLTIMA definição de uma função.
 *
 * A última é a que vale: o arquivo de provisionamento e as migrations empilham
 * redefinições, e o banco fica com a de baixo. Ancorado em `create` porque o
 * `grant execute on function ...` do fim viraria a última ocorrência, o recorte
 * sairia vazio e toda asserção de conteúdo passaria à toa.
 */
function corpoDaFuncao(sql: string, funcao: string): string {
  const marca = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${funcao}\\s*\\(`,
    'gi',
  );
  let inicio = -1;
  for (const m of sql.matchAll(marca)) inicio = m.index!;
  expect(inicio, `não achei a criação de ${funcao}`).toBeGreaterThan(-1);
  const abre = sql.indexOf('$function$', inicio);
  const fecha = sql.indexOf('$function$', abre + '$function$'.length);
  expect(fecha, `não achei o fim do corpo de ${funcao}`).toBeGreaterThan(abre);
  return sql.slice(abre, fecha);
}

/**
 * A regra de visibilidade, inteira, como ela tem de aparecer nas duas RPCs.
 *
 * ⚠️ Comparada como BLOCO, e não como lista de pedaços soltos. A primeira
 * versão desta guarda conferia quatro substrings, e o code review mostrou o
 * buraco: inverter uma comparação ou perder um ramo do `or` mantém as quatro
 * strings no arquivo e passa verde. O bloco abaixo é a regra e a sua forma.
 */
const REGRA_DA_JANELA = `
           least(
             coalesce(h.dbt_valid_to, 'infinity'::timestamp),
             case when lv.market is null or h.edge > lv.limiar::double precision
                  then 'infinity'::timestamp
                  else (lv.vigente_desde at time zone 'UTC') end
           ) as fim`;

const REGRA_DA_VITRINE = `
    where j.dbt_valid_from < j.fim`;

const REGRA_DO_CRUZAMENTO = `
      and (j.escondido_de is null
           or j.dbt_valid_from < j.escondido_de
           or (j.escondido_ate is not null and j.fim > j.escondido_ate))`;

const PECAS_DA_VISIBILIDADE = [REGRA_DA_JANELA, REGRA_DA_VITRINE, REGRA_DO_CRUZAMENTO];

describe.each([
  ['migration 161', MIGRATION],
  ['arquivo de provisionamento', SHAPE],
])('%s', (_nome, sql) => {
  it.each(RPCS)('o nascimento de %s é chaveado por opportunity_key', (funcao) => {
    // Chavear pelas colunas da saída mistura a vida de duas oportunidades na
    // mesma foto quando a linha sai do board e volta. São 74 chaves com
    // reativação em produção.
    const corpo = corpoDaFuncao(sql, funcao);
    expect(corpo).toMatch(/distinct on \(j\.opportunity_key\)[\s\S]{0,80}j\.opportunity_key, j\.edge/);
    expect(corpo).not.toContain('distinct on (h.market, h.outcome, h.line_value)');
  });

  it.each(RPCS)('a regra de visibilidade está inteira em %s', (funcao) => {
    const corpo = semEspaco(corpoDaFuncao(sql, funcao));
    for (const peca of PECAS_DA_VISIBILIDADE) {
      expect(corpo, `${funcao} sem o bloco:${peca}`).toContain(semEspaco(peca));
    }
  });

  it.each(RPCS)('%s pergunta pelo INTERVALO da versão, não pelo nascimento dela', (funcao) => {
    // ⚠️ Este foi o primeiro defeito da 161, e ele passaria por qualquer guarda
    // que só procurasse os nomes das colunas: a regra citava `oculto_desde`,
    // `oculto_ate` e `vigente_desde` e mesmo assim decidia pelo instante em que
    // a versão nasceu. Uma versão do snapshot VIVE num intervalo, e a do
    // Brentford +0,5 nasceu escondida e ficou visível depois.
    const corpo = corpoDaFuncao(sql, funcao);
    expect(corpo).toContain('h.dbt_valid_to');
    expect(corpo).not.toMatch(/h\.dbt_valid_from >= \(mo\.oculto_ate at time zone 'UTC'\)/);
  });

  it('o detalhe carrega a chave e decide por ela, em vez de coalescer', () => {
    // `coalesce(n.edge, v.edge)` dava a vitória ao nascimento sempre que o CTE
    // achasse alguma versão — inclusive num jogo POR COMEÇAR, cujo snapshot já
    // tem versões. Sem chave é board, e board é a vantagem viva.
    const corpo = corpoDaFuncao(sql, 'get_futebol_fixture_value');
    expect(corpo).toContain('null::text as opportunity_key');
    expect(corpo).toContain('case when v.opportunity_key is null then v.edge else n.edge end');
    expect(corpo).not.toContain('coalesce(n.edge, v.edge)');
  });

  it('o histórico segue devolvendo a vantagem do nascimento, e não a do apito', () => {
    const corpo = corpoDaFuncao(sql, 'get_futebol_value_history');
    expect(corpo).toMatch(/left join nascimento n on n\.opportunity_key = v\.opportunity_key/);
  });
});

describe('a migration e o arquivo de provisionamento não se afastam', () => {
  it.each(RPCS)('%s tem o mesmo corpo nos dois arquivos', (funcao) => {
    // Espaço em branco não é a regra; o resto é. Se um dia divergirem, um
    // ambiente novo nasce com a 146 e a produção roda a 161.
    expect(semEspaco(corpoDaFuncao(SHAPE, funcao))).toBe(
      semEspaco(corpoDaFuncao(MIGRATION, funcao)),
    );
  });
});

describe('⚠️ o histórico e o detalhe não se afastam ENTRE SI', () => {
  // O buraco que o code review achou na primeira versão desta guarda: ela
  // comparava cada RPC com a cópia dela no outro arquivo, e nunca as duas RPCs
  // uma com a outra. As duas podiam divergir juntas, nos dois arquivos, sem
  // quebrar nada — e a discordância entre a tela de Oportunidades e o detalhe
  // do jogo é exatamente o defeito que esta entrega existe para fechar.
  //
  // O que é COMUM é o CTE `janelas`, tirando o recorte de escopo, que é
  // legitimamente diferente: o histórico recorta por período e o detalhe por
  // jogo.
  const janelasDe = (sql: string, funcao: string) => {
    const corpo = corpoDaFuncao(sql, funcao);
    const i = corpo.indexOf('), janelas as (');
    const j = corpo.indexOf('), nascimento as (');
    expect(i, `não achei o CTE janelas em ${funcao}`).toBeGreaterThan(-1);
    expect(j, `não achei o CTE nascimento em ${funcao}`).toBeGreaterThan(i);
    return corpo.slice(i, j);
  };

  it.each([
    ['migration 161', MIGRATION],
    ['arquivo de provisionamento', SHAPE],
  ])('em %s, a janela é calculada igual nas duas RPCs', (_nome, sql) => {
    const doHistorico = janelasDe(sql, 'get_futebol_value_history');
    const doDetalhe = janelasDe(sql, 'get_futebol_fixture_value');
    for (const peca of [REGRA_DA_JANELA]) {
      expect(semEspaco(doHistorico), 'histórico').toContain(semEspaco(peca));
      expect(semEspaco(doDetalhe), 'detalhe').toContain(semEspaco(peca));
    }
  });

  it.each([
    ['migration 161', MIGRATION],
    ['arquivo de provisionamento', SHAPE],
  ])('em %s, a estreia é escolhida igual nas duas RPCs', (_nome, sql) => {
    const nascimentoDe = (funcao: string) => {
      const corpo = corpoDaFuncao(sql, funcao);
      const i = corpo.indexOf('    select distinct on (j.opportunity_key)');
      expect(i, `não achei a escolha da estreia em ${funcao}`).toBeGreaterThan(-1);
      // ⚠️ Recortar até o FIM do CTE, e não até o fim da função. O select final
      // das duas RPCs é legitimamente diferente — uma devolve o histórico do
      // período, a outra as linhas de um jogo —, e incluí-lo fazia esta
      // asserção comparar o que nunca deveria ser igual.
      const fim = corpo.indexOf('\n  )', i);
      expect(fim, `não achei o fim do CTE nascimento em ${funcao}`).toBeGreaterThan(i);
      return semEspaco(corpo.slice(i, fim));
    };
    expect(nascimentoDe('get_futebol_value_history')).toBe(
      nascimentoDe('get_futebol_fixture_value'),
    );
  });
});
