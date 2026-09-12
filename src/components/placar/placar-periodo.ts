import { addDays, brtDayOf, parseUtc } from '@/utils/futebol-datas';
import type { LinhaPublicada } from './placar-agregacao';
import {
  DIA_EM_QUE_O_HISTORICO_COMECOU,
  INICIO_DA_SERIE_COMPARAVEL,
  INSTANTE_DA_VIRADA,
} from './placar-vocabulario';

// ============================================================================
// placar-periodo.ts — a janela que o placar está olhando, e por qual data
// ============================================================================
// Duas perguntas diferentes moram aqui, e a tela obriga a escolher uma:
//
//   · POR APITO mede o resultado da semana — o que aconteceu nos jogos dela;
//   · POR DETECÇÃO mede a régua que publicou — o que a metodologia escolheu
//     naquela semana, liquidado quando quer que o jogo tenha sido.
//
// A RPC devolve tudo que toca o período pelos dois eixos, então filtrar pelo
// eixo escolhido é trabalho daqui: sem isso, a leitura por apito recebe de
// brinde linhas detectadas na janela cujo jogo caiu fora dela.
// ============================================================================

export type Eixo = 'jogo' | 'deteccao';

export type Periodo = { de: string; ate: string };

export const ROTULO_DO_EIXO: Record<Eixo, string> = {
  jogo: 'Pelo dia do jogo',
  deteccao: 'Pelo dia da detecção',
};

export const EXPLICACAO_DO_EIXO: Record<Eixo, string> = {
  jogo: 'Mede o resultado da semana: o que aconteceu nos jogos dela.',
  deteccao: 'Mede a régua que publicou: o que a metodologia escolheu na semana.',
};

/** O dia BRT da linha no eixo escolhido. */
export function diaDaLinha(linha: LinhaPublicada, eixo: Eixo): string | null {
  return brtDayOf(eixo === 'jogo' ? linha.kickoff_utc : linha.detectada_em);
}

export function noPeriodo(linha: LinhaPublicada, eixo: Eixo, periodo: Periodo): boolean {
  const dia = diaDaLinha(linha, eixo);
  return dia !== null && dia >= periodo.de && dia <= periodo.ate;
}

export function filtrarPeloEixo(
  linhas: readonly LinhaPublicada[],
  eixo: Eixo,
  periodo: Periodo,
): LinhaPublicada[] {
  return linhas.filter((l) => noPeriodo(l, eixo, periodo));
}

/** O período que abre por padrão: a série comparável inteira, até hoje. */
export const periodoPadrao = (hoje: string): Periodo => ({
  de: INICIO_DA_SERIE_COMPARAVEL,
  ate: hoje,
});

/**
 * Os atalhos de janela.
 *
 * Curtos de propósito: são as janelas que a decisão usa de verdade. "A série
 * inteira" é o padrão porque é a maior amostra comparável que existe, e decisão
 * de peso de premissa precisa de amostra antes de precisar de recorte.
 */
export const ATALHOS: { id: string; rotulo: string; periodo: (hoje: string) => Periodo }[] = [
  { id: 'serie', rotulo: 'Série comparável', periodo: periodoPadrao },
  { id: '7', rotulo: 'Últimos 7 dias', periodo: (hoje) => ({ de: addDays(hoje, -6), ate: hoje }) },
  { id: '30', rotulo: 'Últimos 30 dias', periodo: (hoje) => ({ de: addDays(hoje, -29), ate: hoje }) },
  { id: 'personalizado', rotulo: 'Escolher as datas', periodo: periodoPadrao },
];

/**
 * Os avisos que o período escolhido exige.
 *
 * Os dois existem porque o histórico tem duas descontinuidades, e nenhuma delas
 * é visível na tabela: ela mostra números que parecem comparáveis.
 */
export function avisosDoPeriodo(periodo: Periodo, eixo: Eixo): string[] {
  const avisos: string[] = [];

  if (periodo.de < INICIO_DA_SERIE_COMPARAVEL) {
    avisos.push(
      'O período começa antes de 04/09/2026, quando o denominador do Score trocou do p95 para o teto de pontos. A nota das linhas anteriores está em OUTRA escala, então as faixas de Score misturam duas réguas — e o histórico é append-only, não existe recálculo que conserte isso. Mais cedo ainda, a linha do método antigo (score_versao legacy) não entra nesta conta em momento nenhum: ela é outro modelo, e não outra escala do mesmo.',
    );
  }

  if (eixo === 'deteccao' && periodo.de <= DIA_EM_QUE_O_HISTORICO_COMECOU && periodo.ate >= DIA_EM_QUE_O_HISTORICO_COMECOU) {
    avisos.push(
      'Contando por detecção, o dia 03/09/2026 é o dia em que o histórico começou: o board inteiro entrou de uma vez, e centenas de linhas nasceram no mesmo instante. Aquele dia é uma pilha, e não um dia de operação.',
    );
  }

  return avisos;
}

/**
 * A janela de mesmo tamanho imediatamente anterior.
 *
 * É o padrão da comparação porque é a pergunta que se faz primeiro: mudou algo
 * em relação ao período de antes? Mesmo tamanho de propósito — comparar uma
 * semana contra um mês compara também dois tamanhos de amostra.
 */
export function periodoAnterior(periodo: Periodo): Periodo {
  const dias = Math.round(
    (new Date(`${periodo.ate}T12:00:00Z`).getTime() -
      new Date(`${periodo.de}T12:00:00Z`).getTime()) /
      86_400_000,
  );
  const ate = addDays(periodo.de, -1);
  return { de: addDays(ate, -dias), ate };
}

/** O período como rótulo de coluna: `04/09 a 12/09`. */
export function rotuloDoPeriodo(periodo: Periodo): string {
  const curto = (dia: string) => dia.slice(8, 10) + '/' + dia.slice(5, 7);
  return periodo.de === periodo.ate ? curto(periodo.de) : `${curto(periodo.de)} a ${curto(periodo.ate)}`;
}

/**
 * Tira da conta o que nasceu antes da virada, quando a janela é a comparável.
 *
 * A virada do denominador entrou às 14h35 UTC de 04/09, e o período abre no dia
 * 04/09 inteiro: as linhas da madrugada daquele dia têm nota na escala antiga.
 * Elas saem, e a tela diz quantas saíram — série comparável que mistura duas
 * réguas não é comparável, e o nome mentiria.
 *
 * ⚠️ Só recorta quando o sócio pediu a série comparável (a janela começa em
 * 04/09 ou depois). Se ele pediu uma janela ANTERIOR, ele quer o período antigo
 * inteiro, e aí quem avisa é `avisosDoPeriodo` em vez de o filtro apagar dado
 * que ele foi buscar.
 */
export function recorteDaSerieComparavel(
  linhas: readonly LinhaPublicada[],
  periodo: Periodo,
): { linhas: LinhaPublicada[]; foraDaEscala: number } {
  if (periodo.de < INICIO_DA_SERIE_COMPARAVEL) {
    return { linhas: [...linhas], foraDaEscala: 0 };
  }

  const corte = Date.parse(INSTANTE_DA_VIRADA);
  const dentro = linhas.filter((l) => {
    const nasceu = parseUtc(l.detectada_em)?.getTime();
    return nasceu == null || nasceu >= corte;
  });

  return { linhas: dentro, foraDaEscala: linhas.length - dentro.length };
}
