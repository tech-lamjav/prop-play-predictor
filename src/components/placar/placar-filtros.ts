import { FAIXAS_DO_SCORE, faixaDoScore, type LinhaPublicada } from './placar-agregacao';

// ============================================================================
// placar-filtros.ts — o que entra na conta, antes de qualquer agregação
// ============================================================================
// Dois cortes que o sócio pediu, e os dois existem porque a decisão real quase
// nunca é sobre o board inteiro: é sobre "e se a gente só publicasse o que tem
// nota alta" ou "e se a gente barrasse preço muito pior que o justo".
//
// ⚠️ Filtrar NÃO é o mesmo que simular peso. Filtrar tira a linha da amostra,
// como se ela nunca tivesse sido publicada; peso zero também a tira da conta,
// mas fica contado à parte, porque a pergunta ali é de gerenciamento e não de
// régua de publicação. Os dois convivem na tela e a diferença é dita.
// ============================================================================

export type Recorte = {
  /** As faixas de Score que entram. Vazio = todas. */
  faixas: string[];
  /**
   * O valor mínimo, em FRAÇÃO e não em ponto percentual.
   *
   * O campo `edge` do histórico é fração: −0,0956 a 0,1574 na série atual, com
   * média −0,0283. A tela mostra em por cento e converte na borda — guardar em
   * por cento aqui faria a comparação com o dado exigir uma multiplicação que
   * alguém uma hora esquece.
   */
  valorMinimo: number | null;
};

export const SEM_RECORTE: Recorte = { faixas: [], valorMinimo: null };

export const temRecorte = (r: Recorte) => r.faixas.length > 0 || r.valorMinimo != null;

/** A linha passa pelo recorte? */
export function passaNoRecorte(linha: LinhaPublicada, recorte: Recorte): boolean {
  if (recorte.faixas.length > 0 && !recorte.faixas.includes(faixaDoScore(linha.score))) {
    return false;
  }
  if (recorte.valorMinimo != null) {
    // Linha sem valor gravado não passa num corte de valor: incluí-la seria
    // afirmar que ela atende um critério que ninguém mediu nela.
    if (linha.edge == null) return false;
    if (linha.edge < recorte.valorMinimo) return false;
  }
  return true;
}

export function aplicarRecorte(
  linhas: readonly LinhaPublicada[],
  recorte: Recorte,
): LinhaPublicada[] {
  if (!temRecorte(recorte)) return [...linhas];
  return linhas.filter((l) => passaNoRecorte(l, recorte));
}

/** As faixas na ordem da escala, para a tela desenhar os botões. */
export const FAIXAS_PARA_FILTRAR = FAIXAS_DO_SCORE;

/**
 * Os cortes de valor que a operação usa de verdade.
 *
 * −2% é o corte que a decisão do handicap adotou em 12/09/2026; 0% é "não
 * publicar preço pior que o justo", que foi a exigência removida pela A2. Os
 * dois estão aqui porque são as duas linhas que a gente já discutiu — e um campo
 * livre continua existindo para o resto.
 */
export const CORTES_DE_VALOR = [
  { rotulo: 'Sem corte', valor: null },
  { rotulo: '≥ −2%', valor: -0.02 },
  { rotulo: '≥ 0%', valor: 0 },
] as const;
