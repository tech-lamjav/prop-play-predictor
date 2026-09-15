// ============================================================================
// placar-formato.ts — como cada número do placar aparece na tela
// ============================================================================
// Separado da agregação de propósito: lá é aritmética, aqui é leitura. O sócio
// lê estes números para decidir peso de premissa, então o sinal importa tanto
// quanto o valor — "12,5%" e "−12,5%" são decisões opostas.
// ============================================================================

/** Vírgula decimal, como todo número do produto. */
const virgula = (n: number, casas: number) => n.toFixed(casas).replace('.', ',');

/**
 * Uma taxa, de 0 a 1, em porcentagem. `null` vira travessão.
 *
 * Travessão e não "0%": taxa de zero aposta decidida é ausência de resposta, e
 * 0% afirmaria que a metodologia errou tudo.
 */
export const taxaPct = (taxa: number | null, casas = 1) =>
  taxa == null ? '—' : `${virgula(taxa * 100, casas)}%`;

/**
 * O ROI em porcentagem, sempre com sinal.
 *
 * O sinal é explícito no positivo também: numa coluna onde a maioria dos
 * números é negativa, "+2,1%" tem de saltar aos olhos.
 */
export const roiPct = (roi: number) =>
  `${roi > 0 ? '+' : roi < 0 ? '−' : ''}${virgula(Math.abs(roi) * 100, 1)}%`;

/** O erro-padrão, em pontos percentuais, sem sinal. */
export const epPct = (ep: number) => `${virgula(ep * 100, 1)}`;

/**
 * A cor do ROI: verde ganha, vermelho perde, tinta normal no zero.
 *
 * Mora aqui porque o mesmo ternário estava em quatro lugares — os dois números
 * do topo e as duas tabelas —, e cor de número é leitura, não aritmética.
 */
export const tomDoRoi = (roi: number) =>
  roi > 0 ? 'text-forest' : roi < 0 ? 'text-status-danger' : 'text-ink';

/** O denominador, do jeito que ele aparece ao lado do número: "em 37". */
export const emN = (n: number) => `em ${n}`;

/**
 * O caminho de volta: texto digitado por uma pessoa vira número.
 *
 * Aceita vírgula porque o produto é em português e o teclado numérico do
 * celular manda vírgula, e aceita o menos tipográfico porque é o que a tela
 * mostra — quem copia um número da tela e cola no campo cola o «−».
 *
 * Devolve `null` para os estados intermediários de quem está digitando ('',
 * '-', '.'). Tratá-los como zero é o defeito que impedia digitar 0,5.
 */
export function parseNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.').replace('−', '-');
  if (limpo === '' || limpo === '-' || limpo === '.' || limpo === '-.') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** "1 aposta", "12 apostas": a base por extenso, onde não há coluna que a nomeie. */
export const apostasEmPalavras = (n: number) => `${n} aposta${n === 1 ? '' : 's'}`;
