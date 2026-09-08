/**
 * Os canais de contato do time.
 *
 * Uma constante, e não a string repetida em cada tela: o WhatsApp aparece no
 * rodapé, no menu da conta e nas telas de paywall, e a exigência do produto é
 * que TODOS levem ao mesmo lugar. Copiada, a string sobrevive à primeira
 * mudança de número em um lugar só — e aí metade do app manda a pessoa para um
 * telefone que não atende mais.
 */
export const WHATSAPP_DO_TIME = 'https://wa.me/5511952136845';

/** O e-mail do time. Continua sendo o canal do rodapé e do ícone de envelope. */
export const EMAIL_DO_TIME = 'tecnologia@smartbetting.app';

/**
 * O link do WhatsApp já com a primeira mensagem escrita.
 *
 * A codificação é do `encodeURIComponent`, e não da mão: acento e espaço
 * quebram a URL, e um link do bolão foi escrito com `%C3%A1` digitado
 * manualmente — funciona até alguém editar a frase e esquecer de recodificar.
 */
export function whatsappDoTime(mensagem: string): string {
  return `${WHATSAPP_DO_TIME}?text=${encodeURIComponent(mensagem)}`;
}

/**
 * "Falar com o time" — o link do rodapé e do menu da conta.
 *
 * A mensagem pronta existe para os dois lados. Para quem escreve, tira o custo
 * da primeira frase, que é onde a maioria desiste. Para quem atende, diz de
 * onde a pessoa veio: sem isso a conversa começa com um "oi" solto e o time
 * gasta uma rodada só para descobrir o assunto.
 */
export const WHATSAPP_FALAR_COM_O_TIME = whatsappDoTime(
  'Oi! Preciso de ajuda com a Smart Betting.',
);
