import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';

// ============================================================================
// O perfil de aposta sai em agregado, e nunca em linha
// ============================================================================
// A tabela `bets` é fechada para o sócio, e essa decisão está na migration 124:
// dar policy de select abriria a aposta linha a linha, com valor, odd,
// descrição e o texto cru que a pessoa mandou no Telegram. Esta função existe
// para responder "como essa pessoa aposta" sem abrir nada disso.
//
// Os guardas aqui são mais duros que os das outras funções do CRM porque esta
// é a que toca a tabela mais sensível do produto.
// ============================================================================

const MIGRATION = lerMigration('20260914160000_134_crm_perfil_de_aposta.sql');
const FUNCAO = comando(
  MIGRATION,
  /create or replace function public\.crm_perfil_de_aposta/,
  '$function$;',
);

describe('crm_perfil_de_aposta', () => {
  it('existe', () => {
    expect(FUNCAO).not.toBeNull();
  });

  it('confere o portão por dentro', () => {
    expect(FUNCAO).toMatch(/if not public\.eh_socio\(\)/);
  });

  it('roda como dono do banco, com search_path travado', () => {
    expect(FUNCAO).toMatch(/security definer/);
    expect(FUNCAO).toMatch(/set search_path to ''/);
  });

  it('é stable: ela só lê', () => {
    expect(FUNCAO).toMatch(/\bstable\b/);
  });

  it('não é executável por quem não está logado', () => {
    // Duas funções do repositório esqueceram exatamente isto e estão na #408.
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_perfil_de_aposta/);
    const posRevoke = MIGRATION.indexOf('revoke execute on function public.crm_perfil_de_aposta');
    const posGrant = MIGRATION.indexOf('grant execute on function public.crm_perfil_de_aposta');
    expect(posRevoke).toBeGreaterThan(0);
    expect(posGrant).toBeGreaterThan(posRevoke);
  });

  it('lê só as apostas da pessoa pedida', () => {
    // Sem o `where`, o agregado seria da base inteira dentro de uma função que
    // a tela chama por pessoa. O erro sairia como número estranho, não como
    // erro.
    expect(FUNCAO).toMatch(/where b\.user_id = p_user_id/);
  });

  it('nenhuma coluna de conteúdo da aposta sai daqui', () => {
    // O guarda é sobre o CORPO, e não sobre a assinatura: uma versão anterior
    // de outro guarda lia só o `returns table` e deixou passar um
    // `max(stake_amount) as maior_valor` no meio da função.
    const proibidas = [
      'bet_description',
      'match_description',
      'raw_input',
      'processed_data',
      'betting_house',
      'cashout_date',
    ];
    for (const coluna of proibidas) {
      expect(FUNCAO, coluna).not.toContain(coluna);
    }
  });

  it('não devolve aposta individual', () => {
    // Tudo que sai é contagem, soma ou agregado em jsonb. Um `limit` sobre a
    // tabela sem `group by` seria lista de apostas com outro nome.
    const retorno = FUNCAO?.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? '';
    expect(retorno).toMatch(/total bigint/);
    expect(retorno).not.toMatch(/\bid\b|descricao|texto/);
    expect(FUNCAO).not.toMatch(/select \* from public\.bets/);
  });

  it('as tags ficam de fora', () => {
    // Decisão, e não esquecimento: tag é texto livre que a pessoa escreve para
    // si, e carrega nome de tipster, "tilt", nome de grupo pago. É o campo mais
    // indiscreto do conjunto e não muda conversa comercial nenhuma.
    expect(FUNCAO).not.toMatch(/bet_tags|\btags\b/);
  });

  it('o ROI conta só aposta liquidada', () => {
    // Somar stake de `pending` no denominador é dividir lucro por aposta que
    // não terminou, e ~72% da base fica em pending para sempre: o ROI sairia
    // diluído a ponto de não significar nada.
    expect(FUNCAO).toMatch(/fechadas as \(select \* from apostas where liquidada\)/);
    expect(FUNCAO).toMatch(/from fechadas/);
  });

  it('cada recorte devolve o N junto do número', () => {
    // "Aposta mais em Over/Under" mente quando a pessoa tem três apostas. Com
    // o N, a tela diz "2 de 3" e quem lê decide se é perfil ou coincidência.
    for (const recorte of ['esportes', 'mercados', 'faixas']) {
      const bloco = FUNCAO?.slice(FUNCAO.indexOf(`${recorte} as (`)) ?? '';
      expect(bloco.slice(0, bloco.indexOf(') t')), recorte).toMatch(/'n', count\(\*\)/);
    }
  });

  it('nulo e string vazia caem no mesmo balde', () => {
    // As duas ocorrem: mercado e esporte são texto livre sem restrição. Sem o
    // `nullif`, a tela mostraria "Outros" e "" como dois recortes diferentes.
    expect(FUNCAO).toMatch(/coalesce\(nullif\(b\.sport, ''\), 'Outros'\)/);
    expect(FUNCAO).toMatch(/coalesce\(nullif\(b\.betting_market, ''\), 'Outros'\)/);
  });
});

describe('a regra de lucro não pode divergir entre os três lugares', () => {
  /**
   * `profitForBet` em `src/utils/dashboardAggregations.ts` é a fonte da verdade,
   * e a regra está escrita três vezes: lá em TypeScript, na migration 086 em
   * SQL para o resumo semanal do Telegram, e aqui.
   *
   * Não há como evitar a duplicação — o navegador não roda Postgres e o
   * Postgres não importa TypeScript. O que dá para fazer é isto: se as três
   * divergirem, o CRM mostra um ROI diferente do que o próprio usuário vê na
   * tela dele, e o sócio abre a conversa com o número errado na mão.
   */
  const TS = readFileSync(resolve(__dirname, '../../utils/dashboardAggregations.ts'), 'utf8');
  const M086 = lerMigration('086_weekly_summary.sql');

  /**
   * Os status que um `case` de lucro em SQL trata por nome.
   *
   * Sem maiúsculas e sem depender do primeiro `end`: a 086 escreve o SQL em
   * maiúsculas, e o ramo do cashout tem um `case` aninhado com `end` no meio,
   * então cortar ali devolvia três status de seis. O fim do bloco é o `as
   * profit`, que os dois arquivos escrevem.
   */
  const statusNoSql = (sql: string) => {
    const baixo = sql.toLowerCase();
    const de = baixo.indexOf('case b.status');
    const ate = baixo.indexOf('as profit', de);
    expect(de, 'achou o case do lucro').toBeGreaterThan(0);
    expect(ate, 'achou o fim do case').toBeGreaterThan(de);
    return [...baixo.slice(de, ate).matchAll(/when '([a-z_]+)'/g)].map((m) => m[1]).sort();
  };

  /** Os nomes entre aspas de uma lista, do primeiro parêntese ou colchete ao fecho. */
  const listaDe = (texto: string, marca: string, abre: string, fecha: string) => {
    const de = texto.indexOf(marca);
    const inicio = texto.indexOf(abre, de);
    const fim = texto.indexOf(fecha, inicio);
    expect(de, marca).toBeGreaterThan(0);
    return [...texto.slice(inicio, fim).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  };

  it('os mesmos status são tratados nos dois SQL', () => {
    expect(statusNoSql(FUNCAO ?? '')).toEqual(statusNoSql(M086));
  });

  it('e são os mesmos que o TypeScript trata', () => {
    // `void` aparece no `SETTLED` do TypeScript mas não num `if` do
    // `profitForBet`: lá ele cai no `return 0` final. No SQL ele está no
    // `else 0`, com o comentário dizendo isso. Então a comparação é sobre os
    // status que RENDEM conta, e `void` fica de fora dos dois lados.
    const corpo = TS.slice(TS.indexOf('export function profitForBet'));
    const noTs = [...corpo.slice(0, corpo.indexOf('}')).matchAll(/bet\.status === '([a-z_]+)'/g)]
      .map((m) => m[1])
      .sort();
    expect(noTs.length).toBeGreaterThan(0);
    expect(statusNoSql(FUNCAO ?? '')).toEqual(noTs);
  });

  it('a lista de liquidadas é a mesma do app', () => {
    // `SETTLED` no TypeScript e o `in (...)` aqui decidem o denominador do ROI.
    // Divergir aqui é dividir o lucro por um conjunto de apostas diferente do
    // que o próprio usuário vê na tela dele.
    const noTs = listaDe(TS, 'export const SETTLED', '[', ']');
    const noSql = listaDe(FUNCAO ?? '', 'b.status in (', '(', ')');
    expect(noSql).toEqual(noTs);
  });
});
