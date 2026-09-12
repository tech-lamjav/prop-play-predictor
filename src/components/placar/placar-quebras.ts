import {
  FAIXAS_DE_ODD,
  FAIXAS_DO_SCORE,
  faixaDeOdd,
  faixaDoScore,
  quebrar,
  quebrarNaOrdem,
  type Celula,
  type LinhaLiquidada,
  type LinhaPublicada,
} from './placar-agregacao';
import {
  FAIXAS_SEM_DADO,
  GRUPOS_DE_CORROBORACAO,
  GRUPOS_DE_PENALIDADE,
  faixaSemDado,
  grupoDeCorroboracao,
  grupoDePenalidade,
} from './placar-premissas';
import { rotuloDoMercado } from './placar-vocabulario';

// ============================================================================
// placar-quebras.ts — o catálogo de tabelas do placar
// ============================================================================
// Cada quebra é uma linha de catálogo, e não um bloco de JSX escrito à mão. A
// razão apareceu quando a comparação de dois períodos entrou: com o JSX
// repetido, cada tabela precisaria da versão comparada escrita de novo, e a
// primeira que alguém esquecesse mostraria um período só sem avisar.
//
// A copy mora aqui junto da chave porque as duas respondem a mesma pergunta: o
// que este agrupamento diz, e por que vale olhar.
// ============================================================================

/** Uma quebra: o que a tabela agrupa, e o que ela responde. */
export type Quebra = {
  titulo: string;
  explicacao: string;
  chaveDe: (linha: LinhaPublicada) => string;
  /** A ordem da escala, quando a quebra é ordinal. */
  ordem?: readonly string[];
  rotulo?: (chave: string) => string;
  /**
   * Marca o grupo que está fora da vitrine.
   *
   * Campo, e não comparação com o título da tabela: pendurar comportamento num
   * texto de tela quebra calado no dia em que alguém melhora a copy.
   */
  marcaOculto?: boolean;
};

export const QUEBRAS: Quebra[] = [
  {
    titulo: 'Por mercado',
    explicacao:
      'Onde a metodologia está ganhando e onde está perdendo. Acerto alto com ROI negativo é mercado de odd curta; o contrário é mercado que paga bem e erra muito.',
    chaveDe: (l) => l.market,
    rotulo: rotuloDoMercado,
    marcaOculto: true,
  },
  {
    titulo: 'Por faixa de Score',
    explicacao:
      'A promessa central do método: nota maior deveria render mais. Se a coluna de ROI não sobe com a faixa, a nota não está ordenando o resultado — e é a diferença entre faixas, não o número de uma delas, que responde isso.',
    chaveDe: (l) => faixaDoScore(l.score),
    ordem: FAIXAS_DO_SCORE,
  },
  {
    titulo: 'Por faixa de odd',
    explicacao:
      'Odd curta e odd longa não se comportam igual, e a porta de odd por mercado foi desenhada supondo isso. Aqui é onde a suposição aparece medida.',
    // A odd da publicação; a linha sem odd nunca chega aqui, porque sem preço
    // ela não liquida.
    chaveDe: (l) => faixaDeOdd(l.best_odd ?? 0),
    ordem: FAIXAS_DE_ODD,
  },
  {
    titulo: 'Por campeonato',
    explicacao:
      'Da base maior para a menor, porque é o tamanho da base que diz se vale comparar. Campeonato de mata-mata degrada as premissas, e esta é a tabela onde isso aparece.',
    chaveDe: (l) => l.competition ?? 'Sem campeonato',
  },
];

/**
 * As quebras que falam do dado por trás da linha.
 *
 * Ficam na mesma lista das outras porque são cortes do board como qualquer
 * outro. A que media "pontos de premissa" saiu: ela era a aproximação de ROI por
 * premissa, e agora a pergunta é respondida de verdade, premissa por premissa,
 * na seção própria.
 */
export const QUEBRAS_DO_DADO: Quebra[] = [
  {
    titulo: 'Por premissas sem dado',
    explicacao:
      'Quantas premissas não puderam ser avaliadas por falta de dado. Se publicar com evidência faltando sai caro, é aqui que aparece.',
    chaveDe: (l) => faixaSemDado(l.premissas_sem_dado),
    ordem: FAIXAS_SEM_DADO,
  },
  {
    titulo: 'Por corroboração de preço',
    explicacao:
      'Os dois sinais que falam do preço, em grupos que não se sobrepõem: cada aposta entra em um só. O modelo da API vale zero ponto na nota desde a recalibragem, e esta tabela é onde isso se confirma ou não.',
    chaveDe: grupoDeCorroboracao,
    ordem: GRUPOS_DE_CORROBORACAO,
  },
  {
    titulo: 'Por penalidade aplicada',
    explicacao:
      'A penalidade protege ou só corta aposta boa? Grupos exclusivos: aposta com duas flags entra em "mais de uma", e não nas duas.',
    chaveDe: grupoDePenalidade,
    ordem: GRUPOS_DE_PENALIDADE,
  },
];

/** As células de uma quebra, na ordem que ela pede. */
export const celulasDa = (quebra: Quebra, liquidadas: readonly LinhaLiquidada[]): Celula[] =>
  quebra.ordem
    ? quebrarNaOrdem(liquidadas, quebra.chaveDe, quebra.ordem)
    : quebrar(liquidadas, quebra.chaveDe);
