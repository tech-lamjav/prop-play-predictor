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
  params?: Record<string, ValorDeCopy>;
};

/**
 * O que cabe num buraco do molde.
 *
 * Número e string são o caso simples: a linha, a contagem, o nome do time. Os
 * outros dois existem porque esta copy é composta em CAMADAS, e não em um nível:
 *
 *   outro pedido   "o corte é pelo menos 3 jogos" é a frase do corte dentro da
 *                  frase da prestação, e "3 jogos" é uma terceira dentro dela.
 *                  Montar a de dentro na função exigiria que ela soubesse o
 *                  idioma, que é exatamente o que o #544 tirou dela.
 *   lista          "Fortaleza marca 0,8 · Goiás sofre 0,6" é uma frase por
 *                  time, e quantas são depende do dado — não do texto.
 *
 * ⚠️ NÃO é um segundo mecanismo de tradução: é o mesmo par chave+params, agora
 * aceitando-se a si mesmo. Quem resolve a recursão é `resolverCopy`, em um lugar
 * só, e o catálogo continua plano — cada camada é uma chave com o seu molde.
 */
export type ValorDeCopy = string | number | CopyComParametros | ItemDeLista[];

/** Um item de lista. Separado do `ValorDeCopy` para a lista não aninhar lista. */
type ItemDeLista = string | number | CopyComParametros;

/** Pedido de frase, ou valor cru? */
function ehPedido(v: ValorDeCopy): v is CopyComParametros {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && 'chave' in v;
}

/**
 * O separador de lista do produto.
 *
 * Vive aqui, e não no catálogo, porque não é texto: é a mesma pontuação em
 * português e em espanhol, e o produto já a usa literal em toda a bancada. Para
 * juntar com CONJUNÇÃO ("Flamengo e Palmeiras") existe `lista.juntorE` no
 * catálogo da tela, que é texto e muda de idioma.
 */
export const SEPARADOR_DE_LISTA = ' · ';

/**
 * Preenche um molde `{{assim}}` — o MESMO formato do i18next.
 *
 * ⚠️ Não é uma segunda implementação de tradução: é o que permite as funções em
 * português serem escritas EM CIMA do mesmo molde que vai para o catálogo. Sem
 * isto o texto em português existiria em dois lugares — a função e o catálogo —
 * e eles divergiriam em silêncio, que é o mesmo defeito que a guarda de
 * paridade da copy existe para impedir entre o TypeScript e o SQL.
 */
export function preencher(molde: string, params?: Record<string, ValorDeCopy>): string {
  if (!params) return molde;
  return molde.replace(/\{\{(\w+)\}\}/g, (inteiro, nome: string) => {
    const valor = params[nome];
    // Só valor CRU entra. Um pedido aninhado deixaria o molde à vista em vez de
    // imprimir "[object Object]": quem chama esta função são as duas que ainda
    // devolvem português por contrato com o banco (`outcomeLabel`, `pickLabel`),
    // e as duas montam só valores crus. Molde à vista é defeito que se lê; o
    // objeto convertido em texto é defeito que passa.
    return typeof valor === 'string' || typeof valor === 'number' ? String(valor) : inteiro;
  });
}

/**
 * Monta um pedido de frase, resolvendo as camadas de dentro para fora.
 *
 * Recebe o tradutor em vez de importá-lo, e é isso que a torna provável: o hook
 * passa o `t` do i18next e a guarda passa um tradutor que lê o catálogo em
 * português do disco. As duas montagens são a MESMA função, então a frase que o
 * teste confere é a frase que a tela mostra — e não uma reimplementação dela.
 */
export function resolverCopy(
  traduzir: (chave: string, params?: Record<string, string | number>) => string,
  pedido: CopyComParametros,
): string {
  const { chave, params } = pedido;
  if (!params) return traduzir(chave);
  const resolvidos: Record<string, string | number> = {};
  for (const [nome, valor] of Object.entries(params)) {
    resolvidos[nome] = Array.isArray(valor)
      ? valor
          .map((item) => (ehPedido(item) ? resolverCopy(traduzir, item) : item))
          .join(SEPARADOR_DE_LISTA)
      : ehPedido(valor)
        ? resolverCopy(traduzir, valor)
        : valor;
  }
  return traduzir(chave, resolvidos);
}
