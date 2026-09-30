// ============================================================================
// futebol-copy.ts — o vocabulário comum de quem devolve CHAVE em vez de frase
// ============================================================================
// Os catálogos de copy do futebol vivem fora das telas, em `src/utils`, e sete
// arquivos os consomem. Até o #544 eles devolviam frase pronta em português, e
// era por isso que a tela em espanhol mostrava o miolo em português.
//
// A saída é a tela pedir a frase por IDENTIFICADOR. Este módulo é a folha que
// define o formato desse pedido e o interpolador que as funções em português
// usam para continuar devolvendo exatamente o que devolviam.
//
// ⚠️ O que este desenho NÃO faz, e é o ponto inteiro: trocar o texto das
// premissas por chave DENTRO das funções de copy. Aquelas frases são contrato
// com o banco — a migration semeia `futebol_premissa_copy` a partir delas e as
// três RPCs servem a DM do Telegram de lá. `rotuloPremissa` e companhia
// continuam devolvendo português, e a guarda de paridade da copy
// (`futebol-copy-paridade.test.ts`) continua valendo sem uma linha de mudança.
// ============================================================================

/**
 * A área do catálogo de idioma onde esta copy mora.
 *
 * Fica aqui, e não escrita à mão em cada tela, porque o nome da área é detalhe
 * de um lugar só: quem chama pede a chave e não precisa saber em que arquivo
 * ela caiu.
 */
export const AREA_DA_COPY = 'premissas' as const;

/**
 * Um pedido de frase: a chave estável e os valores que entram nos buracos.
 *
 * Existe porque metade desta copy é composta — o nome do time, a linha, a
 * contagem. Devolver a frase montada obrigaria a função a conhecer o idioma;
 * devolver só a chave perderia os valores. O par resolve os dois.
 */
export type CopyComParametros = {
  chave: string;
  params?: Record<string, string | number>;
};

/**
 * Preenche um molde `{{assim}}` — o MESMO formato do i18next.
 *
 * ⚠️ Não é uma segunda implementação de tradução: é o que permite as funções em
 * português serem escritas EM CIMA do mesmo molde que vai para o catálogo. Sem
 * isto o texto em português existiria em dois lugares — a função e o catálogo —
 * e eles divergiriam em silêncio, que é o mesmo defeito que a guarda de
 * paridade da copy existe para impedir entre o TypeScript e o SQL.
 */
export function preencher(molde: string, params?: Record<string, string | number>): string {
  if (!params) return molde;
  return molde.replace(/\{\{(\w+)\}\}/g, (inteiro, nome: string) =>
    nome in params ? String(params[nome]) : inteiro,
  );
}
