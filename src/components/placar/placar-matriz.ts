import { margemDaSaida } from '@/utils/futebol-settlement';
import { celulaDe, type Celula, type LinhaLiquidada } from './placar-agregacao';
import { gavetaDe, rotuloDaGaveta, type Granularidade } from './placar-evolucao';
import { diaDaLinha, type Eixo } from './placar-periodo';
import { linhasDa, type Quebra } from './placar-quebras';

// ============================================================================
// placar-matriz.ts — a mesma quebra, agora com o tempo nas colunas
// ============================================================================
// A tabela de uma coluna responde "como foi o período". A matriz responde "como
// foi cada semana", que é a pergunta que se faz de verdade quando o ROI do
// período é ruim: caiu sempre, ou caiu num dia?
//
// Cada célula guarda as LINHAS que a formaram, e não só o número. É o que
// permite abrir a célula e ver o que puxou para baixo — sem isso, a matriz
// mostra onde doeu e não diz por quê, que é meio caminho.
// ============================================================================

/** Uma célula: o número e o que está dentro dele. */
export type CelulaDaMatriz = {
  celula: Celula;
  linhas: LinhaLiquidada[];
};

/** Uma linha da matriz: um grupo da quebra, ao longo do tempo. */
export type LinhaDaMatriz = {
  chave: string;
  rotulo: string;
  /** Indexado pela chave da gaveta. Gaveta sem aposta não tem entrada. */
  porGaveta: Record<string, CelulaDaMatriz>;
  total: CelulaDaMatriz;
};

export type Matriz = {
  /** As colunas, em ordem cronológica. */
  gavetas: { chave: string; rotulo: string }[];
  linhas: LinhaDaMatriz[];
};

/**
 * A matriz de uma quebra.
 *
 * As colunas saem das linhas liquidadas, e não de um calendário: coluna de um
 * dia sem aposta seria uma coluna de traços, e com trinta dias na tela isso é a
 * maior parte da largura. O total fica à direita, porque é ele que dá a régua
 * para ler a linha inteira.
 *
 * A ordem das linhas é a da quebra: ordinal quando a quebra é ordinal (faixa de
 * Score de baixo para cima), tamanho da base quando não é.
 */
export function matriz(
  liquidadas: readonly LinhaLiquidada[],
  quebra: Quebra,
  granularidade: Granularidade,
  eixo: Eixo,
): Matriz {
  const gavetas = new Set<string>();
  const porLinha = new Map<string, Map<string, LinhaLiquidada[]>>();
  const todasDaLinha = new Map<string, LinhaLiquidada[]>();

  for (const l of linhasDa(quebra, liquidadas)) {
    const dia = diaDaLinha(l.linha, eixo);
    if (dia == null) continue;
    const gaveta = gavetaDe(dia, granularidade);
    const chave = quebra.chaveDe(l.linha);

    gavetas.add(gaveta);

    const daLinha = porLinha.get(chave) ?? new Map<string, LinhaLiquidada[]>();
    daLinha.set(gaveta, [...(daLinha.get(gaveta) ?? []), l]);
    porLinha.set(chave, daLinha);

    todasDaLinha.set(chave, [...(todasDaLinha.get(chave) ?? []), l]);
  }

  const colunas = [...gavetas]
    .sort((a, b) => a.localeCompare(b))
    .map((chave) => ({ chave, rotulo: rotuloDaGaveta(chave, granularidade) }));

  const chaves = quebra.ordem
    ? quebra.ordem.filter((k) => porLinha.has(k))
    : [...todasDaLinha.entries()]
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([k]) => k);

  const linhas: LinhaDaMatriz[] = chaves.map((chave) => {
    const porGaveta: Record<string, CelulaDaMatriz> = {};
    for (const [gaveta, linhasDaGaveta] of porLinha.get(chave) ?? []) {
      porGaveta[gaveta] = {
        celula: celulaDe(chave, linhasDaGaveta),
        linhas: linhasDaGaveta,
      };
    }

    const todas = todasDaLinha.get(chave) ?? [];

    return {
      chave,
      rotulo: (quebra.rotulo ?? ((k: string) => k))(chave),
      porGaveta,
      total: { celula: celulaDe(chave, todas), linhas: todas },
    };
  });

  return { gavetas: colunas, linhas };
}

/**
 * O que puxou a célula, do pior para o melhor.
 *
 * Pior primeiro, e não em ordem de jogo: quem abre uma célula vermelha está
 * procurando o que deu errado, e a primeira linha da lista tem de ser a
 * resposta. O empate resolve pela odd, que põe a aposta mais cara na frente.
 */
export function ordenadoPeloEstrago(linhas: readonly LinhaLiquidada[]): LinhaLiquidada[] {
  return [...linhas].sort((a, b) => a.lucro - b.lucro || (b.linha.best_odd ?? 0) - (a.linha.best_odd ?? 0));
}

/** Por qual coluna a lista do drill está ordenada. */
export type ColunaDoDrill = 'jogo' | 'saida' | 'odd' | 'score' | 'margem' | 'lucro';

/** O lucro efetivo: o de uma unidade vezes o tamanho apostado. */
/** O lucro que a célula soma: o de uma unidade vezes o tamanho da aposta. */
export const lucroEfetivo = (l: LinhaLiquidada) => l.lucro * l.unidades;

const valorDa = (l: LinhaLiquidada, coluna: ColunaDoDrill): number | string => {
  switch (coluna) {
    case 'jogo':
      return `${l.linha.home_team_name ?? ''} ${l.linha.away_team_name ?? ''}`;
    case 'saida':
      return `${l.linha.market} ${l.linha.outcome} ${l.linha.line_value ?? 0}`;
    case 'odd':
      return l.linha.best_odd ?? 0;
    case 'score':
      return l.linha.score;
    case 'margem':
      // Sem linha não existe margem. Vai para o fim nos dois sentidos, porque
      // ela não é 'menor' nem 'maior' — ela não existe.
      return (
        margemDaSaida(
          { market: l.linha.market, outcome: l.linha.outcome, line_value: l.linha.line_value },
          l.linha.goals_home,
          l.linha.goals_away,
        ) ?? Number.NEGATIVE_INFINITY
      );
    default:
      return lucroEfetivo(l);
  }
};

/**
 * A lista do drill, ordenada pela coluna pedida.
 *
 * O desempate é sempre o lucro, e por um motivo prático: ordenando por Score,
 * as apostas de mesma nota aparecem com a pior primeiro, que é a que interessa
 * quando se está investigando uma faixa.
 */
export function ordenarPor(
  linhas: readonly LinhaLiquidada[],
  coluna: ColunaDoDrill,
  desc: boolean,
): LinhaLiquidada[] {
  const sinal = desc ? -1 : 1;
  return [...linhas].sort((a, b) => {
    const va = valorDa(a, coluna);
    const vb = valorDa(b, coluna);
    const cmp =
      typeof va === 'string' || typeof vb === 'string'
        ? String(va).localeCompare(String(vb))
        : va - vb;
    return cmp !== 0 ? cmp * sinal : lucroEfetivo(a) - lucroEfetivo(b);
  });
}
