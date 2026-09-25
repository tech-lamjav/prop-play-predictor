import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import { seriesDaEspecificacao, type Metrica, type SerieHistorico, type SerieSpec } from '@/utils/futebol-historico';

/**
 * O gráfico jogo a jogo da aba de Estatísticas.
 *
 * Duas regras sustentam este módulo, e as duas são de domínio:
 *
 * 1. O que ele desenha é **estatística da partida**, não **evidência** de
 *    premissa. Por isso a janela, o mando e o time são escolha de quem olha,
 *    enquanto no gráfico das premissas os três são travados pelo modelo.
 *
 * 2. A LINHA é uma **referência**, não uma aposta. Ela não vem de preço, não
 *    tem lado escolhido e nada aqui é liquidado: mexer nela repinta as barras e
 *    não toca nos valores. É o que impede a aba de virar retrovisor de aposta —
 *    "se você tivesse apostado nos últimos quinze, teria batido nove" é outra
 *    afirmação, e bem mais forte do que esta tela quer fazer.
 *
 * A montagem das barras NÃO é reescrita: é a mesma `seriesDaEspecificacao` que
 * a premissa usa, com a especificação vindo do mercado em vez do mapa `SPECS`.
 */

/** Quem entra no gráfico. O mandante e o visitante são os deste confronto. */
export type QuemNoGrafico = 'ambos' | 'mandante' | 'visitante';

/** O mando recorta DENTRO da janela, nunca antes dela. */
export type MandoDaEstatistica = 'todos' | 'proprio';

/**
 * Os mercados que este gráfico sabe desenhar.
 *
 * É um TIPO e não um texto solto: com `string`, um slug errado — de um link
 * velho, de uma tela nova — cairia calado no mercado padrão e a tela mostraria
 * gols embaixo de um seletor dizendo outra coisa.
 */
export type MercadoDoGrafico =
  | 'goals_over_under'
  | 'asian_handicap'
  | 'btts'
  | 'match_winner'
  | 'double_chance';

/** O slug que veio de fora (link, outra tela) é deste gráfico? */
export function ehMercadoDoGrafico(slug: string | null | undefined): slug is MercadoDoGrafico {
  return !!slug && Object.prototype.hasOwnProperty.call(MERCADOS_NO_GRAFICO, slug);
}

export interface EscolhaDaEstatistica {
  /** Slug do mercado, o mesmo da bancada. */
  mercado: MercadoDoGrafico;
  /** A referência da cor. `null` mostra a média no lugar dela. */
  linha: number | null;
  quem: QuemNoGrafico;
  /** Quantos dos jogos mais recentes entram. */
  janela: number;
  mando: MandoDaEstatistica;
}

/**
 * O que cada mercado mede, jogo a jogo.
 *
 * ⚠️ Só gols e handicap têm quantidade contra a qual uma linha faz sentido — é
 * o mesmo par que a bancada trata como mercado de linha. Ambos marcam é binário
 * e Resultado não tem quantidade nenhuma: desenhar uma linha neles seria
 * oferecer um corte sobre um número que não existe.
 */
export const MERCADOS_NO_GRAFICO: Record<
  MercadoDoGrafico,
  {
    metrica: Metrica;
    temLinha: boolean;
    rotulo: string;
    chip: string;
    paradas: number[];
    padrao: number | null;
    /** Faz sentido ver os dois times na mesma visualização? */
    aceitaOsDois: boolean;
  }
> = {
  // `padrao` é DECLARADO por mercado, e não "a parada do meio da lista": o meio
  // das seis paradas de gols é 3,5 e a linha canônica é 2,5, o que faria quase
  // tudo nascer abaixo da linha e parecer defeito.
  goals_over_under: {
    metrica: 'total', temLinha: true, rotulo: 'Gols no jogo', chip: 'Gols',
    paradas: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5], padrao: 2.5, aceitaOsDois: true,
  },
  asian_handicap: {
    metrica: 'saldo', temLinha: true, rotulo: 'Saldo de gols', chip: 'Handicap',
    paradas: [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5], padrao: -0.5, aceitaOsDois: true,
  },
  // ── Os BINÁRIOS ──────────────────────────────────────────────────────────
  // Resultado, Dupla chance e Ambos marcam não têm grandeza que uma linha
  // recorte: entre vencer e empatar não existe meio-termo para arrastar. Eles
  // mostram COMO FOI cada jogo, em quadros, sem régua.
  //
  // Aceitam os dois times, como todos os outros. Já não aceitaram: o argumento
  // era que sem escala não há altura para comparar, então juntar só faria uma
  // fileira mais longa. Na tela isso não se sustentou — os quadros saem em dois
  // blocos nomeados, um por time, e ver os dois de uma vez é justamente o que
  // se quer num confronto.
  match_winner: {
    metrica: 'resultado', temLinha: false, rotulo: 'Resultado', chip: 'Resultado',
    paradas: [], padrao: null, aceitaOsDois: true,
  },
  double_chance: {
    metrica: 'resultado', temLinha: false, rotulo: 'Resultado', chip: 'Dupla chance',
    paradas: [], padrao: null, aceitaOsDois: true,
  },
  btts: {
    metrica: 'ambos', temLinha: false, rotulo: 'Os dois marcaram', chip: 'Ambos marcam',
    paradas: [], padrao: null, aceitaOsDois: true,
  },
};

/**
 * As janelas oferecidas.
 *
 * 10 é o padrão porque é a janela que o modelo usa na maioria das premissas, e
 * chegar na aba vendo outro recorte faria os dois gráficos da mesma tela
 * discordarem sem motivo. 5 e 20 encurtam e alargam em volta dela.
 */
export const JANELAS_OFERECIDAS = [5, 10, 20] as const;

export const ESCOLHA_PADRAO: EscolhaDaEstatistica = {
  mercado: 'goals_over_under',
  linha: null,
  quem: 'ambos',
  janela: 10,
  mando: 'todos',
};

/**
 * Como ler cada gráfico, na língua desta aba.
 *
 * Escrito aqui e não reusado do módulo das premissas de propósito. Lá o texto
 * do total de gols diz que a linha tracejada é "a linha que você escolheu" — e
 * linha, ali, é a da aposta. Aqui ela é uma referência que a pessoa arrasta, e
 * nenhuma palavra deste arquivo pode sugerir preço.
 */
const COMO_LER: Record<Metrica, string> = {
  total: 'Cada barra é o total de gols daquele jogo, somando os dois times. A linha é uma referência: mexer nela repinta as barras.',
  saldo: 'Cada barra é o saldo do time naquele jogo, positivo na vitória e negativo na derrota. A linha é uma referência: mexer nela repinta as barras.',
  // ⚠️ Fala de QUADRO, não de barra: este mercado é binário e desenha quadro.
  // Dizer "barra" aqui seria a legenda desmentindo o desenho logo acima dela.
  ambos: 'Cada quadrado é um jogo, com o placar e o adversário. Verde quando os dois marcaram, vermelho quando algum passou em branco.',
  resultado: 'Cada quadrado é um jogo, com o placar e o adversário. Verde é vitória, cinza empate, vermelho derrota.',
  gf: 'Cada barra é um jogo: quanto mais alta, mais gols o time marcou. A linha é uma referência.',
  ga: 'Cada barra é um jogo: quanto mais alta, mais gols o time sofreu. A linha é uma referência.',
  xg: 'Cada barra é o gol esperado do time no jogo, ou seja, quanta chance ele criou. A linha é uma referência.',
  sem_sofrer: 'Cada barra é um jogo: cheia quando o time não sofreu gol, vazia quando sofreu.',
  sem_marcar: 'Cada barra é um jogo: cheia quando o time não marcou, vazia quando marcou.',
};

export interface GraficoDaEstatistica {
  series: SerieHistorico[];
  /** O mercado tem quantidade contra a qual uma linha faz sentido? */
  temLinha: boolean;
  /** A referência desenhada. `null` quando o mercado não tem linha. */
  referencia: number | null;
  /**
   * Quantas barras passaram da referência, e de quantas.
   *
   * ⚠️ Quem exibir isto TEM de dizer a janela na mesma frase. Existe premissa
   * que conta os últimos cinco contra a linha, com janela travada pelo modelo:
   * dois números da mesma forma só não se contradizem porque cada um declara a
   * base de onde saiu.
   */
  contagem: { acima: number; de: number } | null;
}

/** O papel de cada escolha de time dentro da especificação da série. */
function papelDe(quem: QuemNoGrafico): { quem: SerieSpec['quem']; lado: 'home' | 'away' | null } {
  if (quem === 'mandante') return { quem: 'time', lado: 'home' };
  if (quem === 'visitante') return { quem: 'time', lado: 'away' };
  return { quem: 'ambos', lado: null };
}

export function graficoDaEstatistica(
  escolha: EscolhaDaEstatistica,
  hist: FutebolFixtureHistorico[] | undefined,
): GraficoDaEstatistica {
  const doMercado = MERCADOS_NO_GRAFICO[escolha.mercado];
  const papel = papelDe(escolha.quem);
  const spec: SerieSpec = {
    quem: papel.quem,
    metrica: doMercado.metrica,
    mando: escolha.mando,
    direcao: 'maior',
    ultimos: escolha.janela,
    // A janela desta aba são os últimos jogos do time em QUALQUER competição,
    // que é o que a consulta devolve e o que "últimos 10 jogos" quer dizer.
    competicoes: 'qualquer',
  };

  // `linha` não desce para o montador: lá dentro ela é a linha da APOSTA e vale
  // só para o total de gols. Aqui ela é referência e vale para toda métrica
  // numérica, então a régua da cor é recalculada aqui — sem tocar no caminho
  // das premissas.
  const cruas = seriesDaEspecificacao([spec], hist, papel.lado, null, 'estatistica');
  // Mercado com régua usa a linha escolhida; o binário usa a referência fixa do
  // catálogo, que não aparece como controle mas ainda decide a cor.
  const referencia = doMercado.temLinha ? escolha.linha : doMercado.padrao;

  const series = cruas.map((s) => ({
    ...s,
    comoLer: COMO_LER[doMercado.metrica],
    // ⚠️ A média SAI quando existe linha. Os dois são tracejados, e dois
    // tracejados com significados diferentes no mesmo gráfico é pior que
    // nenhum: quem arrasta a régua vê um traço que não se mexe e conclui que a
    // régua não funciona.
    mostraMedia: referencia == null,
    jogos:
      referencia == null
        ? s.jogos
        : s.jogos.map((j) => ({
            ...j,
            // Comparação ESTRITA, a mesma do resto do código: um jogo de 2 gols
            // não passa de uma referência de 2.
            favorece: j.valor != null && j.valor > referencia,
          })),
  }));

  const comValor = series.flatMap((s) => s.jogos).filter((j) => j.valor != null);
  const contagem =
    referencia == null
      ? null
      : { acima: comValor.filter((j) => (j.valor as number) > referencia).length, de: comValor.length };

  return { series, temLinha: doMercado.temLinha, referencia, contagem };
}
