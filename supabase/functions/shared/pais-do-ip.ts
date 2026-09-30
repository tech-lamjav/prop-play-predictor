/**
 * De que país é este endereço?
 *
 * Spec em #548, ticket #553.
 *
 * Esta é a pergunta cara, e é por isso que ela NÃO acontece no caminho de quem
 * está navegando. Ela roda depois, em lote, para transformar o diário de
 * presença em relatório: "no dia tal, tantas pessoas ativas, e de quais
 * países". Sem ela o registro prova que alguém não estava no Brasil, mas não
 * diz onde estava — e "não é brasileiro" é uma afirmação mais fraca que
 * "estava no Peru".
 *
 * ⚠️ O QUE ESTA FONTE NÃO COBRE. O arquivo vem do LACNIC, que delega para a
 * América Latina e o Caribe. Os quatro países da operação — Peru, Argentina,
 * Colômbia e México — estão todos lá, e o Brasil também. Um endereço da Europa,
 * dos Estados Unidos ou da Ásia volta como `null`: ainda prova que a pessoa não
 * estava no Brasil, mas não diz onde ela estava.
 *
 * Isso é escolha de escopo, e não limitação técnica: cobrir o resto do mundo
 * exigiria baixar as publicações dos outros quatro registros regionais, o que
 * multiplicaria o arquivo por cerca de dez para atender um mercado que ninguém
 * declarou. O dia em que declararem, o caminho é acrescentar as fontes no mesmo
 * script — nada aqui muda.
 */
import { lerBlocoV6, lerEndereco, lerFaixaV4, procurar, type Faixa } from './endereco-ip.ts';
import { FAIXAS_PAIS_V4, FAIXAS_PAIS_V6 } from './faixas-por-pais.dados.ts';

interface FaixasComPais {
  readonly faixas: Faixa[];
  /** O código do país de cada faixa, no mesmo índice. */
  readonly paises: string[];
}

let v4Carregadas: FaixasComPais | null = null;
let v6Carregadas: FaixasComPais | null = null;

/**
 * Lê as linhas `faixa|PA` em duas listas paralelas.
 *
 * Paralelas em vez de uma lista de objetos porque a busca binária só toca nas
 * faixas: separar deixa o caminho quente da busca lendo um array só, e o código
 * do país é consultado uma vez, no fim, pelo índice encontrado.
 */
function carregar(textos: readonly string[], ler: (t: string) => Faixa | null): FaixasComPais {
  const pares: { faixa: Faixa; pais: string }[] = [];

  for (const texto of textos) {
    const barra = texto.lastIndexOf('|');
    if (barra === -1) continue;
    const faixa = ler(texto.slice(0, barra));
    const pais = texto.slice(barra + 1);
    if (faixa && /^[A-Z]{2}$/.test(pais)) pares.push({ faixa, pais });
  }

  pares.sort((a, b) => (a.faixa[0] < b.faixa[0] ? -1 : a.faixa[0] > b.faixa[0] ? 1 : 0));

  return {
    faixas: pares.map((p) => p.faixa),
    paises: pares.map((p) => p.pais),
  };
}

/**
 * O código de duas letras do país, ou null.
 *
 * `null` quer dizer "não achei", e cobre duas situações que o chamador trata
 * igual: endereço que não deu para ler, e endereço fora da região do LACNIC. As
 * duas terminam do mesmo jeito no registro — a linha fica marcada como
 * processada e sem país —, e é por isso que não vale separá-las aqui.
 */
export function paisDoIp(endereco: string | null | undefined): string | null {
  const lido = lerEndereco(endereco);
  if (lido === null) return null;

  const tabela = lido.familia === 'v4'
    ? (v4Carregadas ??= carregar(FAIXAS_PAIS_V4, lerFaixaV4))
    : (v6Carregadas ??= carregar(FAIXAS_PAIS_V6, lerBlocoV6));

  const onde = procurar(tabela.faixas, lido.valor);
  return onde === -1 ? null : tabela.paises[onde];
}
