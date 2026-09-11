import type { Cadastro } from './crm-lista';

/**
 * Um cadastro qualquer, para os testes montarem o caso em cima.
 *
 * Vive fora dos arquivos de teste porque a mesma fábrica era copiada em dois
 * deles, e cópias de fixture divergem calado: o dia da suíte da lista deixa de
 * ser o dia da suíte da tela, e um teste passa a provar outra coisa.
 */
export const cadastroDeTeste = (over: Partial<Cadastro> = {}): Cadastro => ({
  id: 'u1',
  name: 'Fulano',
  email: 'fulano@exemplo.com',
  whatsapp_number: null,
  created_at: '2026-09-10T12:00:00Z',
  betinho_subscription_status: 'free',
  futebol_subscription_status: 'free',
  analytics_subscription_status: 'free',
  telegram_synced: false,
  subscription_product_type: null,
  futebol_trial_started_at: null,
  futebol_publication_alerts_ack_at: null,
  ...over,
});
