import { parseUtc } from '@/utils/futebol-datas';
import { isHit, settleFutebol, type BetResult } from '@/utils/futebol-settlement';
import { INSTANTE_DA_VIRADA } from './placar-vocabulario';

// ============================================================================
// placar-agregacao.ts — a aritmética do placar da metodologia
// ============================================================================
// Recebe as oportunidades publicadas que a RPC devolveu, liquida cada uma com a
// regra do site e devolve as células das tabelas. Sem tela e sem rede: é o
// módulo onde toda conta do placar mora, e o único lugar onde ela mora.
//
// A liquidação vem de `futebol-settlement.ts`, chamada e não copiada (ADR 0002).
// A conta de ROI, taxa e erro-padrão é a mesma de `scripts/futebol-roi.mjs`, e
// `placar-paridade.test.ts` é quem garante que as duas não se afastem.
// ============================================================================

/**
 * Uma oportunidade publicada, como a RPC a devolve.
 *
 * É a FOTO DE NASCIMENTO: a odd, a nota e a faixa com que ela foi publicada e
 * alertada, e não o estado dela no apito (ADR 0003). Os nomes ficam em
 * snake_case, como nos outros contratos de RPC do futebol, para não haver uma
 * camada de tradução no meio só para trocar a grafia.
 */
export type LinhaPublicada = {
  opportunity_key: string;
  fixture_id: number;
  competition: string | null;
  home_team_name: string | null;
  away_team_name: string | null;
  kickoff_utc: string;
  status_short: string | null;
  goals_home: number | null;
  goals_away: number | null;
  /** Quando a oportunidade nasceu no histórico. Não é a data do jogo. */
  detectada_em: string;
  market: string;
  outcome: string;
  line_value: number | null;
  best_odd: number | null;
  edge: number | null;
  score: number;
  faixa: string | null;
  score_versao: string;
  pts_premissas: number;
  penalidades: number;
  premissas_sem_dado: number;
  modelo_api_concorda: boolean | null;
  linha_sharp_confirma: boolean | null;
  pen_odd_outlier: boolean | null;
  pen_poucas_casas: boolean | null;
  pen_odd_longshot: boolean | null;
  pen_odd_juice: boolean | null;
  /**
   * As premissas que ACENDERAM nesta linha, pelos slugs do catálogo.
   *
   * ⚠️ Recalculadas todo dia pelo mart, a partir de janelas anteriores ao apito.
   * Para jogo passado o valor é estável, porque os insumos estão congelados —
   * mas mudar o critério de uma premissa reescreve o passado. Não é registro
   * point-in-time do que foi publicado.
   *
   * As APAGADAS não viajam: o conjunto de cada lado é fixo no catálogo do
   * produto, e a ausência de um slug aqui significa "não atingiu o corte" OU
   * "sem dado" — as tabelas do mart não têm nulo, e é por isso que
   * `premissas_sem_dado` continua vindo à parte.
   */
  premissas_acesas: string[] | null;
};

/**
 * Os estados em que o jogo acabou de verdade.
 *
 * O placar de um jogo em andamento já vem preenchido no fato, então liquidar
 * pelo placar daria green no intervalo. Quem decide é o estado, não o placar.
 * `AET` é decisão na prorrogação e `PEN` nos pênaltis.
 */
export const STATUS_ENCERRADOS = ['FT', 'AET', 'PEN'] as const;

export const jogoEncerrado = (status: string | null | undefined) =>
  !!status && (STATUS_ENCERRADOS as readonly string[]).includes(status);

/** Uma oportunidade com veredito e o lucro que ela deu POR UNIDADE apostada. */
export type LinhaLiquidada = {
  linha: LinhaPublicada;
  veredito: BetResult;
  /** Lucro de UMA unidade. O peso entra na conta da célula, não aqui. */
  lucro: number;
  /** Quantas unidades foram apostadas nela, pela simulação vigente. */
  unidades: number;
};


/** O lucro de uma aposta de UMA unidade. Espelha `lucroDaAposta` do script. */
export function lucroDaAposta(veredito: BetResult, odd: number): number {
  switch (veredito) {
    case 'won':
      return odd - 1;
    case 'half_won':
      return (odd - 1) / 2;
    case 'push':
      return 0;
    case 'half_lost':
      return -0.5;
    default:
      return -1;
  }
}

/**
 * Separa o que dá para medir do que ainda não dá.
 *
 * Pendente é tudo que não recebeu veredito: jogo por acabar, jogo encerrado sem
 * placar no fato, e mercado que a regra de liquidação ainda não conhece. Os três
 * ficam de fora de toda conta e são contados à parte — a tela precisa dizer
 * quantos são, porque é o número que explica por que a conta vai mudar amanhã.
 */
export function liquidarTudo(
  publicadas: readonly LinhaPublicada[],
  pesos: PesoPorFaixa = PESO_MEDIDO,
): {
  liquidadas: LinhaLiquidada[];
  pendentes: LinhaPublicada[];
  /** Liquidadas que a simulação mandou não apostar (peso zero). */
  foraDaSimulacao: LinhaPublicada[];
} {
  const liquidadas: LinhaLiquidada[] = [];
  const pendentes: LinhaPublicada[] = [];
  const foraDaSimulacao: LinhaPublicada[] = [];

  for (const linha of publicadas) {
    const veredito = jogoEncerrado(linha.status_short)
      ? settleFutebol(
          { market: linha.market, outcome: linha.outcome, line_value: linha.line_value },
          linha.goals_home,
          linha.goals_away,
        )
      : null;

    if (veredito == null || linha.best_odd == null) {
      pendentes.push(linha);
      continue;
    }

    // Linha de régua anterior não tem faixa comparável, então a simulação por
    // faixa não a toca: ela entra com uma unidade. Mandar "não apostar na
    // Baixa" não pode decidir calado o que fazer com uma nota que não é
    // comparável com a Baixa.
    const faixa = faixaDaLinha(linha);
    const unidades = (faixa == null ? 1 : pesos[faixa]) ?? 1;
    if (unidades <= 0) {
      foraDaSimulacao.push(linha);
      continue;
    }

    liquidadas.push({
      linha,
      veredito,
      lucro: lucroDaAposta(veredito, linha.best_odd),
      unidades,
    });
  }

  return { liquidadas, pendentes, foraDaSimulacao };
}

/** Uma linha de tabela: o grupo, o tamanho dele e o que ele diz. */
export type Celula = {
  chave: string;
  /** Apostas liquidadas no grupo que entraram na conta. */
  n: number;
  /**
   * Unidades apostadas, somadas. É o DENOMINADOR do ROI.
   *
   * Igual a `n` no modo medido, porque ali cada aposta vale uma unidade. Em
   * simulação os dois se separam, e é a diferença entre eles que explica por que
   * o ROI mudou sem a taxa de acerto mudar.
   */
  unidades: number;
  acertos: number;
  anuladas: number;
  /**
   * Acertos sobre as liquidadas que valeram aposta — anulada fora do
   * denominador. `null` quando não houve nenhuma decidida: taxa de zero aposta
   * não é 0%, é ausência de resposta, e 0% afirmaria que errou tudo.
   */
  taxa: number | null;
  /** Lucro médio por unidade apostada. Anulada conta, com lucro zero. */
  roi: number;
  /**
   * O erro-padrão do ROI.
   *
   * Não é enfeite: com uma semana de amostra, quase toda diferença entre grupos
   * cabe dentro dele. Sem esta coluna a tabela convida a decidir peso de
   * premissa em cima de ruído. Em grupo de uma aposta ele é zero, e zero aqui
   * é ausência de amostra para estimá-lo, não precisão.
   */
  ep: number;
};

export function celulaDe(chave: string, liquidadas: readonly LinhaLiquidada[]): Celula {
  const n = liquidadas.length;
  if (n === 0)
    return { chave, n: 0, unidades: 0, acertos: 0, anuladas: 0, taxa: null, roi: 0, ep: 0 };

  const unidades = liquidadas.reduce((a, l) => a + l.unidades, 0);
  // ROI em unidades: lucro total sobre unidades apostadas. Com peso 1 em tudo
  // isto é exatamente a média dos lucros, que é o número medido.
  const media = liquidadas.reduce((a, l) => a + l.lucro * l.unidades, 0) / unidades;

  // O erro-padrão é calculado sobre o lucro POR UNIDADE, sem o peso. Com peso 1
  // em tudo ele é o de sempre; em simulação ele é aproximado, e a tela diz que
  // está simulando — inventar um erro ponderado aqui seria estatística de
  // fachada em cima de uma amostra que já é pequena.
  const lucros = liquidadas.map((l) => l.lucro);
  const mediaSimples = lucros.reduce((a, b) => a + b, 0) / n;
  const variancia =
    n > 1 ? lucros.reduce((a, b) => a + (b - mediaSimples) ** 2, 0) / (n - 1) : 0;

  const anuladas = liquidadas.filter((l) => l.veredito === 'push').length;
  const acertos = liquidadas.filter((l) => isHit(l.veredito)).length;
  const decididas = n - anuladas;

  return {
    chave,
    n,
    unidades,
    acertos,
    anuladas,
    taxa: decididas ? acertos / decididas : null,
    roi: media,
    ep: Math.sqrt(variancia / n),
  };
}

/**
 * Uma tabela: as células de cada grupo, da base maior para a menor.
 *
 * A ordem é o tamanho da base, e não o ROI. A primeira linha da tabela é a que
 * a amostra sustenta — ordenar por ROI põe no topo o grupo de três apostas que
 * por sorte deu 60%, que é exatamente a leitura que o placar existe para evitar.
 * Empate resolve pelo nome, para a tabela não dançar entre recargas.
 */
export function quebrar(
  liquidadas: readonly LinhaLiquidada[],
  chaveDe: (linha: LinhaPublicada) => string,
): Celula[] {
  const grupos = new Map<string, LinhaLiquidada[]>();
  for (const l of liquidadas) {
    const chave = chaveDe(l.linha);
    const atual = grupos.get(chave);
    if (atual) atual.push(l);
    else grupos.set(chave, [l]);
  }

  return [...grupos.entries()]
    .map(([chave, linhas]) => celulaDe(chave, linhas))
    .sort((a, b) => b.n - a.n || a.chave.localeCompare(b.chave));
}

/**
 * Uma tabela de escala ORDINAL: a ordem é a da escala, não a da base.
 *
 * Faixa de Score e faixa de odd são degraus, e a pergunta que a tabela responde
 * é se o resultado sobe ou desce ao subir o degrau. Ordenada pela base, a mesma
 * tabela vira uma lista de grupos soltos e a resposta desaparece.
 *
 * Grupo sem nenhuma aposta liquidada não vira linha: linha com zero apostas e
 * traço em toda coluna só ocupa espaço.
 */
export function quebrarNaOrdem(
  liquidadas: readonly LinhaLiquidada[],
  chaveDe: (linha: LinhaPublicada) => string,
  ordem: readonly string[],
): Celula[] {
  const porChave = new Map(quebrar(liquidadas, chaveDe).map((c) => [c.chave, c]));
  return ordem.map((chave) => porChave.get(chave)).filter((c): c is Celula => c !== undefined);
}

/**
 * As quatro faixas de Score, no vocabulário que o assinante vê.
 *
 * A Alta vem partida em duas: eram duas tabelas — "por faixa" e "por corte de
 * Score" — e a segunda era a primeira com um corte a mais, que é a mesma
 * informação escrita duas vezes. O corte extra em 80 vive dentro da faixa.
 *
 * ⚠️ Os limites são os mesmos de `scripts/futebol-roi.mjs`, e a paridade tem
 * teste: divergir daria duas verdades para a mesma semana.
 */
export const FAIXAS_DO_SCORE = [
  'Baixa (<30)',
  'Média (30–59)',
  'Alta (60–79)',
  'Alta (80+)',
] as const;

export type FaixaDoScore = (typeof FAIXAS_DO_SCORE)[number];

export function faixaDoScore(score: number): FaixaDoScore {
  if (score < 30) return FAIXAS_DO_SCORE[0];
  if (score < 60) return FAIXAS_DO_SCORE[1];
  if (score < 80) return FAIXAS_DO_SCORE[2];
  return FAIXAS_DO_SCORE[3];
}

/**
 * As quatro faixas de odd.
 *
 * Começam em 1,25 e param em 4,00 porque é a porta de odd que o produto publica
 * — fora dela não existe oportunidade para medir.
 */
export const FAIXAS_DE_ODD = ['1.25–1.59', '1.60–1.99', '2.00–2.59', '2.60–4.00'] as const;

export type FaixaDeOdd = (typeof FAIXAS_DE_ODD)[number];

/**
 * A nota desta linha foi calculada na RÉGUA ANTERIOR?
 *
 * A virada do denominador entrou em 04/09/2026 às 14h35 UTC, e linha publicada
 * antes disso tem nota em outra escala — a média caiu de 41,1 para 33,5 e a nota
 * 100 deixou de ser 9,2% do board para ser 4,1%. Um 80 de antes não é um 80 de
 * agora.
 *
 * ⚠️ Isso NÃO é recorte de data e não tem nada a ver com o período escolhido: a
 * linha publicada em 03/09 para um jogo de 08/09 tem régua anterior e jogo
 * dentro de qualquer janela de setembro. Quem confunde as duas coisas lê a
 * régua como se fosse uma coluna do calendário.
 *
 * ⚠️ E elas NÃO saem da amostra. A primeira versão desta tela descartava todas,
 * em nome da "série comparável", e isso jogava fora 930 de 1.919 apostas
 * liquidadas no período padrão. ROI por mercado, campeonato, odd ou premissa não
 * depende da escala da nota; só a leitura POR FAIXA depende, e é só de lá que
 * elas ficam de fora.
 */
export const naEscalaAntiga = (linha: LinhaPublicada) => {
  const nasceu = parseUtc(linha.detectada_em)?.getTime();
  return nasceu != null && nasceu < Date.parse(INSTANTE_DA_VIRADA);
};

/**
 * A faixa de uma LINHA. `null` quando a nota não é comparável.
 *
 * É esta que a tela usa onde a faixa importa. `faixaDoScore` continua pura,
 * olhando só o número, porque é ela que o script de terminal espelha.
 */
export const faixaDaLinha = (linha: LinhaPublicada): string | null =>
  naEscalaAntiga(linha) ? null : faixaDoScore(linha.score);

/**
 * Quanto apostar em cada faixa de Score.
 *
 * O padrão é uma unidade em tudo, e esse é o número MEDIDO — o que de fato
 * aconteceria apostando igual em toda oportunidade publicada. Mexer aqui vira
 * SIMULAÇÃO, e a tela tem de dizer isso: a decisão da spec foi unidade fixa
 * justamente porque tamanho variável de aposta mistura "a metodologia acerta?" com "o
 * critério de tamanho é bom?".
 *
 * Peso zero não é aposta de zero unidade: é não apostar. A linha sai da conta
 * inteira, denominador incluído, e é contada à parte.
 */
export type PesoPorFaixa = Record<string, number>;

export const PESO_MEDIDO: PesoPorFaixa = {
  'Baixa (<30)': 1,
  'Média (30–59)': 1,
  'Alta (60–79)': 1,
  'Alta (80+)': 1,
};

export const ehSimulacao = (pesos: PesoPorFaixa) =>
  Object.values(pesos).some((p) => p !== 1);

export function faixaDeOdd(odd: number): FaixaDeOdd {
  if (odd < 1.6) return FAIXAS_DE_ODD[0];
  if (odd < 2.0) return FAIXAS_DE_ODD[1];
  if (odd < 2.6) return FAIXAS_DE_ODD[2];
  return FAIXAS_DE_ODD[3];
}

/** O total do período: a célula de tudo junto, com o que não liquidou à parte. */
export type Total = Celula & {
  /** Oportunidades publicadas no período, liquidadas ou não. */
  publicadas: number;
  pendentes: number;
  /** Liquidadas que a simulação mandou não apostar. Zero no modo medido. */
  foraDaSimulacao: number;
};

/**
 * O total a partir de uma liquidação que JÁ foi feita.
 *
 * Existe porque a tela precisa das liquidadas para as tabelas e do total para o
 * topo, e `totalDoPeriodo` liquidaria tudo de novo — a mesma conta duas vezes
 * em cima da mesma lista, a cada render.
 */
export function totalDe(
  liquidadas: readonly LinhaLiquidada[],
  pendentes: readonly LinhaPublicada[],
  foraDaSimulacao: readonly LinhaPublicada[] = [],
): Total {
  return {
    ...celulaDe('Total', liquidadas),
    publicadas: liquidadas.length + pendentes.length + foraDaSimulacao.length,
    pendentes: pendentes.length,
    foraDaSimulacao: foraDaSimulacao.length,
  };
}

export function totalDoPeriodo(
  publicadas: readonly LinhaPublicada[],
  pesos: PesoPorFaixa = PESO_MEDIDO,
): Total {
  const { liquidadas, pendentes, foraDaSimulacao } = liquidarTudo(publicadas, pesos);
  return totalDe(liquidadas, pendentes, foraDaSimulacao);
}
