import { describe, expect, it } from 'vitest';
import { assinaturasDoStripe } from './crm-assinatura-do-stripe';
import { cadastroDeTeste as cadastro } from './crm-cadastro-de-teste';

// ============================================================================
// Quem paga no gateway também é assinante, e o CRM não enxergava
// ============================================================================
// A tela de assinaturas lia só `crm_assinatura_manual`, então quem comprou
// sozinho pela página nunca aparecia. O sócio descobria pelo painel do Stripe,
// fora do CRM, ou não descobria.
//
// ⚠️ Tipo SEPARADO do da assinatura manual, de propósito. Aquele tem plano da
// escada de venda, valor mensal combinado e data de VENCIMENTO. Uma assinatura
// do gateway não tem nenhuma das três nesse sentido: o produto vem com outro
// vocabulário, o valor não está no nosso banco, e a data é de RENOVAÇÃO — a
// pessoa não perde acesso nela, é cobrada de novo.
//
// Encaixar à força faria a tela mentir em três campos. E, mantendo os tipos
// separados, "quem é do gateway nunca entra nas filas de cobrança e de
// inadimplentes" deixa de ser um filtro que alguém pode esquecer e passa a ser
// impossível de escrever errado: as filas recebem o outro tipo.
// ============================================================================

const doGateway = (over = {}) =>
  cadastro({
    id: 'u1',
    name: 'Maria Silva',
    tem_assinatura_no_stripe: true,
    betinho_subscription_status: 'premium',
    subscription_product_type: 'betinho',
    betinho_subscription_period_end: '2026-10-20T12:00:00Z',
    ...over,
  });

describe('assinaturasDoStripe', () => {
  it('quem não paga no gateway fica de fora', () => {
    // Sem isto a lista encheria de gente que recebeu acesso na mão, que é
    // justamente a confusão que a coluna nova existe para desfazer.
    expect(assinaturasDoStripe([cadastro({ tem_assinatura_no_stripe: false })])).toEqual([]);
  });

  it('ter premium NÃO basta: precisa ser do gateway', () => {
    // ⚠️ O defeito que quase entrou. Três caminhos escrevem `premium` nas
    // mesmas colunas — o webhook, a assinatura dada na mão e o acesso avulso.
    const naMao = cadastro({
      tem_assinatura_no_stripe: false,
      betinho_subscription_status: 'premium',
      futebol_subscription_status: 'premium',
    });
    expect(assinaturasDoStripe([naMao])).toEqual([]);
  });

  it('quem paga no gateway entra, identificado', () => {
    const [a] = assinaturasDoStripe([doGateway()]);
    expect(a.userId).toBe('u1');
    expect(a.pessoa).toBe('Maria Silva');
  });

  it('sem nome, a linha se identifica pelo e-mail', () => {
    // Mesma regra da fila de cobrança: uma linha sem dono é uma linha que
    // ninguém consegue usar.
    const [a] = assinaturasDoStripe([doGateway({ name: null, email: 'anon@exemplo.com' })]);
    expect(a.pessoa).toBe('anon@exemplo.com');
  });

  it('a data da próxima renovação vem do prazo do produto', () => {
    const [a] = assinaturasDoStripe([doGateway()]);
    expect(a.renovaEm).toBe('2026-10-20');
  });

  it('sem prazo gravado, a data é NULA em vez de inventada', () => {
    // ⚠️ Quem assina só o futebol não tem coluna de prazo, por decisão
    // registrada. Nulo é a resposta certa, e a tela diz que não sabe — uma data
    // chutada aqui viraria uma conversa de renovação no dia errado.
    const [a] = assinaturasDoStripe([
      doGateway({
        subscription_product_type: 'futebol',
        betinho_subscription_period_end: null,
        analytics_subscription_period_end: null,
      }),
    ]);
    expect(a.renovaEm).toBeNull();
  });

  it('o prazo do Analytics serve quando é o que existe', () => {
    const [a] = assinaturasDoStripe([
      doGateway({
        subscription_product_type: 'platform',
        betinho_subscription_period_end: null,
        analytics_subscription_period_end: '2026-11-05T12:00:00Z',
      }),
    ]);
    expect(a.renovaEm).toBe('2026-11-05');
  });

  it('guarda o produto como o gateway gravou, sem traduzir', () => {
    // ⚠️ O gateway grava betinho/futebol/analytics/platform, e o CRM grava
    // entrada/essencial/completo. São dois vocabulários na mesma coluna.
    // Traduzir aqui inventaria um plano de venda que ninguém contratou.
    const [a] = assinaturasDoStripe([doGateway({ subscription_product_type: 'platform' })]);
    expect(a.produto).toBe('platform');
  });

  it('produto não gravado vira nulo, e não um padrão', () => {
    const [a] = assinaturasDoStripe([doGateway({ subscription_product_type: null })]);
    expect(a.produto).toBeNull();
  });

  it('ordena por quem renova primeiro, e sem data vai para o fim', () => {
    // Mesma razão da fila de cobrança: lida de cima para baixo, a lista começa
    // por quem tem conversa mais próxima. Quem não tem data não disputa
    // urgência com ninguém.
    const lista = assinaturasDoStripe([
      doGateway({ id: 'u3', name: 'Terceira', betinho_subscription_period_end: null }),
      doGateway({ id: 'u2', name: 'Segunda', betinho_subscription_period_end: '2026-12-01T12:00:00Z' }),
      doGateway({ id: 'u1', name: 'Primeira', betinho_subscription_period_end: '2026-10-01T12:00:00Z' }),
    ]);
    expect(lista.map((a) => a.pessoa)).toEqual(['Primeira', 'Segunda', 'Terceira']);
  });

  it('leva o WhatsApp junto, porque a conversa acontece nele', () => {
    const [a] = assinaturasDoStripe([doGateway({ whatsapp_number: '5511998877665' })]);
    expect(a.whatsapp).toBe('5511998877665');
  });
});
