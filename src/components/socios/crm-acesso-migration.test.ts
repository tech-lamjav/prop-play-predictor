import { describe, expect, it } from 'vitest';
import { comando, lerMigration } from './crm-migration-de-teste';
import { PRODUTOS_EDITAVEIS } from './crm-acesso';

// ============================================================================
// Sócio dando acesso na mão
// ============================================================================
// Até aqui o sócio só LIA a tabela de usuários. Esta migration abre a primeira
// escrita, e ela é de longe a mais perigosa do CRM: as colunas de acesso são as
// mesmas que o webhook do Stripe escreve, e são elas que decidem quem entra no
// produto. Por isso nada aqui é genérico.
//
// A função não recebe nome de coluna. Ela recebe um PRODUTO de uma lista curta
// e decide sozinha quais colunas mexer, porque "escreve a coluna que o cliente
// mandar" numa tabela que tem `is_socio` é entregar a chave junto com a porta.
// ============================================================================

const MIGRATION = lerMigration('20260912100000_129_crm_acesso_manual.sql');

const ACESSO = comando(
  MIGRATION,
  /create or replace function public\.crm_definir_acesso/,
  '$function$;',
);
const TESTE = comando(
  MIGRATION,
  /create or replace function public\.crm_definir_teste_do_futebol/,
  '$function$;',
);

describe('crm_definir_acesso', () => {
  it('existe', () => {
    expect(ACESSO).not.toBeNull();
  });

  it('confere o portão por dentro', () => {
    expect(ACESSO).toMatch(/if not public\.eh_socio\(\)/);
  });

  it('roda como dono do banco, com search_path travado', () => {
    expect(ACESSO).toMatch(/security definer/);
    expect(ACESSO).toMatch(/set search_path to ''/);
  });

  it('não é executável por quem não está logado', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_definir_acesso/);
  });

  it('recusa produto fora da lista', () => {
    // Sem isto, um produto desconhecido cairia no `else` sem escrever nada e a
    // tela diria "salvo" para uma escrita que não aconteceu.
    expect(ACESSO).toMatch(/raise exception 'produto desconhecido/);
  });

  it('trata cada produto da lista da tela', () => {
    // A lista da tela e os ramos da função precisam ser a MESMA lista. Um
    // produto novo na tela sem ramo aqui vira "produto desconhecido" no clique.
    for (const produto of PRODUTOS_EDITAVEIS) {
      expect(ACESSO, produto.id).toContain(`'${produto.id}'`);
    }
  });

  it('não monta SQL com texto vindo de fora', () => {
    // O parâmetro escolhe um RAMO, e nunca vira nome de coluna. Com `execute`
    // montando a instrução, "produto" passa a ser qualquer coluna da tabela de
    // usuários, `is_socio` inclusive.
    expect(ACESSO).not.toMatch(/execute\s+(format|'|")/i);
    expect(ACESSO).not.toMatch(/quote_ident/);
  });

  it('só escreve nas colunas de acesso', () => {
    // O guarda é sobre o `update` inteiro, e não sobre a função: o `insert` da
    // anotação no fim também escreve, e escrever lá é o esperado.
    const escritas = ACESSO?.match(/update public\.users[\s\S]*?where/g) ?? [];
    expect(escritas.length).toBeGreaterThan(0);
    for (const escrita of escritas) {
      expect(escrita).not.toMatch(/is_socio/);
      expect(escrita).not.toMatch(/stripe_/);
      expect(escrita).not.toMatch(/\bemail\b/);
    }
  });

  it('deixa registro na linha do tempo', () => {
    // Dar acesso na mão é uma decisão comercial, e daqui a três meses alguém
    // vai perguntar por que aquela pessoa tem o Completo sem nunca ter pago. A
    // resposta precisa estar na mesma linha do tempo do resto da conversa.
    expect(ACESSO).toMatch(/insert into public\.crm_anotacao/);
    expect(ACESSO).toMatch(/'acesso'/);
  });

  it('o autor do registro vem do banco, e não dos parâmetros', () => {
    const assinatura = MIGRATION.match(/crm_definir_acesso\(([^)]*)\)/);
    expect(assinatura![1]).not.toMatch(/por|autor|quem/i);
    expect(ACESSO).toMatch(/\(select auth\.uid\(\)\)/);
  });
});

describe('crm_definir_teste_do_futebol', () => {
  it('existe', () => {
    expect(TESTE).not.toBeNull();
  });

  it('confere o portão por dentro', () => {
    expect(TESTE).toMatch(/if not public\.eh_socio\(\)/);
  });

  it('roda como dono do banco, com search_path travado', () => {
    expect(TESTE).toMatch(/security definer/);
    expect(TESTE).toMatch(/set search_path to ''/);
  });

  it('não é executável por quem não está logado', () => {
    expect(MIGRATION).toMatch(/revoke execute on function public\.crm_definir_teste_do_futebol/);
  });

  it('mexe no carimbo de início, e não no status da assinatura', () => {
    // O teste gratuito é uma janela de sete dias contada a partir do carimbo.
    // Escrever `futebol_subscription_status = 'premium'` daria acesso PARA
    // SEMPRE com cara de teste, e ninguém descobriria pela tela.
    const escrita = comando(TESTE ?? '', /update public\.users/, 'where');
    expect(escrita).toMatch(/futebol_trial_started_at/);
    expect(escrita).not.toMatch(/futebol_subscription_status/);
  });

  it('deixa registro na linha do tempo', () => {
    expect(TESTE).toMatch(/insert into public\.crm_anotacao/);
    expect(TESTE).toMatch(/'acesso'/);
  });
});

describe('a linha do tempo aceita o tipo novo', () => {
  it('a restrição de tipo passa a incluir acesso', () => {
    // As duas funções gravam `tipo = 'acesso'`, e o `check` da migration 123 só
    // conhece três tipos. Sem soltar a restrição, toda concessão de acesso
    // falharia no último passo, depois de já ter mexido no acesso da pessoa.
    expect(MIGRATION).toMatch(/alter table public\.crm_anotacao/);
    expect(MIGRATION).toMatch(/'acesso'/);
  });
});
