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
const MIGRATION = readFileSync(
  resolve(RAIZ, 'supabase/migrations/20260919120000_161_futebol_nascimento_visivel.sql'),
  'utf8',
);

const RPCS = ['get_futebol_value_history', 'get_futebol_fixture_value'] as const;

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

/** As três peças da regra de visibilidade, uma por decisão que ela toma. */
const PECAS_DA_VISIBILIDADE = [
  // o mercado estava na vitrine naquele instante
  "mo.oculto_desde at time zone 'UTC'",
  "mo.oculto_ate at time zone 'UTC'",
  // e o limiar ou não vigia ainda, ou a vantagem passa nele
  "lv.vigente_desde at time zone 'UTC'",
  'lv.limiar::double precision',
];

describe.each([
  ['migration 161', MIGRATION],
  ['arquivo de provisionamento', SHAPE],
])('%s', (_nome, sql) => {
  it.each(RPCS)('o nascimento de %s é chaveado por opportunity_key', (funcao) => {
    // Chavear pelas colunas da saída mistura a vida de duas oportunidades na
    // mesma foto quando a linha sai do board e volta. São 74 chaves com
    // reativação em produção.
    const corpo = corpoDaFuncao(sql, funcao);
    expect(corpo).toMatch(/distinct on \(h\.opportunity_key\)[\s\S]{0,80}h\.opportunity_key, h\.edge/);
    expect(corpo).not.toContain('distinct on (h.market, h.outcome, h.line_value)');
  });

  it.each(RPCS)('a regra de visibilidade está inteira em %s', (funcao) => {
    const corpo = corpoDaFuncao(sql, funcao);
    for (const peca of PECAS_DA_VISIBILIDADE) {
      expect(corpo, `${funcao} sem "${peca}"`).toContain(peca);
    }
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
    const semEspaco = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(semEspaco(corpoDaFuncao(SHAPE, funcao))).toBe(
      semEspaco(corpoDaFuncao(MIGRATION, funcao)),
    );
  });
});
