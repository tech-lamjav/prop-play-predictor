import { isHit, settleFutebol, type BetResult } from '@/utils/futebol-settlement';

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

/** Uma oportunidade com veredito e o lucro que ela deu em unidades. */
export type LinhaLiquidada = {
  linha: LinhaPublicada;
  veredito: BetResult;
  lucro: number;
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
export function liquidarTudo(publicadas: readonly LinhaPublicada[]): {
  liquidadas: LinhaLiquidada[];
  pendentes: LinhaPublicada[];
} {
  const liquidadas: LinhaLiquidada[] = [];
  const pendentes: LinhaPublicada[] = [];

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

    liquidadas.push({ linha, veredito, lucro: lucroDaAposta(veredito, linha.best_odd) });
  }

  return { liquidadas, pendentes };
}

/** Uma linha de tabela: o grupo, o tamanho dele e o que ele diz. */
export type Celula = {
  chave: string;
  /** Apostas liquidadas no grupo. É o denominador do ROI. */
  n: number;
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
  if (n === 0) return { chave, n: 0, acertos: 0, anuladas: 0, taxa: null, roi: 0, ep: 0 };

  const lucros = liquidadas.map((l) => l.lucro);
  const media = lucros.reduce((a, b) => a + b, 0) / n;
  const variancia =
    n > 1 ? lucros.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1) : 0;

  const anuladas = liquidadas.filter((l) => l.veredito === 'push').length;
  const acertos = liquidadas.filter((l) => isHit(l.veredito)).length;
  const decididas = n - anuladas;

  return {
    chave,
    n,
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

export function faixaDoScore(score: number): string {
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

export function faixaDeOdd(odd: number): string {
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
};

export function totalDoPeriodo(publicadas: readonly LinhaPublicada[]): Total {
  const { liquidadas, pendentes } = liquidarTudo(publicadas);
  return {
    ...celulaDe('Total', liquidadas),
    publicadas: publicadas.length,
    pendentes: pendentes.length,
  };
}
