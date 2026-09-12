import type { LinhaPublicada } from './placar-agregacao';

// ============================================================================
// placar-premissas.ts — os cortes do dado que acompanha a linha
// ============================================================================
// ROI por premissa NÃO mora aqui: ele tem módulo próprio, `placar-por-premissa`,
// e é medido de verdade, premissa por premissa, dentro do lado do mercado.
//
// Aqui ficam os três cortes que falam do dado que acompanha a linha e não de uma
// premissa específica: quantas premissas ficaram sem dado, quais sinais de preço
// corroboraram, e qual penalidade foi aplicada. Os dois últimos em grupos que
// não se sobrepõem, porque linha solta por sinal contaria a mesma aposta duas
// vezes e a soma dos denominadores passaria do total.
//
// ⚠️ Este arquivo já afirmou, no topo, que ROI por premissa era impossível. Era
// engano meu: as tabelas de premissa do mart existem neste banco e casam com o
// board publicado em 100% das linhas liquidadas. O que ainda falta é o INSUMO —
// por quanto a premissa acendeu.
// ============================================================================
export const FAIXAS_SEM_DADO = ['Nenhuma', 'Uma', 'Duas', 'Três ou mais'] as const;

export function faixaSemDado(quantas: number): string {
  if (quantas <= 0) return FAIXAS_SEM_DADO[0];
  if (quantas === 1) return FAIXAS_SEM_DADO[1];
  if (quantas === 2) return FAIXAS_SEM_DADO[2];
  return FAIXAS_SEM_DADO[3];
}

/**
 * A combinação dos dois sinais de preço, em grupos que não se sobrepõem.
 *
 * Uma tabela com "modelo concorda" e "sharp confirma" como linhas soltas conta a
 * mesma aposta duas vezes e a soma dos denominadores passa do total. Em
 * combinação, cada aposta cai em um grupo só.
 */
export const GRUPOS_DE_CORROBORACAO = [
  'Modelo e sharp',
  'Só o modelo',
  'Só o sharp',
  'Nenhum dos dois',
] as const;

export function grupoDeCorroboracao(linha: LinhaPublicada): string {
  const modelo = linha.modelo_api_concorda === true;
  const sharp = linha.linha_sharp_confirma === true;
  if (modelo && sharp) return GRUPOS_DE_CORROBORACAO[0];
  if (modelo) return GRUPOS_DE_CORROBORACAO[1];
  if (sharp) return GRUPOS_DE_CORROBORACAO[2];
  return GRUPOS_DE_CORROBORACAO[3];
}

/**
 * A penalidade aplicada, também em grupos exclusivos.
 *
 * A copy de cada flag é a do catálogo de premissas, resumida para caber em
 * coluna: o nome aqui tem de ser reconhecível por quem leu a tela do jogo.
 */
export const GRUPOS_DE_PENALIDADE = [
  'Sem penalidade',
  'Só uma casa paga',
  'Odd de zebra',
  'Poucas casas',
  'Odd baixa',
  'Mais de uma',
] as const;

export function grupoDePenalidade(linha: LinhaPublicada): string {
  const flags = [
    linha.pen_odd_outlier === true,
    linha.pen_odd_longshot === true,
    linha.pen_poucas_casas === true,
    linha.pen_odd_juice === true,
  ];
  const quantas = flags.filter(Boolean).length;

  if (quantas === 0) return GRUPOS_DE_PENALIDADE[0];
  if (quantas > 1) return GRUPOS_DE_PENALIDADE[5];
  // Na ordem de severidade do catálogo, que é a ordem das flags acima.
  if (flags[0]) return GRUPOS_DE_PENALIDADE[1];
  if (flags[1]) return GRUPOS_DE_PENALIDADE[2];
  if (flags[2]) return GRUPOS_DE_PENALIDADE[3];
  return GRUPOS_DE_PENALIDADE[4];
}
