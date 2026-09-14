import {
  MERCADOS,
  ladoDaSaidaNoMercado,
  premissasDaSaida,
  type LadoPremissa,
} from '@/utils/futebol-premissas';
import { celulaDe, type Celula, type LinhaLiquidada } from './placar-agregacao';
import { erroDaDiferenca, MINIMO_PARA_AFIRMAR } from './placar-comparacao';
import { rotuloDoMercado } from './placar-vocabulario';

// ============================================================================
// placar-por-premissa.ts — o ROI de uma premissa, medido do jeito honesto
// ============================================================================
// A pergunta é "quando a premissa X acendeu, qual foi o ROI", e a resposta só
// significa alguma coisa DENTRO DO LADO do mercado.
//
// Medido em 12/09/2026, em Gols: "defesas vazáveis acesa rende 33,5% contra
// −13,4% apagada" — e quase toda essa diferença era outra coisa. O lado Over
// rendia +15,7% em 259 apostas e o Under −24,1% em 263; a premissa é do lado
// Over, então comparar acesa contra apagada comparava Over contra Under.
//
// Dentro do Over a premissa informa de verdade: +33,5% em 101 contra +4,3% nas
// 158 em que ficou apagada. Dentro do Under, defesas firmes acesa dá −24,3%
// contra −24,0% apagada, ou seja, nada — o lado inteiro é que é ruim.
//
// Por isso a unidade desta tela é o LADO, e não o mercado: o ROI do lado no
// cabeçalho, as premissas daquele lado embaixo, e a diferença entre acesa e
// apagada medida só ali dentro.
// ============================================================================

export const ROTULO_DO_LADO: Record<LadoPremissa, string> = {
  over: 'Mais gols',
  under: 'Menos gols',
  sim: 'Ambos marcam: sim',
  nao: 'Ambos marcam: não',
  favorito: 'Favorito',
  azarao: 'Azarão',
};

/** Uma premissa do lado, com o que ela rendeu acesa e apagada. */
export type LinhaDePremissa = {
  slug: string;
  label: string;
  /** O peso dela na nota, do catálogo do produto. `null` = mercado sem calibragem. */
  peso: number | null;
  acesa: Celula;
  apagada: Celula;
  /** ROI acesa menos ROI apagada. `null` quando um dos dois lados não tem aposta. */
  diferenca: number | null;
  erro: number | null;
  /**
   * A diferença não passa do próprio erro, ou um dos lados tem base curta.
   *
   * Mesma régua da comparação de períodos: sem ela, a premissa que acendeu duas
   * vezes e deu green nas duas vira a melhor da tabela.
   */
  dentroDoRuido: boolean;
};

/** Um lado de um mercado: o ROI dele e as premissas que ele pode acender. */
export type LadoMedido = {
  chave: string;
  market: string;
  lado: LadoPremissa | null;
  rotulo: string;
  total: Celula;
  premissas: LinhaDePremissa[];
};

const chaveDoLado = (market: string, lado: LadoPremissa | null) => `${market}:${lado ?? 'unico'}`;

/**
 * O rótulo do lado.
 *
 * Mercado de um lado só — Resultado e Dupla chance — não ganha sufixo: ali a
 * premissa se refere à saída da própria linha, e um "lado único" no título só
 * ocuparia espaço.
 */
function rotuloDoLado(market: string, lado: LadoPremissa | null): string {
  const mercado = rotuloDoMercado(market);
  if (lado == null) return mercado;
  if (lado === 'sim' || lado === 'nao') return ROTULO_DO_LADO[lado];
  return `${mercado} · ${ROTULO_DO_LADO[lado]}`;
}

/**
 * As premissas de cada lado, medidas.
 *
 * A lista de premissas de um lado é FIXA e vem do catálogo do produto, não do
 * dado: premissa que nunca acendeu no período tem de aparecer com zero, porque
 * "nunca acendeu" é informação sobre o catálogo — é candidata a sair dele.
 */
export function porLadoDoMercado(liquidadas: readonly LinhaLiquidada[]): LadoMedido[] {
  const grupos = new Map<string, LinhaLiquidada[]>();

  for (const l of liquidadas) {
    const lado = ladoDaSaidaNoMercado({
      market: l.linha.market,
      outcome: l.linha.outcome,
      line_value: l.linha.line_value,
    });
    const chave = chaveDoLado(l.linha.market, lado);
    const atual = grupos.get(chave);
    if (atual) atual.push(l);
    else grupos.set(chave, [l]);
  }

  const medidos: LadoMedido[] = [];

  for (const [chave, doLado] of grupos) {
    const primeira = doLado[0].linha;
    const lado = ladoDaSaidaNoMercado({
      market: primeira.market,
      outcome: primeira.outcome,
      line_value: primeira.line_value,
    });
    const mercado = MERCADOS.find((m) => m.slug === primeira.market);
    const rotulo = rotuloDoLado(primeira.market, lado);
    const total = celulaDe(rotulo, doLado);

    const catalogo = mercado
      ? premissasDaSaida(mercado, {
          market: primeira.market,
          outcome: primeira.outcome,
          line_value: primeira.line_value,
        })
      : [];

    const premissas = catalogo.map((p) => {
      const acendeu = doLado.filter((l) => (l.linha.premissas_acesas ?? []).includes(p.slug));
      const nao = doLado.filter((l) => !(l.linha.premissas_acesas ?? []).includes(p.slug));

      const acesa = celulaDe(p.label, acendeu);
      const apagada = celulaDe(p.label, nao);

      const temOsDois = acesa.n > 0 && apagada.n > 0;
      const diferenca = temOsDois ? acesa.roi - apagada.roi : null;
      const erro = temOsDois ? erroDaDiferenca(acesa, apagada) : null;
      const baseCurta = acesa.n < MINIMO_PARA_AFIRMAR || apagada.n < MINIMO_PARA_AFIRMAR;

      return {
        slug: p.slug,
        label: p.label,
        peso: p.peso,
        acesa,
        apagada,
        diferenca,
        erro,
        dentroDoRuido:
          diferenca == null || erro == null || baseCurta || Math.abs(diferenca) <= erro,
      };
    });

    // A premissa que mais separa vem primeiro, e a que nunca acendeu vai para o
    // fim: a tabela é lida de cima, e o que decide catálogo é o topo dela.
    premissas.sort((a, b) => {
      if (a.acesa.n === 0 && b.acesa.n > 0) return 1;
      if (b.acesa.n === 0 && a.acesa.n > 0) return -1;
      return (b.diferenca ?? 0) - (a.diferenca ?? 0);
    });

    medidos.push({ chave, market: primeira.market, lado, rotulo, total, premissas });
  }

  // Os lados vêm do maior para o menor, como as outras quebras: quem decide o
  // que olhar primeiro é o tamanho da base.
  return medidos.sort((a, b) => b.total.n - a.total.n || a.rotulo.localeCompare(b.rotulo));
}
