#!/usr/bin/env node
/**
 * Gera a lista de faixas de IP delegadas ao Brasil, a partir da publicação do LACNIC.
 *
 *   node scripts/gerar-faixas-brasil.mjs
 *
 * Por que um arquivo gerado e não uma consulta ao vivo: a resposta precisa
 * existir mesmo com o LACNIC fora do ar, e precisa ser mostrável ao contador
 * como arquivo — uma API de terceiro é caixa preta, e caixa preta não se
 * defende numa fiscalização. Ver #549 e a spec em #548.
 *
 * A publicação usada é o `delegated-lacnic-latest`, o mesmo arquivo que o
 * registro regional usa para declarar quem recebeu o quê. Duas situações
 * contam como delegado ao Brasil: `allocated` (o bloco foi dado a um provedor)
 * e `assigned` (foi dado a um usuário final). As outras — reservado,
 * disponível — não pertencem a país nenhum.
 *
 * ⚠️ As duas famílias saem em formatos diferentes, e é de propósito: cada uma
 * sai na forma em que a fonte a declara.
 *
 *   • IPv4 vem como endereço inicial + QUANTIDADE de endereços. Uma quantidade
 *     não é necessariamente um bloco CIDR (pode não ser potência de dois, e
 *     pode não estar alinhada), então forçar CIDR exigiria quebrar em vários e
 *     inflaria o arquivo. Sai como faixa `inicio-fim`.
 *   • IPv6 vem como endereço inicial + TAMANHO DO PREFIXO, que já é CIDR. Sai
 *     como CIDR, que além de ser a forma nativa é a mais curta e a mais legível
 *     para quem for auditar.
 *
 * Faixas encostadas ou sobrepostas são fundidas. Isso encolhe o arquivo sem
 * mudar nenhuma resposta, e deixa a busca binária com menos itens.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FONTE = 'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest';
const DESTINO = resolve('supabase/functions/shared/faixas-do-brasil.dados.ts');

/** Só estas duas situações significam "delegado a um país". */
const DELEGADO = new Set(['allocated', 'assigned']);

// ---------------------------------------------------------------- IPv4

function v4ParaNumero(endereco) {
  const partes = endereco.split('.');
  if (partes.length !== 4) throw new Error(`IPv4 estranho: ${endereco}`);
  return partes.reduce((acumulado, parte) => {
    const n = Number(parte);
    if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error(`IPv4 estranho: ${endereco}`);
    return acumulado * 256 + n;
  }, 0);
}

function numeroParaV4(numero) {
  return [numero >>> 24, (numero >>> 16) & 255, (numero >>> 8) & 255, numero & 255].join('.');
}

// ---------------------------------------------------------------- IPv6

/** Expande `2001:db8::` para os oito grupos, já em número. */
function v6ParaGrupos(endereco) {
  const [antes, depois] = endereco.split('::');
  const esquerda = antes ? antes.split(':') : [];
  const direita = depois ? depois.split(':') : [];
  const faltando = 8 - esquerda.length - direita.length;
  if (depois === undefined && esquerda.length !== 8) throw new Error(`IPv6 estranho: ${endereco}`);
  if (faltando < 0) throw new Error(`IPv6 estranho: ${endereco}`);
  const grupos = [...esquerda, ...Array(depois === undefined ? 0 : faltando).fill('0'), ...direita];
  return grupos.map((g) => parseInt(g || '0', 16));
}

function v6ParaBigInt(endereco) {
  return v6ParaGrupos(endereco).reduce((acumulado, grupo) => (acumulado << 16n) | BigInt(grupo), 0n);
}

// ---------------------------------------------------------------- leitura

async function baixar() {
  const resposta = await fetch(FONTE);
  if (!resposta.ok) throw new Error(`LACNIC devolveu HTTP ${resposta.status}`);
  return resposta.text();
}

function lerFaixas(texto) {
  const v4 = [];
  const v6 = [];

  for (const linha of texto.split('\n')) {
    // registro|país|família|inicio|valor|data|situação
    const campos = linha.split('|');
    if (campos.length < 7) continue;
    const [, pais, familia, inicio, valor, , situacao] = campos;
    if (pais !== 'BR' || !DELEGADO.has(situacao.trim())) continue;

    if (familia === 'ipv4') {
      const quantidade = Number(valor);
      if (!Number.isInteger(quantidade) || quantidade <= 0) continue;
      const comeco = v4ParaNumero(inicio);
      v4.push([BigInt(comeco), BigInt(comeco + quantidade - 1)]);
    } else if (familia === 'ipv6') {
      const bits = Number(valor);
      if (!Number.isInteger(bits) || bits < 0 || bits > 128) continue;
      const comeco = v6ParaBigInt(inicio);
      // ⚠️ Os tamanhos de prefixo do Brasil NÃO são todos múltiplos de quatro
      // — existem /29, /31, /35, /38, /39, /42 e /45 na publicação. Comparar
      // pedaço de hexadecimal daria resposta errada nesses; por isso a conta é
      // numérica de verdade.
      const tamanho = 1n << BigInt(128 - bits);
      v6.push([comeco, comeco + tamanho - 1n, inicio, bits]);
    }
  }

  return { v4, v6 };
}

// ---------------------------------------------------------------- fusão

/** Ordena e funde o que estiver sobreposto ou encostado. */
function fundir(faixas) {
  const ordenadas = [...faixas].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const saida = [];
  for (const [inicio, fim] of ordenadas) {
    const ultima = saida[saida.length - 1];
    // `fim + 1` funde o que está encostado, e não só o que se sobrepõe: duas
    // faixas vizinhas descrevem o mesmo território que uma faixa maior.
    if (ultima && inicio <= ultima[1] + 1n) {
      if (fim > ultima[1]) ultima[1] = fim;
    } else {
      saida.push([inicio, fim]);
    }
  }
  return saida;
}

// ---------------------------------------------------------------- escrita

function escrever(v4, v6) {
  const linhasV4 = v4.map(([i, f]) => `  '${numeroParaV4(Number(i))}-${numeroParaV4(Number(f))}',`);
  const linhasV6 = v6.map(([, , inicio, bits]) => `  '${inicio}/${bits}',`);

  const conteudo = `// ⚠️ ARQUIVO GERADO. Não edite à mão.
//
// Gerado por \`node scripts/gerar-faixas-brasil.mjs\` a partir da publicação de
// delegações do LACNIC. Regerar quando alguém reclamar de bloqueio indevido, ou
// de tempos em tempos — alocação de país muda devagar, não muda de semana para
// semana.
//
// Gerado em: ${new Date().toISOString().slice(0, 10)}
//
// As duas famílias saem em formatos diferentes porque cada uma sai na forma em
// que a fonte a declara: IPv4 como faixa (a fonte dá quantidade de endereços,
// que nem sempre é um bloco CIDR), IPv6 como CIDR (a fonte já dá o prefixo).
// O detalhe está no script.

/** Faixas IPv4 delegadas ao Brasil, no formato \`inicio-fim\`, já fundidas e em ordem. */
export const FAIXAS_V4: readonly string[] = [
${linhasV4.join('\n')}
];

/** Blocos IPv6 delegados ao Brasil, em CIDR, já fundidos e em ordem. */
export const FAIXAS_V6: readonly string[] = [
${linhasV6.join('\n')}
];
`;

  writeFileSync(DESTINO, conteudo, 'utf8');
}

// ---------------------------------------------------------------- execução

const texto = await baixar();
const { v4, v6 } = lerFaixas(texto);

if (v4.length === 0 || v6.length === 0) {
  console.error('A publicação não trouxe faixas das duas famílias. Nada foi escrito.');
  process.exit(1);
}

const v4Fundidas = fundir(v4);
// O IPv6 é fundido para conferir sobreposição, mas o que é escrito é o CIDR
// original: fundir dois CIDRs vizinhos nem sempre dá um CIDR, e o formato
// legível vale mais aqui do que as poucas linhas que a fusão economizaria.
const v6Ordenadas = [...v6].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

escrever(v4Fundidas, v6Ordenadas);

console.log(`IPv4: ${v4.length} registros lidos, ${v4Fundidas.length} faixas depois de fundir.`);
console.log(`IPv6: ${v6Ordenadas.length} blocos.`);
console.log(`Escrito em ${DESTINO}`);
