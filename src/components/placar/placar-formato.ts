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
export const taxaPct = (taxa: number | null) => (taxa == null ? '—' : `${virgula(taxa * 100, 1)}%`);

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
  roi > 0 ? 'text-forest' : roi < 0 ? 'text-red-600' : 'text-ink';

/** O denominador, do jeito que ele aparece ao lado do número: "em 37". */
export const emN = (n: number) => `em ${n}`;
