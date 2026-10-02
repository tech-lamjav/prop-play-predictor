/**
 * Este IP é do Brasil?
 *
 * Spec em #548, ticket #549.
 *
 * A pergunta é binária de propósito. Não é "de que país é este IP" — é "é do
 * Brasil". A diferença importa porque a segunda tem resposta LOCAL: as faixas
 * delegadas ao Brasil são um arquivo, e a resposta vira aritmética. A primeira
 * exigiria consultar alguém, e consultar alguém coloca uma ida à rede no
 * caminho de toda pessoa que chega.
 *
 * O país completo continua existindo — ele é resolvido depois, em lote, para o
 * relatório (#553). Aqui, em tempo real, só interessa passar ou não passar.
 *
 * ⚠️ Três respostas, e não duas. "Não sei" é diferente de "não é do Brasil":
 * a primeira é a nossa ignorância, a segunda é uma afirmação sobre o IP.
 * Achatar as duas num booleano faria um endereço quebrado virar "estrangeiro",
 * que é a conclusão mais perigosa possível para quem está montando prova de
 * que os usuários estão fora do país.
 */
import { lerBlocoV6, lerEndereco, lerFaixaV4, procurar, type Faixa } from './endereco-ip.ts';
import { FAIXAS_V4, FAIXAS_V6 } from './faixas-do-brasil.dados.ts';

export type RespostaDeOrigem = 'sim' | 'nao' | 'nao_sei';

/**
 * As faixas só são lidas na primeira pergunta, e uma vez só.
 *
 * São mais de onze mil conversões somando as duas famílias. Pagar isso no
 * arranque da função custaria em toda partida a frio, inclusive nas requisições
 * que nem chegam a perguntar nada.
 */
let v4Carregadas: Faixa[] | null = null;
let v6Carregadas: Faixa[] | null = null;

function carregar(textos: readonly string[], ler: (t: string) => Faixa | null): Faixa[] {
  const faixas: Faixa[] = [];
  for (const texto of textos) {
    const faixa = ler(texto);
    if (faixa) faixas.push(faixa);
  }
  faixas.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return faixas;
}

/**
 * Responde se o endereço pertence a uma faixa delegada ao Brasil.
 *
 * Endereço vazio, malformado ou de família que não existe devolve `nao_sei`.
 * Quem chama decide o que fazer com isso — e a decisão desta casa é deixar
 * entrar, porque com a lista local não há serviço para cair, e o que sobra é
 * defeito nosso. Trancar todo mundo por causa de um defeito é pior do que
 * deixar passar alguém que será verificado na sessão seguinte.
 */
export function ehDoBrasil(endereco: string | null | undefined): RespostaDeOrigem {
  const lido = lerEndereco(endereco);
  if (lido === null) return 'nao_sei';

  if (lido.familia === 'v4') {
    v4Carregadas ??= carregar(FAIXAS_V4, lerFaixaV4);
    return procurar(v4Carregadas, lido.valor) === -1 ? 'nao' : 'sim';
  }

  v6Carregadas ??= carregar(FAIXAS_V6, lerBlocoV6);
  return procurar(v6Carregadas, lido.valor) === -1 ? 'nao' : 'sim';
}
