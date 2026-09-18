/**
 * As chaves de cache do CRM, num lugar só.
 *
 * Uma escrita invalida várias leituras: registrar um pagamento muda a
 * assinatura, a ficha, a linha do tempo, a lista e a fila de inadimplentes.
 * Com a chave escrita à mão em cada hook, mudar uma exigia lembrar de todos os
 * lugares que a invalidam, e esquecer um deixava a tela mostrando dado velho
 * sem erro nenhum.
 */
export const CHAVES = {
  cadastros: ['socios', 'cadastros'] as const,
  assinaturas: ['socios', 'assinaturas-manuais'] as const,
  pessoa: (id: string) => ['socios', 'pessoa', id] as const,
  linhaDoTempo: (id: string) => ['socios', 'linha-do-tempo', id] as const,
  /**
   * Os pagamentos de uma PESSOA, das duas origens.
   *
   * ⚠️ Já foi por assinatura, e mudou junto com a migration 151: pagamento do
   * Stripe não tem assinatura manual, então enquanto a chave e a consulta
   * fossem por assinatura o dinheiro do gateway existia no banco e não aparecia
   * em tela nenhuma.
   */
  pagamentos: (userId: string) => ['socios', 'pagamentos', userId] as const,
  /** Os pagamentos de todas as assinaturas, para a fila de inadimplentes. */
  pagamentosDeTodas: ['socios', 'pagamentos', 'todas'] as const,
  /** Quem o sócio marcou na mão como impossível de abordar por WhatsApp. */
  semWhatsApp: ['socios', 'sem-whatsapp'] as const,
};
