import type { FutebolScoreVersion } from '@/services/futebol-score-contract';

/**
 * As definições dos quatro números da leitura.
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
  return versao === 'contexto_v1'
    ? 'Mede quanto do cenário favorável aparece nesta linha: ataque, defesa, mando, forma, histórico do confronto. Não é chance de acerto, e não olha o preço — a odd e o valor aparecem ao lado, separados.'
    : 'Mede a confiabilidade da leitura, de 0 a 100. Junta o cenário do jogo com o quanto a odd paga acima do risco estimado. Não é chance de acerto.';
}

export const TEXTO_CHANCE =
  'A probabilidade que o mercado atribui a esta saída, depois de tirar a margem da casa. Não é a nossa estimativa: é a leitura das cotações.';

export const TEXTO_ODD =
  'A melhor cotação encontrada entre as casas acompanhadas, no momento da coleta. É ela que define o retorno se a aposta acontecer.';

export const TEXTO_VALOR =
  'A diferença entre o que a odd paga e o que a chance justifica. Positivo significa preço acima do risco estimado. Zero ou negativo é informação sobre o preço, não defeito da leitura.';
