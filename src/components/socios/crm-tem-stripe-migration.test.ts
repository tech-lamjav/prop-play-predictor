import { describe, expect, it } from 'vitest';
import { lerMigration } from './crm-migration-de-teste';

// ============================================================================
// Saber de onde veio o dinheiro, sem carregar o segredo para a tela
// ============================================================================
// Três caminhos escrevem `premium` nas mesmas colunas: o webhook do Stripe, a
// assinatura dada na mão e o acesso avulso. Por isso "tem premium" não diz nada
// sobre origem, e a tela de assinaturas não conseguia mostrar quem paga no
// cartão.
//
// O identificador do Stripe responderia, e está proibido de ir para o navegador
// por decisão escrita em `use-cadastros`. Esta coluna responde sim ou não.
// ============================================================================

const MIGRATION = lerMigration('20260918000000_152_users_tem_assinatura_no_stripe.sql');

describe('a coluna que diz se a pessoa paga no gateway', () => {
  it('existe, e é booleana', () => {
    expect(MIGRATION).toMatch(/add column if not exists tem_assinatura_no_stripe boolean/);
  });

  it('é CALCULADA pelo banco, e não gravada por ninguém', () => {
    // ⚠️ É o coração desta migration. Uma coluna comum precisaria de gatilho ou
    // de rotina para acompanhar o campo de origem, e gatilho que falha em
    // silêncio faria a tela dizer que um cliente pagante recebeu acesso na mão
    // — ou o contrário. Calculada, ela não tem como divergir.
    expect(MIGRATION).toMatch(
      /generated always as \(stripe_subscription_id is not null\) stored/,
    );
  });

  it('não expõe o identificador do Stripe', () => {
    // A regra escrita em `use-cadastros` continua de pé: o que vai para o
    // navegador é o sim ou não, nunca o número.
    const colunas = MIGRATION.match(/add column[^;]*/g) ?? [];
    expect(colunas.length).toBe(1);
    for (const c of colunas) expect(c).not.toMatch(/add column.*stripe_subscription_id\b/);
  });

  it('não encosta nas colunas que decidem acesso', () => {
    // ⚠️ Esta coluna é informação para a tela, e não portão. Mexer nas colunas
    // por produto seria mexer em quem entra no produto.
    expect(MIGRATION).not.toMatch(/(betinho|futebol|analytics)_subscription_status\s*=/);
    expect(MIGRATION).not.toMatch(/alter column/);
    expect(MIGRATION).not.toMatch(/drop column/i);
  });

  it('não cria função, então não há revoke a cobrar', () => {
    // Guarda de escopo: se um dia alguém acrescentar função aqui, este teste
    // cai e obriga a lembrar do revoke de public E de anon.
    expect(MIGRATION).not.toMatch(/create (or replace )?function/i);
  });

  it('a coluna é a ÚNICA coisa que esta migration acrescenta', () => {
    // ⚠️ Guarda de escopo, e o que ele protege é a promessa do título: uma
    // migration que só informa a tela não pode sair carregando mudança de
    // acesso de carona. Se aparecer uma segunda coluna aqui, alguém tem de
    // decidir de novo se ela deve existir.
    const colunas = MIGRATION.match(/add column[^;]*/g) ?? [];
    expect(colunas).toHaveLength(1);
    expect(colunas[0]).toMatch(/tem_assinatura_no_stripe/);
  });
});
