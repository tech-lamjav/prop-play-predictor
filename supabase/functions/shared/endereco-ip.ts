/**
 * Ler um endereço de IP, e procurar um valor numa lista de faixas.
 *
 * Spec em #548. Nasceu dentro de `faixas-do-brasil.ts` (#549) e saiu de lá
 * quando o lote que resolve o país (#553) precisou exatamente das mesmas
 * contas. Duas cópias de um parser de endereço é o tipo de duplicação que não
 * dói hoje e dói quando uma das duas ganha uma correção que a outra não ganha —
 * e aqui as duas respondem perguntas sobre a MESMA pessoa, então elas
 * discordarem seria pior do que qualquer uma das duas estar errada.
 *
 * Tudo aqui é puro: sem rede, sem banco, sem relógio.
 */

/** Uma faixa fechada dos dois lados. */
export type Faixa = readonly [bigint, bigint];

/** Um endereço lido: a que família pertence e qual o valor numérico. */
export interface EnderecoLido {
  readonly familia: 'v4' | 'v6';
  readonly valor: bigint;
}

/**
 * Converte um IPv4 em número, ou devolve null se não for um IPv4 válido.
 *
 * Recusa em vez de adivinhar: `1.2.3` e `1.2.3.999` não viram endereço nenhum.
 */
export function lerV4(endereco: string): bigint | null {
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
export function lerV6(endereco: string): bigint | null {
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

/** Os 96 bits que marcam um IPv4 vestido de IPv6 (`::ffff:a.b.c.d`). */
const PREFIXO_MAPEADO = 0xffffn;

/**
 * Lê um endereço de qualquer família, ou devolve null.
 *
 * Um IPv4 vestido de IPv6 volta como `v4`, e é de propósito: ele PRECISA ser
 * procurado na lista de IPv4, porque as faixas de um país não aparecem
 * duplicadas na lista de IPv6. Procurar na lista errada faria todo endereço
 * nessa forma sair como desconhecido.
 */
export function lerEndereco(endereco: string | null | undefined): EnderecoLido | null {
  if (typeof endereco !== 'string') return null;
  const limpo = endereco.trim();
  if (limpo === '') return null;

  if (limpo.includes(':')) {
    const valor = lerV6(limpo);
    if (valor === null) return null;
    if (valor >> 32n === PREFIXO_MAPEADO) {
      return { familia: 'v4', valor: valor & 0xffffffffn };
    }
    return { familia: 'v6', valor };
  }

  const valor = lerV4(limpo);
  return valor === null ? null : { familia: 'v4', valor };
}

// ---------------------------------------------------------------- faixas

/** Lê `24.152.0.0-24.152.3.255`, ou devolve null. */
export function lerFaixaV4(texto: string): Faixa | null {
  const [inicio, fim] = texto.split('-');
  const a = lerV4(inicio ?? '');
  const b = lerV4(fim ?? '');
  return a === null || b === null ? null : [a, b];
}

/** Lê `2001:1200::/32`, ou devolve null. */
export function lerBlocoV6(texto: string): Faixa | null {
  const [endereco, bitsTexto] = texto.split('/');
  const comeco = lerV6(endereco ?? '');
  const bits = Number(bitsTexto);
  if (comeco === null || !Number.isInteger(bits) || bits < 0 || bits > 128) return null;

  // A máscara existe para o caso de a fonte trazer um bloco com bits de host
  // preenchidos. Não deveria acontecer, e se acontecer o certo é o bloco, não
  // o endereço solto que veio escrito.
  const tamanho = 1n << BigInt(128 - bits);
  const inicio = (comeco / tamanho) * tamanho;
  return [inicio, inicio + tamanho - 1n];
}

/**
 * Busca binária numa lista ordenada de faixas que não se sobrepõem.
 *
 * Devolve o ÍNDICE, e não um booleano: quem procura país precisa saber qual
 * faixa achou para poder ler o código dela. Quem só quer saber se achou
 * compara com -1.
 */
export function procurar(faixas: readonly Faixa[], valor: bigint): number {
  let baixo = 0;
  let alto = faixas.length - 1;
  while (baixo <= alto) {
    const meio = (baixo + alto) >> 1;
    const [inicio, fim] = faixas[meio];
    if (valor < inicio) alto = meio - 1;
    else if (valor > fim) baixo = meio + 1;
    else return meio;
  }
  return -1;
}
