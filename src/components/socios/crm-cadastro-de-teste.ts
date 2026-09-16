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
  // Número usável por padrão porque é o caso comum de um lead de verdade.
  //
  // ⚠️ Com null aqui, TODA a suíte passava a contar como "sem WhatsApp", e o
  // esconder — que nasce ligado na fila — esvaziava listas em testes que não
  // falam disso. Quem testa a ausência põe null explicitamente, e aí o teste
  // diz o que está testando.
  whatsapp_number: '5511998877665',
  created_at: '2026-09-10T12:00:00Z',
  betinho_subscription_status: 'free',
  futebol_subscription_status: 'free',
  analytics_subscription_status: 'free',
  telegram_synced: false,
  subscription_product_type: null,
  futebol_trial_started_at: null,
  futebol_publication_alerts_ack_at: null,
  futebol_trial_ends_at: null,
  ...over,
});

/**
 * Um fim de teste cujo ÚLTIMO DIA de acesso é daqui a `dias` dias, a partir de
 * `hoje`. Zero é hoje, negativo é passado. O fim cai no meio do dia daqui,
 * longe da virada, para o teste não depender de fuso.
 *
 * Mora aqui porque as suítes de etiqueta, de painel, de tabela e de kanban
 * montavam a mesma data à mão.
 */
export function fimDoTesteEm(hoje: string, dias: number): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return `${d.toISOString().slice(0, 10)}T15:00:00Z`;
}
