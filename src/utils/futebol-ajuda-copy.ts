import type { FutebolScoreVersion } from '@/services/futebol-score-contract';

/**
 * As definições dos três números da leitura.
 *
 * Eram quatro. O valor saiu da tela (#519) e levou junto a sua definição: um
 * texto de ajuda para um número que não é desenhado explicaria o invisível. O
 * texto do Score também perdeu a menção a ele — ele prometia que a odd e o
 * valor apareciam "ao lado", e metade dessa promessa deixou de ser verdade.
 *
 * O texto do Score depende da escala em que a nota foi calculada. Desde a
 * virada de 03/09/2026 o produto publica só `contexto_v1`, e o preço não entra
 * mais na nota (spec #301).
 *
 * O ramo `legacy` não é resíduo: o histórico é point-in-time e continua
 * devolvendo linhas da régua antiga, onde a nota SOMAVA preço. Explicá-las com
 * o texto novo seria descrever errado uma leitura que já aconteceu.
 */
export function textoDoScore(versao: FutebolScoreVersion | undefined): string {
  return COPY_DA_AJUDA[escalaDaAjuda(versao)];
}

/** A escala que a ajuda do Score explica, como identificador. */
export type EscalaDaAjuda = 'scoreContexto' | 'scoreLegacy';

/** Qual das duas explicações do Score vale para esta escala. */
export function escalaDaAjuda(versao: FutebolScoreVersion | undefined): EscalaDaAjuda {
  return versao === 'contexto_v1' ? 'scoreContexto' : 'scoreLegacy';
}

/** A chave de idioma da explicação do Score. */
export function chaveDoTextoDoScore(versao: FutebolScoreVersion | undefined): string {
  return `ajuda.${escalaDaAjuda(versao)}`;
}

/** A chave de idioma da explicação da chance. */
export const CHAVE_TEXTO_CHANCE = 'ajuda.chance';

/** A chave de idioma da explicação da odd. */
export const CHAVE_TEXTO_ODD = 'ajuda.odd';

/**
 * Os três textos de ajuda. Fonte única do português, e é daqui que o catálogo de
 * idioma em português é gerado.
 */
export const COPY_DA_AJUDA = {
  scoreContexto:
    'Mede quanto do cenário favorável aparece nesta linha: ataque, defesa, mando, forma, histórico do confronto. Não é chance de acerto, e não olha o preço — a odd aparece ao lado, separada.',
  scoreLegacy:
    'Mede a confiabilidade da leitura, de 0 a 100. Junta o cenário do jogo com o quanto a odd paga acima do risco estimado. Não é chance de acerto.',
  chance:
    'A probabilidade que o mercado atribui a esta saída, depois de tirar a margem da casa. Não é a nossa estimativa: é a leitura das cotações.',
  odd: 'A melhor cotação encontrada entre as casas acompanhadas, no momento da coleta. É ela que define o retorno se a aposta acontecer.',
} as const;

export const TEXTO_CHANCE = COPY_DA_AJUDA.chance;

export const TEXTO_ODD = COPY_DA_AJUDA.odd;

