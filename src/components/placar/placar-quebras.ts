import {
  FAIXAS_DE_ODD,
  FAIXAS_DO_SCORE,
  faixaDaLinha,
  faixaDeOdd,
  naEscalaAntiga,
  quebrar,
  quebrarNaOrdem,
  type Celula,
  type LinhaLiquidada,
  type LinhaPublicada,
} from './placar-agregacao';
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
  /**
   * Quem entra nesta quebra. O padrão é todo mundo.
   *
   * Existe por causa de uma quebra só: a de faixa de Score não pode misturar
   * duas réguas de nota. Em vez de inventar uma faixa "régua anterior" — que
   * numa tabela de colunas por data lê como recorte de calendário, e não é —,
   * a linha antiga simplesmente não entra AQUI, e a tela diz quantas são.
   */
  entra?: (linha: LinhaPublicada) => boolean;
  /** O que dizer sobre quem ficou de fora, quando `entra` recusa alguém. */
  notaDosFora?: string;
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
    chaveDe: (l) => faixaDaLinha(l) ?? '',
    ordem: FAIXAS_DO_SCORE,
    entra: (l) => !naEscalaAntiga(l),
    notaDosFora:
      'foram publicadas antes da virada do denominador, em 04/09 às 14h35 UTC, e têm nota em outra régua. Não é recorte de data: elas têm jogo dentro do período e contam em todas as outras tabelas — só a comparação por faixa exigiria a mesma régua.',
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

/** As linhas que a quebra aceita. */
export const linhasDa = (quebra: Quebra, liquidadas: readonly LinhaLiquidada[]) =>
  quebra.entra ? liquidadas.filter((l) => quebra.entra!(l.linha)) : liquidadas;

export const celulasDa = (quebra: Quebra, liquidadas: readonly LinhaLiquidada[]): Celula[] => {
  const dela = linhasDa(quebra, liquidadas);
  return quebra.ordem
    ? quebrarNaOrdem(dela, quebra.chaveDe, quebra.ordem)
    : quebrar(dela, quebra.chaveDe);
};
