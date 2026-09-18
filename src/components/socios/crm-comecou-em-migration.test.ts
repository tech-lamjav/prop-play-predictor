import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';

// ============================================================================
// O acordo ganha um começo próprio, e ele pode ser no passado
// ============================================================================
// Não havia onde dizer que uma assinatura começou antes de hoje: uma vitalícia
// dada a um parceiro em janeiro só podia ser cadastrada como se tivesse nascido
// no dia do cadastro, e os meses anteriores sumiam da conta.
//
// Os guardas aqui protegem duas coisas que, se quebradas, só apareceriam meses
// depois e como dinheiro errado na tela: que `criada_em` continua sendo
// auditoria de verdade, e que trocar o plano não apaga a dívida.
// ============================================================================

const MIGRATION = lerMigration('20260918020000_153_crm_assinatura_comecou_em.sql');

const CONCEDER = comando(
  MIGRATION,
  /create or replace function public\.crm_dar_assinatura_manual/,
  '$function$;',
);

describe('a coluna do começo', () => {
  it('existe, e é data', () => {
    expect(MIGRATION).toMatch(/add column if not exists comecou_em date/);
  });

  it('as linhas que já existem começam no dia em que foram lançadas', () => {
    // É a verdade que se tinha até agora, e preencher com ela é o que permite
    // a coluna virar obrigatória sem derrubar a migration.
    expect(MIGRATION).toMatch(/set comecou_em = \(criada_em at time zone 'America\/Sao_Paulo'\)::date/);
  });

  it('o preenchimento vem ANTES de virar obrigatória', () => {
    // ⚠️ A ordem é o conteúdo deste teste, como na 151: `set not null` antes do
    // preenchimento derruba a migration com as linhas antigas nulas.
    const posBackfill = MIGRATION.indexOf('set comecou_em = (criada_em');
    const posNotNull = MIGRATION.indexOf('alter column comecou_em set not null');
    expect(posBackfill).toBeGreaterThan(0);
    expect(posNotNull).toBeGreaterThan(posBackfill);
  });

  it('converte para o dia de Brasília, e não de UTC', () => {
    // Uma assinatura dada às 22h de 31 de agosto é de AGOSTO para quem deu. Em
    // UTC ela viraria setembro, e a pessoa deixaria de dever um mês.
    expect(MIGRATION).toMatch(/at time zone 'America\/Sao_Paulo'/);
  });

  it('NÃO falsifica criada_em', () => {
    // ⚠️ O ponto da migration inteira. `criada_em` responde quando isto foi
    // lançado no sistema, e é a única coisa que permite descobrir depois que
    // alguém cadastrou um acordo antigo ontem à noite. Duas perguntas, duas
    // colunas.
    expect(MIGRATION).not.toMatch(/set criada_em\s*=/);
    expect(CONCEDER).not.toMatch(/criada_em\s*=/);
  });
});

describe('crm_dar_assinatura_manual, com começo', () => {
  it('derruba a versão de quatro parâmetros antes de criar a de cinco', () => {
    // `create or replace` com assinatura diferente cria uma SEGUNDA função, e
    // aí a chamada fica ambígua: o sócio veria "function is not unique".
    const posDrop = MIGRATION.indexOf(
      'drop function if exists public.crm_dar_assinatura_manual(uuid, text, date, numeric)',
    );
    const posCreate = MIGRATION.indexOf(
      'create or replace function public.crm_dar_assinatura_manual',
    );
    expect(posDrop).toBeGreaterThan(0);
    expect(posCreate).toBeGreaterThan(posDrop);
  });

  it('o começo é opcional, e nulo quer dizer hoje', () => {
    expect(MIGRATION).toMatch(/p_comecou_em date default null/);
    expect(CONCEDER).toMatch(/coalesce\(p_comecou_em,/);
  });

  it('recusa começo no futuro', () => {
    // Acordo que ainda não começou não tem mês em aberto, e a fila contaria
    // meses negativos.
    expect(CONCEDER).toMatch(/raise exception 'comeco no futuro'/);
  });

  it('NÃO impõe o limite de doze meses no banco', () => {
    // ⚠️ Esse limite é proteção contra ano digitado errado, e mora na tela. O
    // banco recusa só o que é impossível. Depois da #451 a conta soma a dívida
    // inteira, então doze meses não é mais limite de nada aqui.
    expect(CONCEDER).not.toMatch(/12 month|interval '1 year'|doze/i);
  });

  it('⚠️ trocar o plano NÃO mexe no começo', () => {
    // O guarda mais importante deste arquivo. O histórico de pagamento pendura
    // nesta linha e os meses em aberto contam do começo: sobrescrever o começo
    // numa troca faria a dívida inteira sumir só porque o sócio corrigiu o
    // valor. É o mesmo estrago que a 142 evitou ao parar de encerrar e
    // recriar, chegando por outro caminho.
    const troca = CONCEDER?.match(
      /update public\.crm_assinatura_manual[\s\S]*?returning id, comecou_em into/,
    )?.[0];
    expect(troca).toBeTruthy();
    expect(troca).not.toMatch(/set[\s\S]*comecou_em\s*=/);
  });

  it('⚠️ o `returning` usa variável PRÓPRIA, e não a do começo pedido', () => {
    // O defeito mais caro desta migration, e ele quebrava TUDO, não só o
    // retroativo: reusar `v_comecou` no `returning ... into` fazia o caminho de
    // CRIAR apagá-la. Em plpgsql, um `update` que não acerta linha nenhuma
    // atribui NULO a todos os alvos do `into` — e criar é justamente o caso em
    // que não há linha para acertar. O `insert` seguinte gravava nulo numa
    // coluna `not null`, e toda concessão nova falhava.
    //
    // ⚠️ E este teste já passou por ACIDENTE: ele procurava
    // `into v_id, v_comecou`, que casa como prefixo de `v_comecou_do_banco`.
    // Ficaria verde com a variável errada. A âncora agora exige o fim da
    // instrução.
    expect(CONCEDER).toMatch(/returning id, comecou_em into v_id, v_comecou_do_banco;/);
    expect(CONCEDER).not.toMatch(/into v_id, v_comecou;/);
  });

  it('e o começo PEDIDO sobrevive ao caminho de criar', () => {
    // O `coalesce` depois do update é o que devolve o pedido quando não havia
    // assinatura aberta. Sem ele, o valor apagado pelo `into` seguiria nulo.
    expect(CONCEDER).toMatch(/v_comecou := coalesce\(v_comecou_do_banco, v_comecou\);/);
    expect(CONCEDER).toMatch(/valor_mensal, comecou_em, criada_por\)/);
  });

  it('grava o começo ao criar uma assinatura nova', () => {
    expect(CONCEDER).toMatch(/\(user_id, plano, vence_em, valor_mensal, comecou_em, criada_por\)/);
  });

  it('a linha do tempo diz quando foi retroativo, e só então', () => {
    // Daqui a três meses é esta linha que responde por que a pessoa apareceu
    // devendo nove meses de uma vez. Numa concessão que começa hoje a frase
    // seria ruído.
    expect(CONCEDER).toMatch(/retroativo/);
    expect(CONCEDER).toMatch(/v_comecou < \(now\(\) at time zone 'America\/Sao_Paulo'\)::date/);
  });

  it('continua com portão de sócio e search_path travado', () => {
    expect(CONCEDER).toMatch(/if not public\.eh_socio\(\)/);
    expect(CONCEDER).toMatch(/security definer/);
    expect(CONCEDER).toMatch(/set search_path to ''/);
  });

  it('revoga de public E de anon antes de conceder', () => {
    // No Supabase revogar de PUBLIC não fecha o anônimo.
    const cinco = /public\.crm_dar_assinatura_manual\(uuid, text, date, numeric, date\)/;
    expect(MIGRATION).toMatch(new RegExp(`revoke execute on function ${cinco.source} from public`));
    expect(MIGRATION).toMatch(new RegExp(`revoke execute on function ${cinco.source} from anon`));
    expect(MIGRATION).toMatch(new RegExp(`grant\\s+execute on function ${cinco.source} to authenticated`));
  });

  it('não monta SQL com texto vindo de fora', () => {
    expect(CONCEDER).not.toMatch(/execute\s+(format|'|")/i);
    expect(CONCEDER).not.toMatch(/quote_ident/);
  });
});
