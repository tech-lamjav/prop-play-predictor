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

/** Quantos dias durava o teste antes da migration 136. */
const DIAS_DE_TESTE = 7;

/**
 * A mesma pergunta, respondida a partir do INÍCIO do teste.
 *
 * ⚠️ DÍVIDA, com prazo: esta é a versão que ainda mede sete dias, e ela
 * responde errado para quem começou o teste depois da migration 136 — vai dizer
 * que o acesso está de pé por sete dias quando o servidor corta em 48 horas.
 *
 * Continua aqui porque as três telas do CRM (`crm-acesso`, `crm-etiquetas`,
 * `crm-ficha`) a chamam passando `futebol_trial_started_at`, e o CRM ficou
 * FORA desta branch de propósito: há outra sessão de trabalho aberta nesses
 * arquivos, e trocar a assinatura desta função daqui obrigaria a editá-los.
 *
 * Quem for fechar essa dívida: apagar esta função, apontar as três telas para
 * `temAcessoAoFutebolPeloFim` com `futebol_trial_ends_at`, e acertar as duas
 * cópias de `DIAS_DE_TESTE` que vivem em `crm-acesso.ts` e `crm-etiquetas.ts`.
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
