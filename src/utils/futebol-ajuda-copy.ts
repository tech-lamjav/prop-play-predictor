import type { FutebolScoreVersion } from '@/services/futebol-score-contract';

/**
 * As definições dos quatro números da leitura.
 *
 * O texto do Score depende da escala: até a virada ele soma preço e contexto;
 * depois passa a medir só o contexto (spec #301). Escrever a versão nova antes
 * da hora faria a tela explicar uma metodologia que ainda não está rodando.
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
