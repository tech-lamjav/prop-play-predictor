import { addDays } from '@/utils/futebol-datas';
import { celulaDe, type Celula, type LinhaLiquidada } from './placar-agregacao';
import { diaDaLinha, type Eixo, type Periodo } from './placar-periodo';

// ============================================================================
// placar-evolucao.ts — o ROI ao longo do tempo, do macro para o micro
// ============================================================================
// A tabela responde "como foi o período". Esta série responde "está melhorando
// ou piorando", que é outra pergunta e a que decide se uma mudança funcionou.
//
// A granularidade começa na SEMANA e não no mês, e isso é consequência do dado:
// a série comparável começou em 04/09/2026, então hoje o mês inteiro daria uma
// barra só. O mês aparece como opção quando o período cruza dois meses, e aí o
// clique nele abre a semana; o clique na semana abre o dia. Do macro para o
// micro, um degrau por clique.
// ============================================================================

export type Granularidade = 'mes' | 'semana' | 'dia';

export const ROTULO_DA_GRANULARIDADE: Record<Granularidade, string> = {
  mes: 'Mês',
  semana: 'Semana',
  dia: 'Dia',
};

/** A segunda-feira da semana de um dia BRT. */
export function inicioDaSemana(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  // getUTCDay: 0 é domingo. A semana do produto começa na segunda, como a
  // rodada: sábado e domingo de uma rodada pertencem à mesma semana dela.
  const offset = (d.getUTCDay() + 6) % 7;
  return addDays(dia, -offset);
}

export const mesDoDia = (dia: string) => dia.slice(0, 7);

/** A gaveta em que a linha cai, na granularidade pedida. */
export function gavetaDe(dia: string, granularidade: Granularidade): string {
  if (granularidade === 'dia') return dia;
  if (granularidade === 'semana') return inicioDaSemana(dia);
  return mesDoDia(dia);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** O rótulo curto do eixo: ele precisa caber embaixo da barra. */
export function rotuloDaGaveta(chave: string, granularidade: Granularidade): string {
  if (granularidade === 'mes') {
    const [ano, mes] = chave.split('-');
    return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
  }
  const [, mes, dia] = chave.split('-');
  return granularidade === 'semana' ? `${dia}/${mes}` : `${dia}/${mes}`;
}

/**
 * As granularidades que o período sustenta.
 *
 * Mês só entra quando o período cruza dois meses: uma barra só não é série, é um
 * número grande em cima de um eixo.
 */
export function granularidadesDe(periodo: Periodo): Granularidade[] {
  const meses = new Set([mesDoDia(periodo.de), mesDoDia(periodo.ate)]);
  const dias =
    (Date.parse(`${periodo.ate}T12:00:00Z`) - Date.parse(`${periodo.de}T12:00:00Z`)) / 86_400_000;
  const lista: Granularidade[] = [];
  if (meses.size > 1) lista.push('mes');
  if (dias >= 7) lista.push('semana');
  lista.push('dia');
  return lista;
}

/** O degrau de baixo, quando existe. */
export function granularidadeAbaixo(g: Granularidade): Granularidade | null {
  if (g === 'mes') return 'semana';
  if (g === 'semana') return 'dia';
  return null;
}

/** A janela que uma gaveta cobre, para o clique abrir só o que está nela. */
export function janelaDaGaveta(chave: string, granularidade: Granularidade): Periodo {
  if (granularidade === 'dia') return { de: chave, ate: chave };
  if (granularidade === 'semana') return { de: chave, ate: addDays(chave, 6) };
  const [ano, mes] = chave.split('-').map(Number);
  const primeiro = `${chave}-01`;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { de: primeiro, ate: `${chave}-${String(ultimo).padStart(2, '0')}` };
}

/** Uma barra da série. */
export type Ponto = {
  chave: string;
  rotulo: string;
  /** O total da gaveta, com todos os mercados escolhidos somados. */
  total: Celula;
  /** O ROI de cada mercado dentro da gaveta, para a barra empilhada. */
  porMercado: Record<string, Celula>;
};

/**
 * A série, em ordem cronológica.
 *
 * Gaveta sem aposta liquidada NÃO vira barra: um buraco no meio da série é
 * informação (não houve jogo, ou não houve publicação), e uma barra de zero
 * ali leria como ROI zero, que é outra coisa.
 */
export function serie(
  liquidadas: readonly LinhaLiquidada[],
  granularidade: Granularidade,
  eixo: Eixo,
  mercados?: readonly string[],
): Ponto[] {
  const gavetas = new Map<string, LinhaLiquidada[]>();

  for (const l of liquidadas) {
    if (mercados && mercados.length > 0 && !mercados.includes(l.linha.market)) continue;
    const dia = diaDaLinha(l.linha, eixo);
    if (dia == null) continue;
    const chave = gavetaDe(dia, granularidade);
    const atual = gavetas.get(chave);
    if (atual) atual.push(l);
    else gavetas.set(chave, [l]);
  }

  return [...gavetas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, linhas]) => {
      const porMercado: Record<string, Celula> = {};
      for (const l of linhas) {
        const doMercado = linhas.filter((x) => x.linha.market === l.linha.market);
        porMercado[l.linha.market] = celulaDe(l.linha.market, doMercado);
      }
      return {
        chave,
        rotulo: rotuloDaGaveta(chave, granularidade),
        total: celulaDe(chave, linhas),
        porMercado,
      };
    });
}

/** Os mercados presentes nas liquidadas, da base maior para a menor. */
export function mercadosPresentes(liquidadas: readonly LinhaLiquidada[]): string[] {
  const contagem = new Map<string, number>();
  for (const l of liquidadas) {
    contagem.set(l.linha.market, (contagem.get(l.linha.market) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}
