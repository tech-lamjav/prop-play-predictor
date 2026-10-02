import type { Area, Idioma } from './idiomas';

// ============================================================================
// carregar.ts — o dono do carregamento do texto
// ============================================================================
// Nenhuma tela monta caminho de catálogo por conta própria. Tudo passa por
// aqui, e o motivo é uma armadilha do empacotador que um protótipo descartável
// mediu antes deste código existir.
//
// ⚠️ AS DUAS FORMAS, E POR QUE SÓ UMA SERVE
//
// A forma que parece natural é montar o caminho na hora:
//
//     import(`./locales/${idioma}/${area}.json`)      // funciona
//     import(`./locales/${caminho}.json`)             // FALHA CALADA
//
// A primeira funciona. A segunda, com `caminho = 'es/futebol'`, gera ZERO
// pedaço: o build passa limpo, sem erro e sem aviso, e a tela quebra só no
// navegador do usuário. A restrição é que uma variável não pode atravessar
// uma barra.
//
// Mas nem a primeira serve aqui, e a razão é de TESTE, não de build: no
// ambiente de teste, caminho montado na hora resolve de qualquer jeito. Um
// teste escrito assim passaria verde enquanto a produção quebra — uma guarda
// que não guarda.
//
// Por isso o mapa abaixo. Ele é montado pelo empacotador em tempo de build,
// é LITERAL, e existe igual no build e no teste. Quando o padrão para de
// casar, ele fica vazio nos DOIS, e a guarda de paridade reprova antes de
// chegar em gente. É essa propriedade — ser inspecionável — que decide o
// desenho, e não elegância.
// ============================================================================

/**
 * O mapa que o empacotador monta: chave é o caminho, valor é a função que
 * baixa o pedaço. Preguiçoso de propósito — nada é baixado até alguém pedir.
 */
const CATALOGOS = import.meta.glob('./locales/*/*.json') as Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
>;

/** O endereço de um catálogo no mapa. Um lugar só monta isto. */
export function chaveDoCatalogo(idioma: Idioma, area: Area): string {
  return `./locales/${idioma}/${area}.json`;
}

/**
 * Os catálogos que o empacotador realmente enxergou.
 *
 * Existe para a guarda de paridade poder comparar contra a matriz. Lista vazia
 * aqui significa que o padrão do glob parou de casar, e que nenhum texto
 * chegaria ao navegador.
 */
export function catalogosDisponiveis(): string[] {
  return Object.keys(CATALOGOS);
}

/** Baixa o texto de uma área num idioma. */
export async function carregarArea(
  idioma: Idioma,
  area: Area,
): Promise<Record<string, unknown>> {
  const chave = chaveDoCatalogo(idioma, area);
  const baixar = CATALOGOS[chave];
  // Alto e claro, e não um objeto vazio: catálogo que falta é defeito de
  // programação, e silenciar aqui devolveria a falha calada pela porta dos
  // fundos, que é exatamente o que este arquivo existe para impedir.
  if (!baixar) {
    throw new Error(
      `Catálogo inexistente: ${chave}. Disponíveis: ${catalogosDisponiveis().join(', ') || '(nenhum)'}`,
    );
  }
  return (await baixar()).default;
}
