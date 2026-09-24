import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import { seriesDaEspecificacao, type Metrica, type SerieHistorico, type SerieSpec } from '@/utils/futebol-historico';

/**
 * A série jogo a jogo da aba de Estatísticas.
 *
 * O que ela desenha é **estatística da partida**, e não **evidência** de
 * premissa. A distinção está no glossário e é ela que sustenta este módulo
 * existir separado: aqui a janela e o mando são ESCOLHA de quem olha, enquanto
 * no gráfico das premissas os dois são travados pelo modelo, porque lá o
 * gráfico responde por um número que o modelo calculou.
 *
 * ⚠️ Daí sai a regra que este arquivo não pode quebrar: nada aqui aparece
 * embaixo de uma premissa, e nada aqui se chama evidência. A migration 095 já
 * tinha escrito o porquê ao deixar finalização, escanteio e posse de fora do
 * jogo a jogo — "publicar um número nosso como se fosse o da premissa seria
 * fingir auditoria".
 *
 * A montagem das barras NÃO é reescrita: é a mesma `seriesDaEspecificacao` que
 * a premissa usa, com a especificação vindo da escolha em vez do mapa `SPECS`.
 * Um segundo montador é como este arquivo já se contradisse antes (#350), e o
 * defeito não aparece em leitura de código.
 */

export type MetricaDaEstatistica = Extract<Metrica, 'gf' | 'ga' | 'total' | 'xg'>;

/** O mando recorta DENTRO da janela, nunca antes dela. */
export type MandoDaEstatistica = 'todos' | 'proprio';

export interface EscolhaDaEstatistica {
  metrica: MetricaDaEstatistica;
  /** Quantos dos jogos mais recentes entram. */
  janela: number;
  mando: MandoDaEstatistica;
}

export const METRICAS_OFERECIDAS: { valor: MetricaDaEstatistica; rotulo: string }[] = [
  { valor: 'gf', rotulo: 'Gols marcados' },
  { valor: 'ga', rotulo: 'Gols sofridos' },
  { valor: 'total', rotulo: 'Gols no jogo' },
  { valor: 'xg', rotulo: 'Gols esperados' },
];

/**
 * As janelas oferecidas.
 *
 * 10 é o padrão porque é a janela que o modelo usa na maioria das premissas, e
 * chegar na aba vendo outro recorte faria os dois gráficos da mesma tela
 * discordarem sem motivo. 5 e 20 existem para encurtar e alargar em volta dela.
 */
export const JANELAS_OFERECIDAS = [5, 10, 20] as const;

export const ESCOLHA_PADRAO: EscolhaDaEstatistica = { metrica: 'gf', janela: 10, mando: 'todos' };

/**
 * Como ler cada gráfico, na língua desta aba.
 *
 * Escrito aqui e não reusado do módulo das premissas de propósito. Lá o texto
 * do total de gols diz que a linha tracejada é "a linha que você escolheu" — e
 * linha, ali, é a da aposta. Nesta aba não há aposta escolhida: repetir aquela
 * frase seria a tela afirmar um conceito que ela não tem.
 */
const COMO_LER: Record<MetricaDaEstatistica, string> = {
  gf: 'Cada barra é um jogo: quanto mais alta, mais gols o time marcou. A linha tracejada é a média dos jogos desenhados.',
  ga: 'Cada barra é um jogo: quanto mais alta, mais gols o time sofreu. A linha tracejada é a média dos jogos desenhados.',
  total: 'Cada barra é o total de gols daquele jogo, somando os dois times. A linha tracejada é a média dos jogos desenhados.',
  xg: 'Cada barra é o gol esperado do time no jogo, ou seja, quanta chance ele criou. A linha tracejada é a média dos jogos desenhados.',
};

/**
 * As barras dos dois times, na escala que o componente compartilha.
 *
 * `direcao: 'maior'` e linha nula não são detalhe: juntos fazem a régua de cada
 * barra ser a MÉDIA do próprio time, e não um limiar de aposta. É por isso que
 * a cor aqui só pode significar "acima ou abaixo da média" — dizer que uma
 * barra "joga a favor" exigiria uma saída escolhida, que esta aba não tem.
 */
export function seriesDaEstatistica(
  escolha: EscolhaDaEstatistica,
  hist: FutebolFixtureHistorico[] | undefined,
): SerieHistorico[] {
  const spec: SerieSpec = {
    quem: 'ambos',
    metrica: escolha.metrica,
    mando: escolha.mando,
    direcao: 'maior',
    ultimos: escolha.janela,
    // A janela desta aba são os últimos jogos do time em QUALQUER competição,
    // que é o que a consulta devolve e o que "últimos 10 jogos" quer dizer.
    competicoes: 'qualquer',
  };
  return seriesDaEspecificacao([spec], hist, null, null, 'estatistica').map((s) => ({
    ...s,
    comoLer: COMO_LER[escolha.metrica],
  }));
}
