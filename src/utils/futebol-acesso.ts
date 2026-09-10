/** Quantos dias dura o teste gratuito do futebol. */
const DIAS_DE_TESTE = 7;

/**
 * O acesso ao futebol está ativo?
 *
 * Duas portas: assinatura em premium, ou o teste gratuito ainda dentro do
 * prazo. Vive aqui porque duas telas fazem a mesma pergunta — as configurações
 * de alertas e a ficha do CRM —, e duas cópias divergiriam no dia em que o
 * prazo mudasse.
 *
 * ⚠️ O que este arquivo NÃO unifica: as edge functions do Telegram têm a
 * própria conta dos sete dias, em Deno, e não conseguem importar daqui. São
 * runtimes diferentes sem módulo compartilhado. Mudar o prazo exige mexer nos
 * dois lados, e este comentário existe para lembrar do segundo.
 */
export function temAcessoAoFutebol(
  status: string | null | undefined,
  inicioDoTeste: string | null | undefined,
  agora = Date.now(),
): boolean {
  if (status === 'premium') return true;
  if (!inicioDoTeste) return false;
  return new Date(inicioDoTeste).getTime() + DIAS_DE_TESTE * 24 * 60 * 60 * 1000 > agora;
}
