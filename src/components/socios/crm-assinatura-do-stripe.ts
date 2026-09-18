import { brtDayOf } from '@/utils/futebol-datas';
import type { Cadastro } from './crm-lista';

// ============================================================================
// Quem paga no gateway
// ============================================================================
// A tela de assinaturas lia só `crm_assinatura_manual`, então quem comprou
// sozinho pela página nunca aparecia no CRM. O sócio descobria pelo painel do
// Stripe, por fora, ou não descobria.
//
// ⚠️ Tipo SEPARADO do da assinatura manual, e isso é a decisão central deste
// módulo. Aquele tem plano da escada de venda, valor mensal combinado e data de
// VENCIMENTO. Uma assinatura do gateway não tem nenhuma das três nesse sentido:
//
//   - o produto vem com outro vocabulário (`betinho`/`futebol`/`analytics`/
//     `platform`, e não `entrada`/`essencial`/`completo`);
//   - o valor não está no nosso banco;
//   - a data é de RENOVAÇÃO — a pessoa não perde acesso nela, é cobrada de novo.
//
// Encaixar à força faria a tela mentir em três campos de uma vez.
//
// E há um ganho que vale mais que a honestidade dos campos: como as filas de
// cobrança e de inadimplentes recebem o OUTRO tipo, "quem paga no gateway nunca
// entra nelas" deixa de ser um filtro que alguém pode esquecer e passa a ser
// impossível de escrever errado.
// ============================================================================

/** Uma assinatura que vive no gateway, montada do que `users` guarda. */
export interface AssinaturaDoStripe {
  userId: string;
  /** O nome, ou o e-mail quando não há nome. A linha precisa de alguém nela. */
  pessoa: string;
  whatsapp: string | null;
  /**
   * O produto como o GATEWAY gravou, sem tradução.
   *
   * ⚠️ Nulo quando não há nada gravado, e nunca um padrão. Traduzir para a
   * escada de venda inventaria um plano que a pessoa não contratou, e chutar um
   * padrão faria a tela nomear errado o que ela está mostrando.
   */
  produto: string | null;
  /**
   * `YYYY-MM-DD` da próxima cobrança, ou nulo quando não sabemos.
   *
   * ⚠️ Nulo é resposta, e não falta de resposta: quem assina só o futebol não
   * tem coluna de prazo, por decisão registrada em `shared/concessoes.ts`. A
   * tela DIZ que não sabe — uma data chutada aqui viraria uma conversa de
   * renovação no dia errado.
   */
  renovaEm: string | null;
}

/**
 * A data da próxima renovação, do prazo que existir.
 *
 * O Betinho vem primeiro porque é o prefixo que o Essencial e o Completo também
 * alimentam: quem tem qualquer plano com Betinho dentro tem esta coluna. O
 * Analytics cobre quem só tem ele.
 */
function proximaRenovacao(c: Cadastro): string | null {
  const bruto = c.betinho_subscription_period_end ?? c.analytics_subscription_period_end;
  return bruto === null ? null : brtDayOf(bruto);
}

/**
 * Quem paga no gateway, de quem renova primeiro para quem renova depois.
 *
 * ⚠️ O filtro é `tem_assinatura_no_stripe`, e NUNCA "tem premium". Três
 * caminhos escrevem `premium` nas mesmas colunas — o webhook, a assinatura dada
 * na mão e o acesso avulso —, então o status não diz nada sobre origem. Filtrar
 * por ele chamaria acesso dado na mão de cliente pagante.
 *
 * Quem não tem data de renovação vai para o fim, pela mesma razão da vitalícia
 * na fila de cobrança: sem data não há urgência a disputar, e ordenar nulo
 * junto com datas poria quem não tem conversa marcada na frente de quem renova
 * amanhã.
 */
export function assinaturasDoStripe(cadastros: Cadastro[]): AssinaturaDoStripe[] {
  return cadastros
    .filter((c) => c.tem_assinatura_no_stripe === true)
    .map((c) => ({
      userId: c.id,
      pessoa: c.name?.trim() || c.email,
      whatsapp: c.whatsapp_number,
      produto: c.subscription_product_type,
      renovaEm: proximaRenovacao(c),
    }))
    .sort((a, b) => {
      if (a.renovaEm === null || b.renovaEm === null) {
        if (a.renovaEm === b.renovaEm) return a.userId.localeCompare(b.userId);
        return a.renovaEm === null ? 1 : -1;
      }
      return a.renovaEm === b.renovaEm
        ? a.userId.localeCompare(b.userId)
        : a.renovaEm.localeCompare(b.renovaEm);
    });
}
