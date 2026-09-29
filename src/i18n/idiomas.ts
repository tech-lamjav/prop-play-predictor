// ============================================================================
// idiomas.ts — a matriz do que o produto fala
// ============================================================================
// Este arquivo é a ÚNICA fonte de verdade sobre quais idiomas existem e em que
// pedaços o texto está dividido. Idioma novo é uma linha em `IDIOMAS` mais os
// arquivos de texto correspondentes; nada de tela muda.
//
// ⚠️ A guarda de paridade (`catalogo-paridade.test.ts`) percorre exatamente
// esta matriz. Acrescentar idioma ou área aqui SEM acrescentar os arquivos faz
// o teste reprovar, e isso é o comportamento desejado: é assim que uma
// tradução faltando para no CI em vez de parar no usuário.
// ============================================================================

/** Os idiomas que o produto fala. A ORDEM não importa; a existência sim. */
export const IDIOMAS = ['pt', 'es'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/** O idioma de quem chega sem nenhum sinal. */
export const IDIOMA_PADRAO: Idioma = 'pt';

/**
 * O idioma contra o qual a paridade é medida, e o de recuo quando uma chave
 * falta. São o mesmo hoje e podem divergir: o de referência é o que define o
 * conjunto de chaves correto, o padrão é o que a pessoa vê sem escolher.
 */
export const IDIOMA_DE_REFERENCIA: Idioma = 'pt';

/**
 * O nome de cada idioma, escrito NA PRÓPRIA LÍNGUA dele.
 *
 * Fica em código e não no catálogo de propósito: "Español" se escreve assim
 * para quem está lendo em português, em espanhol ou em qualquer outra língua.
 * Pôr isto no catálogo criaria uma chave que precisa ter o mesmo valor em
 * todos os idiomas — e uma chave assim é um convite a alguém traduzi-la e
 * quebrar a convenção sem perceber.
 */
export const NOME_DO_IDIOMA: Record<Idioma, string> = {
  pt: 'Português',
  es: 'Español',
};

/**
 * As áreas do produto, que são as unidades de carregamento.
 *
 * Esta divisão é o que torna verdadeira a promessa de desempenho: quem abre
 * uma tela carrega o que ela usa, e não o produto inteiro. Dividir por tela
 * seria fino demais (uma ida ao servidor por navegação); não dividir seria
 * baixar tudo para ver uma coisa.
 *
 * ⚠️ A matriz cresce COM os arquivos, nunca antes deles. Cada ticket de
 * migração (#537 a #541) acrescenta a sua área aqui no mesmo commit em que
 * acrescenta os catálogos dela — declarar área vazia por antecipação faria a
 * guarda reprovar e não provaria nada.
 */
export const AREAS = ['comum', 'conta', 'futebol', 'bolao', 'planos', 'nba'] as const;
export type Area = (typeof AREAS)[number];

/**
 * O locale BCP-47 de cada idioma, para formatação de número.
 *
 * O espanhol usa `es-419`, que é o espanhol da América Latina, e não `es-ES`:
 * o produto vai para Peru, Argentina, México e Chile, e o espanhol da Espanha
 * traria convenções que não são as de lá.
 *
 * ⚠️ Isto é IDIOMA, não país. Argentina e Chile escrevem decimal com vírgula e
 * Peru e México com ponto — `es-419` resolve com ponto. Acertar por país exige
 * saber o país, e a detecção por país está fora do escopo do #532. Enquanto
 * ela não existir, `es-419` é a escolha neutra honesta.
 */
export const LOCALE_DO_IDIOMA: Record<Idioma, string> = {
  pt: 'pt-BR',
  es: 'es-419',
};

/** Se um valor solto é um idioma que o produto fala. */
export function ehIdioma(valor: unknown): valor is Idioma {
  return typeof valor === 'string' && (IDIOMAS as readonly string[]).includes(valor);
}
