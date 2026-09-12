/**
 * Se esta pessoa tem acesso ao futebol AGORA.
 *
 * Isto vive em `shared/` pelo mesmo motivo do `concessoes.ts`: a mesma pergunta
 * era respondida em dois lugares do `telegram-webhook` — no callback das
 * preferências e no comando `/mensagens` — com a conta escrita na mão nos dois,
 * `início + 7 * 86400000`. Duas cópias da mesma regra de acesso é o bug que
 * ninguém reproduz: o menu diz que os alertas estão disponíveis e o callback
 * diz que não, dependendo de qual dos dois respondeu por último.
 *
 * A duração do teste NÃO aparece aqui, e é o ponto. O fim do teste é gravado em
 * `futebol_trial_ends_at` no instante em que o relógio larga (ver a migration
 * 134), então quem lê não precisa saber quanto ele dura — e continua certo para
 * as duas coortes vivas: quem começou antes do corte tem 7 dias gravados, quem
 * começou depois tem 48 horas, e esta função não distingue.
 */

/** O recorte de `public.users` que a resposta precisa. Nada além disto. */
export type AcessoAoFutebol = {
  futebol_subscription_status?: string | null;
  futebol_trial_ends_at?: string | null;
};

export function temAcessoAoFutebol(
  u: AcessoAoFutebol | null | undefined,
  agora: number = Date.now(),
): boolean {
  if (!u) return false;
  if (u.futebol_subscription_status === "premium") return true;
  if (!u.futebol_trial_ends_at) return false;

  const fim = new Date(u.futebol_trial_ends_at).getTime();
  // Data ilegível não vira acesso: `NaN > agora` é falso, mas deixar implícito
  // já custou um bug em outro lugar do CRM.
  if (Number.isNaN(fim)) return false;
  return fim > agora;
}
