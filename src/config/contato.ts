/**
 * Os canais de contato do time.
 *
 * Uma constante, e não a string repetida em cada tela: o WhatsApp aparece no
 * rodapé, no menu da conta e nas telas de paywall, e a exigência do produto é
 * que TODOS levem ao mesmo lugar. Copiada, a string sobrevive à primeira
 * mudança de número em um lugar só — e aí metade do app manda a pessoa para um
 * telefone que não atende mais.
 *
 * O link é o cru, sem mensagem pré-preenchida, porque é o mesmo que o ícone do
 * rodapé já usava e é o que o usuário reconhece. Quem precisa de texto pronto
 * (as telas de paywall) monta em cima deste, e não ao lado dele.
 */
export const WHATSAPP_DO_TIME = 'https://wa.me/5511952136845';

/** O e-mail do time. Continua sendo o canal do rodapé e do ícone de envelope. */
export const EMAIL_DO_TIME = 'tecnologia@smartbetting.app';
