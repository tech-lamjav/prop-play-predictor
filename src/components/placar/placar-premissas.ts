import type { LinhaPublicada } from './placar-agregacao';

// ============================================================================
// placar-premissas.ts — o que o Postgres sabe de premissa, e o que não sabe
// ============================================================================
// NÃO EXISTE ROI POR PREMISSA aqui, e não é escolha: quais premissas acenderam
// em cada linha não está no histórico. A RPC que devolve os slugs acesos lê
// tabelas do mart recriadas por inteiro todo dia, sem histórico, e atende um
// jogo por chamada. Pior: os arrays de evidência que a RPC histórica devolve são
// montados com as flags DE HOJE contra a linha do passado — a evidência que
// aparece no histórico é a de agora, não a da publicação.
//
// O que existe com fidelidade histórica, por linha publicada, é isto:
//
//   · `pts_premissas`: a SOMA dos pesos que acenderam, sem dizer quais;
//   · `premissas_sem_dado`: quantas não puderam ser avaliadas;
//   · `modelo_api_concorda` e `linha_sharp_confirma`: os dois sinais de preço;
//   · `penalidades` e as quatro flags `pen_*`.
//
// São aproximações, e cada quebra aqui diz qual pergunta ela responde de fato.
// A pergunta que o sócio fez — "quando a premissa X acendeu, qual foi o ROI" —
// exige guardar as premissas acesas no momento da publicação, e isso é trabalho
// no mart.
// ============================================================================

/**
 * As faixas de pontos de premissa.
 *
 * ⚠️ O teto de pontos é DIFERENTE por mercado (30 no Resultado, 40 em Gols),
 * então a mesma faixa não significa a mesma coisa nos dois. A tabela serve para
 * ver se mais evidência rende mais DENTRO de um mercado, e a tela diz isso.
 */
export const FAIXAS_DE_PONTOS = ['0 a 9', '10 a 19', '20 a 29', '30 ou mais'] as const;

export function faixaDePontos(pts: number): string {
  if (pts < 10) return FAIXAS_DE_PONTOS[0];
  if (pts < 20) return FAIXAS_DE_PONTOS[1];
  if (pts < 30) return FAIXAS_DE_PONTOS[2];
  return FAIXAS_DE_PONTOS[3];
}

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
