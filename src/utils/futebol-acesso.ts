/**
 * O acesso ao futebol está ativo?
 *
 * Duas portas: assinatura em premium, ou o teste gratuito ainda de pé. Vive
 * aqui porque duas telas fazem a mesma pergunta — as configurações de alertas
 * e a ficha do CRM —, e duas cópias divergiriam no dia em que o prazo mudasse.
 *
 * Esse dia chegou: a migration 136 passou o teste de 7 dias para 48 horas e
 * gravou o FIM de cada teste em `futebol_trial_ends_at`. Quem pergunta pelo
 * fim acerta as duas coortes vivas sem saber que existem duas, e é por isso
 * que a duração não aparece mais aqui.
 *
 * A versão que media a partir do INÍCIO saiu daqui junto com a migração do CRM
 * para o fim gravado. Ela respondia errado para todo teste de 48 horas, dizendo
 * que o acesso ficava de pé por sete dias.
 *
 * ⚠️ O que este arquivo NÃO unifica: as edge functions do Telegram rodam em
 * Deno e não alcançam o `src/`, então a mesma pergunta existe de novo em
 * `supabase/functions/shared/acesso-ao-futebol.ts`. A cópia é inevitável (dois
 * runtimes, nenhum módulo comum) e está travada por
 * `futebol-acesso-paridade.test.ts`, no mesmo padrão da vitrine de mercados
 * ocultos.
 */
export function temAcessoAoFutebolPeloFim(
  status: string | null | undefined,
  fimDoTeste: string | null | undefined,
  agora = Date.now(),
): boolean {
  if (status === 'premium') return true;
  if (!fimDoTeste) return false;

  const fim = new Date(fimDoTeste).getTime();
  if (Number.isNaN(fim)) return false;
  return fim > agora;
}
