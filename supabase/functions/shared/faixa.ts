/**
 * A faixa publicada pelo backend, lida do jeito que o painel lê.
 *
 * ⚠️ É uma cópia deliberada de `faixaTone` em `src/utils/futebol-score.ts`. As
 * edge functions rodam em Deno e não alcançam o `src/`, então não há como
 * importar. O que dá para garantir é que exista UMA cópia deste lado da
 * fronteira, e não uma por função de notificação.
 *
 * O corte por NÚMERO que morava nas duas — `score >= 40` — saiu na virada do
 * Score de contexto (spec #301). Ele foi calibrado para a fórmula antiga e, na
 * escala nova, mandaria para o Telegram um conjunto diferente do que o painel
 * publica: 40 é Média na escala antiga e Alta na nova.
 */
export type FaixaTone = "alta" | "media" | "baixa";

export function faixaTone(faixa: string | null | undefined): FaixaTone {
  const f = (faixa ?? "").toLowerCase();
  if (f.startsWith("alta")) return "alta";
  if (f.startsWith("m")) return "media";
  return "baixa";
}

/**
 * O painel mostra Alta e Média por padrão, e é esse o conjunto que o Telegram
 * deve alcançar. A decisão é do backend: aqui só se lê a palavra que ele mandou.
 */
export function ehFaixaPublicavel(faixa: string | null | undefined): boolean {
  return faixaTone(faixa) !== "baixa";
}
