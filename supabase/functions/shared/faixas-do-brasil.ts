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
import { FAIXAS_V4, FAIXAS_V6 } from './faixas-do-brasil.dados.ts';

export type RespostaDeOrigem = 'sim' | 'nao' | 'nao_sei';

/** Uma faixa fechada dos dois lados. */
type Faixa = readonly [bigint, bigint];

// ---------------------------------------------------------------- leitura de endereço

/**
 * Converte um IPv4 em número, ou devolve null se não for um IPv4 válido.
 *
 * Recusa em vez de adivinhar: `1.2.3` e `1.2.3.999` não viram endereço nenhum.
 */
function lerV4(endereco: string): bigint | null {
  const partes = endereco.split('.');
  if (partes.length !== 4) return null;

  let total = 0n;
  for (const parte of partes) {
    // `Number('')` é 0 e `Number(' 1')` é 1 — os dois passariam batido sem
    // este teste de formato, e um endereço com espaço não é um endereço.
    if (!/^\d{1,3}$/.test(parte)) return null;
    const valor = Number(parte);
    if (valor > 255) return null;
    total = total * 256n + BigInt(valor);
  }
  return total;
}

/**
 * Converte um IPv6 em número, ou devolve null.
 *
 * Trata a forma que embute um IPv4 no fim (`::ffff:1.2.3.4`), que é como
 * algumas bordas entregam endereço de quem chegou por IPv4 — ignorar isso faria
 * um brasileiro em IPv4 aparecer como IPv6 desconhecido.
 */
function lerV6(endereco: string): bigint | null {
  let texto = endereco;

  // A cauda em notação IPv4 vira dois grupos hexadecimais.
  const ultimoDoisPontos = texto.lastIndexOf(':');
  const cauda = texto.slice(ultimoDoisPontos + 1);
  if (cauda.includes('.')) {
    const comoV4 = lerV4(cauda);
    if (comoV4 === null) return null;
    const alto = (comoV4 >> 16n).toString(16);
    const baixo = (comoV4 & 0xffffn).toString(16);
    texto = `${texto.slice(0, ultimoDoisPontos + 1)}${alto}:${baixo}`;
  }

  const pedacos = texto.split('::');
  if (pedacos.length > 2) return null;

  const esquerda = pedacos[0] ? pedacos[0].split(':') : [];
  const direita = pedacos.length === 2 && pedacos[1] ? pedacos[1].split(':') : [];

  let grupos: string[];
  if (pedacos.length === 2) {
    const faltando = 8 - esquerda.length - direita.length;
    if (faltando < 0) return null;
    grupos = [...esquerda, ...Array(faltando).fill('0'), ...direita];
  } else {
    grupos = esquerda;
  }
  if (grupos.length !== 8) return null;

  let total = 0n;
  for (const grupo of grupos) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(grupo)) return null;
    total = (total << 16n) | BigInt(parseInt(grupo, 16));
  }
  return total;
}

// ---------------------------------------------------------------- carga das faixas

/**
 * As faixas só são lidas na primeira pergunta, e uma vez só.
 *
 * São mais de onze mil conversões somando as duas famílias. Pagar isso no
 * arranque da função custaria em toda partida a frio, inclusive nas requisições
 * que nem chegam a perguntar nada.
 */
let v4Carregadas: Faixa[] | null = null;
let v6Carregadas: Faixa[] | null = null;

function carregarV4(): Faixa[] {
  if (v4Carregadas) return v4Carregadas;
  const faixas: Faixa[] = [];
  for (const texto of FAIXAS_V4) {
    const [inicio, fim] = texto.split('-');
    const a = lerV4(inicio);
    const b = lerV4(fim);
    if (a !== null && b !== null) faixas.push([a, b]);
  }
  v4Carregadas = faixas;
  return faixas;
}

function carregarV6(): Faixa[] {
  if (v6Carregadas) return v6Carregadas;
  const faixas: Faixa[] = [];
  for (const texto of FAIXAS_V6) {
    const [endereco, bitsTexto] = texto.split('/');
    const comeco = lerV6(endereco);
    const bits = Number(bitsTexto);
    if (comeco === null || !Number.isInteger(bits) || bits < 0 || bits > 128) continue;
    // A máscara existe para o caso de a fonte trazer um bloco com bits de host
    // preenchidos. Não deveria acontecer, e se acontecer o certo é o bloco, não
    // o endereço solto que veio escrito.
    const tamanho = 1n << BigInt(128 - bits);
    const inicio = (comeco / tamanho) * tamanho;
    faixas.push([inicio, inicio + tamanho - 1n]);
  }
  faixas.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  v6Carregadas = faixas;
  return faixas;
}

// ---------------------------------------------------------------- busca

/** Busca binária numa lista ordenada de faixas que não se sobrepõem. */
function contem(faixas: readonly Faixa[], valor: bigint): boolean {
  let baixo = 0;
  let alto = faixas.length - 1;
  while (baixo <= alto) {
    const meio = (baixo + alto) >> 1;
    const [inicio, fim] = faixas[meio];
    if (valor < inicio) alto = meio - 1;
    else if (valor > fim) baixo = meio + 1;
    else return true;
  }
  return false;
}

// ---------------------------------------------------------------- a pergunta

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
  if (typeof endereco !== 'string') return 'nao_sei';
  const limpo = endereco.trim();
  if (limpo === '') return 'nao_sei';

  if (limpo.includes(':')) {
    const valor = lerV6(limpo);
    if (valor === null) return 'nao_sei';
    // Um IPv4 vestido de IPv6 é um IPv4, e precisa ser procurado na lista dele
    // — a faixa brasileira de IPv4 não aparece na lista de IPv6.
    const MAPEADO = 0xffffn << 32n;
    if (valor >> 32n === MAPEADO >> 32n) {
      return contem(carregarV4(), valor & 0xffffffffn) ? 'sim' : 'nao';
    }
    return contem(carregarV6(), valor) ? 'sim' : 'nao';
  }

  const valor = lerV4(limpo);
  if (valor === null) return 'nao_sei';
  return contem(carregarV4(), valor) ? 'sim' : 'nao';
}
