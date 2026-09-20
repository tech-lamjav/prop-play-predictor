import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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

const RPCS = ['get_futebol_value_history', 'get_futebol_fixture_value'] as const;

/**
 * As migrations, na ordem em que o banco as aplica.
 *
 * ⚠️ NADA DE CAMINHO FIXO AQUI, e a lição custou dois CIs. Este arquivo já
 * apontou para `20260919120000_161_...`, que virou `20260919130000_162_...` no
 * merge por colisão de carimbo; o teste passava na máquina de quem escreveu e
 * reprovava no CI com ENOENT. Depois a 165 redefiniu `get_futebol_fixture_value`
 * e o caminho fixo passou a comparar o provisionamento contra a migration
 * ERRADA — que é pior, porque fica verde.
 *
 * Qual arquivo define cada função é pergunta que se responde lendo, não
 * decorando.
 */
const MIGRATIONS = readdirSync(resolve(RAIZ, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(resolve(RAIZ, 'supabase/migrations', f), 'utf8'));

/**
 * A ÚLTIMA migration que define a função — que é a que o banco fica rodando.
 *
 * As migrations empilham redefinições, e comparar contra qualquer outra é cobrar
 * do provisionamento uma regra que o banco não tem mais.
 */
function migrationQueDefine(funcao: string): string {
  const marca = new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${funcao}\\s*\\(`, 'i');
  const definem = MIGRATIONS.filter((sql) => marca.test(sql));
  expect(definem.length, `nenhuma migration define ${funcao}`).toBeGreaterThan(0);
  return definem[definem.length - 1];
}

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

/**
 * Os dois lugares onde a regra de uma função vive: a migration que a definiu por
 * último, e o arquivo de provisionamento.
 *
 * ⚠️ É POR FUNÇÃO, e não por arquivo, porque as duas RPCs deixaram de morar na
 * mesma migration: o histórico ficou na 162 e o detalhe passou para a 165. Um
 * caminho fixo escondia essa separação e comparava o provisionamento contra a
 * migration errada — ficando verde.
 */
const ondeVive = (funcao: string): [string, string][] => [
  ['a migration que define', migrationQueDefine(funcao)],
  ['o arquivo de provisionamento', SHAPE],
];

describe.each(['migration', 'arquivo de provisionamento'])('%s', (fonte) => {
  const sqlDe = (funcao: string) =>
    fonte === 'migration' ? migrationQueDefine(funcao) : SHAPE;

  it.each(RPCS)('o nascimento de %s é chaveado por opportunity_key', (funcao) => {
    const sql = sqlDe(funcao);
    // Chavear pelas colunas da saída mistura a vida de duas oportunidades na
    // mesma foto quando a linha sai do board e volta. São 74 chaves com
    // reativação em produção.
    const corpo = corpoDaFuncao(sql, funcao);
    expect(corpo).toMatch(/distinct on \(j\.opportunity_key\)[\s\S]{0,80}j\.opportunity_key, j\.edge/);
    expect(corpo).not.toContain('distinct on (h.market, h.outcome, h.line_value)');
  });

  it.each(RPCS)('a regra de visibilidade está inteira em %s', (funcao) => {
    const corpo = semEspaco(corpoDaFuncao(sqlDe(funcao), funcao));
    for (const peca of PECAS_DA_VISIBILIDADE) {
      expect(corpo, `${funcao} sem o bloco:${peca}`).toContain(semEspaco(peca));
    }
  });

  it('⚠️ o detalhe troca de fonte no APITO, e não no kickoff', () => {
    // O defeito que a 165 fecha: com o jogo EM ANDAMENTO, a lista mostrava a
    // linha viva do board e esta tela já mostrava a foto tirada no kickoff.
    // Chance, odd e valor diferentes na mesma linha, todo jogo, todos os dias.
    //
    // A trava do histórico (só `FT`, `AET`, `PEN`) não pode ser solta: aquela
    // RPC é ABERTA, e soltar devolve valor apostável ao vivo para quem não
    // assina. Então quem muda de portão é o detalhe, que se fecha por dentro.
    const corpo = corpoDaFuncao(sqlDe('get_futebol_fixture_value'), 'get_futebol_fixture_value');
    expect(corpo).toContain("fx.status_short in ('FT', 'AET', 'PEN')");
    expect(corpo).not.toMatch(/fx\.kickoff_utc (>|<=) \(now\(\) at time zone 'UTC'\)/);
    // ⚠️ Status NULO conta como não encerrado. `not in` com nulo devolve nulo e
    // a linha SUMIRIA da tela enquanto o mart não carregasse o status — trocar
    // divergência por desaparecimento é pior.
    expect(corpo).toContain("coalesce(fx.status_short, '') not in ('FT', 'AET', 'PEN')");
    // A escolha da versão não muda: continua a que atravessa o kickoff.
    expect(corpo).toContain('h.dbt_valid_from <= fx.kickoff_utc');
  });

  it.each(RPCS)('%s pergunta pelo INTERVALO da versão, não pelo nascimento dela', (funcao) => {
    const sql = sqlDe(funcao);
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
    // achasse alguma versão — inclusive num jogo não encerrado, cujo snapshot já
    // tem versões. Sem chave é board, e board é a vantagem viva.
    const corpo = corpoDaFuncao(sqlDe('get_futebol_fixture_value'), 'get_futebol_fixture_value');
    expect(corpo).toContain('null::text as opportunity_key');
    expect(corpo).toContain('case when v.opportunity_key is null then v.edge else n.edge end');
    expect(corpo).not.toContain('coalesce(n.edge, v.edge)');
  });

  it('o histórico segue devolvendo a vantagem do nascimento, e não a do apito', () => {
    const corpo = corpoDaFuncao(sqlDe('get_futebol_value_history'), 'get_futebol_value_history');
    expect(corpo).toMatch(/left join nascimento n on n\.opportunity_key = v\.opportunity_key/);
  });
});

describe('a migration e o arquivo de provisionamento não se afastam', () => {
  it.each(RPCS)('%s tem o mesmo corpo nos dois arquivos', (funcao) => {
    // Espaço em branco não é a regra; o resto é. Se um dia divergirem, um
    // ambiente novo nasce com uma regra e a produção roda outra.
    expect(semEspaco(corpoDaFuncao(SHAPE, funcao))).toBe(
      semEspaco(corpoDaFuncao(migrationQueDefine(funcao), funcao)),
    );
  });

  it('e é a ÚLTIMA migration que define cada função que vale', () => {
    // A guarda existe porque este arquivo já apontou para a migration errada
    // duas vezes: uma por renomeação no merge, outra quando a 165 redefiniu o
    // detalhe e o caminho fixo continuou lendo a 162.
    expect(ondeVive('get_futebol_fixture_value')[0][1]).toContain(
      "coalesce(fx.status_short, '') not in ('FT', 'AET', 'PEN')",
    );
    expect(ondeVive('get_futebol_value_history')[0][1]).toContain('get_futebol_value_history');
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

  // ⚠️ SÓ NO ARQUIVO DE PROVISIONAMENTO, e isso é consequência de um fato, não
  // preguiça: as duas RPCs deixaram de morar na mesma migration. O histórico foi
  // definido por último na 162 e o detalhe na 165, então não existe UM arquivo
  // de migration onde as duas possam ser comparadas entre si.
  //
  // O provisionamento é o lugar onde elas convivem, e a guarda acima já obriga
  // cada uma a ser igual à migration que a definiu. As duas asserções juntas
  // cobrem o mesmo que antes.
  it('no arquivo de provisionamento, a janela é calculada igual nas duas RPCs', () => {
    const doHistorico = janelasDe(SHAPE, 'get_futebol_value_history');
    const doDetalhe = janelasDe(SHAPE, 'get_futebol_fixture_value');
    for (const peca of [REGRA_DA_JANELA]) {
      expect(semEspaco(doHistorico), 'histórico').toContain(semEspaco(peca));
      expect(semEspaco(doDetalhe), 'detalhe').toContain(semEspaco(peca));
    }
  });

  it.each([['arquivo de provisionamento', SHAPE]])('em %s, a estreia é escolhida igual nas duas RPCs', (_nome, sql) => {
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
