#!/usr/bin/env node
/**
 * Gera as listas de faixas de IP a partir da publicação de delegações do LACNIC.
 *
 *   node scripts/gerar-faixas-de-ip.mjs
 *
 * Saem DOIS arquivos, de um único download e de uma única leitura — é o que
 * garante que eles não possam discordar entre si:
 *
 *   • `faixas-do-brasil.dados.ts` — só o Brasil. Vai no caminho quente, onde o
 *     porteiro pergunta "é do Brasil?" a cada chegada (#549). Pequeno de
 *     propósito: quanto menos ele carrega, mais barata é a partida a frio.
 *
 *   • `faixas-por-pais.dados.ts` — todos os países do LACNIC, com o código de
 *     cada um. Vai no lote que preenche o país depois (#553), fora do caminho
 *     de qualquer pessoa, e por isso pode ser maior.
 *
 * Por que arquivo gerado e não consulta ao vivo: a resposta precisa existir com
 * o LACNIC fora do ar, e precisa ser mostrável ao contador como arquivo. API de
 * terceiro é caixa preta, e caixa preta não se defende numa fiscalização — além
 * de exigir cadastro, chave e um limite de uso que ninguém lembra de monitorar.
 *
 * ⚠️ O QUE ESTA FONTE NÃO COBRE. O LACNIC delega para a América Latina e o
 * Caribe. Os quatro países da operação — Peru, Argentina, Colômbia e México —
 * estão todos aqui, e o Brasil também. Um endereço da Europa, dos Estados
 * Unidos ou da Ásia sai como país desconhecido: ainda prova que a pessoa NÃO
 * estava no Brasil, mas não diz onde estava. Cobrir o resto exigiria baixar as
 * publicações dos outros quatro registros regionais, o que multiplicaria o
 * arquivo por umas dez vezes para atender um mercado que ninguém declarou.
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
 * Faixas encostadas ou sobrepostas do MESMO país são fundidas. Isso encolhe o
 * arquivo sem mudar nenhuma resposta, e deixa a busca binária com menos itens.
 */
// ⚠️ DUPLICAÇÃO CONHECIDA. As contas de endereço abaixo (`v4ParaNumero`,
// `v6ParaBigInt`, a expansão do `::`) existem também em
// `supabase/functions/shared/endereco-ip.ts`, que é onde elas moram para valer.
// A fronteira é de runtime: este script roda em node, aquele módulo é TypeScript
// para o Deno, e node não importa `.ts`.
//
// A duplicação é tolerável aqui por um motivo específico: as duas cópias não
// respondem a mesma pergunta em produção. Esta converte a publicação do LACNIC
// UMA VEZ, na geração; aquela lê o endereço de quem chega, a cada acesso. E o
// teste do arquivo gerado confere o resultado das duas contra os mesmos dados,
// então uma divergência entre elas aparece como teste vermelho, e não como
// bloqueio errado em silêncio.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FONTE = 'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest';
const DESTINO_BRASIL = resolve('supabase/functions/shared/faixas-do-brasil.dados.ts');
const DESTINO_PAISES = resolve('supabase/functions/shared/faixas-por-pais.dados.ts');

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

/** Devolve, por país, as faixas IPv4 e os blocos IPv6 delegados a ele. */
function lerPorPais(texto) {
  /** @type {Map<string, { v4: [bigint, bigint][], v6: [bigint, string, number][] }>} */
  const porPais = new Map();

  const doPais = (pais) => {
    let atual = porPais.get(pais);
    if (!atual) {
      atual = { v4: [], v6: [] };
      porPais.set(pais, atual);
    }
    return atual;
  };

  for (const linha of texto.split('\n')) {
    // registro|país|família|inicio|valor|data|situação
    const campos = linha.split('|');
    if (campos.length < 7) continue;
    const [, pais, familia, inicio, valor, , situacao] = campos;
    if (!/^[A-Z]{2}$/.test(pais) || !DELEGADO.has(situacao.trim())) continue;

    if (familia === 'ipv4') {
      const quantidade = Number(valor);
      if (!Number.isInteger(quantidade) || quantidade <= 0) continue;
      const comeco = v4ParaNumero(inicio);
      doPais(pais).v4.push([BigInt(comeco), BigInt(comeco + quantidade - 1)]);
    } else if (familia === 'ipv6') {
      const bits = Number(valor);
      if (!Number.isInteger(bits) || bits < 0 || bits > 128) continue;
      // ⚠️ Os tamanhos de prefixo do Brasil NÃO são todos múltiplos de quatro
      // — existem /29, /31, /35, /38, /39, /42 e /45 na publicação. Comparar
      // pedaço de hexadecimal daria resposta errada nesses; por isso tudo aqui
      // é conta numérica de verdade.
      doPais(pais).v6.push([v6ParaBigInt(inicio), inicio, bits]);
    }
  }

  return porPais;
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

const porInicio = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

// ---------------------------------------------------------------- escrita

const CABECALHO = (quando) => `// ⚠️ ARQUIVO GERADO. Não edite à mão.
//
// Gerado por \`node scripts/gerar-faixas-de-ip.mjs\` a partir da publicação de
// delegações do LACNIC. Regerar quando alguém reclamar de bloqueio indevido, ou
// de tempos em tempos — alocação de país muda devagar, não muda de semana para
// semana.
//
// Gerado em: ${quando}
//
// As duas famílias saem em formatos diferentes porque cada uma sai na forma em
// que a fonte a declara: IPv4 como faixa (a fonte dá quantidade de endereços,
// que nem sempre é um bloco CIDR), IPv6 como CIDR (a fonte já dá o prefixo).
// O detalhe está no script.
`;

function escreverBrasil(v4, v6, quando) {
  const conteudo = `${CABECALHO(quando)}
/** Faixas IPv4 delegadas ao Brasil, no formato \`inicio-fim\`, já fundidas e em ordem. */
export const FAIXAS_V4: readonly string[] = [
${v4.map(([i, f]) => `  '${numeroParaV4(Number(i))}-${numeroParaV4(Number(f))}',`).join('\n')}
];

/** Blocos IPv6 delegados ao Brasil, em CIDR, já fundidos e em ordem. */
export const FAIXAS_V6: readonly string[] = [
${v6.map(([, inicio, bits]) => `  '${inicio}/${bits}',`).join('\n')}
];
`;
  writeFileSync(DESTINO_BRASIL, conteudo, 'utf8');
}

function escreverPaises(v4, v6, quando) {
  const conteudo = `${CABECALHO(quando)}//
// Este arquivo cobre TODOS os países do LACNIC — América Latina e Caribe. Ele
// serve ao lote que preenche o país depois do acesso (#553), e não ao porteiro.
// Um endereço de fora dessa região não aparece aqui: ele continua provando que
// a pessoa não estava no Brasil, mas não diz onde ela estava.
//
// O código de país vem depois de uma barra vertical, no fim de cada linha.

/** Faixas IPv4 por país, no formato \`inicio-fim|PA\`, em ordem de endereço. */
export const FAIXAS_PAIS_V4: readonly string[] = [
${v4.map(([i, f, pais]) => `  '${numeroParaV4(Number(i))}-${numeroParaV4(Number(f))}|${pais}',`).join('\n')}
];

/** Blocos IPv6 por país, no formato \`cidr|PA\`, em ordem de endereço. */
export const FAIXAS_PAIS_V6: readonly string[] = [
${v6.map(([, inicio, bits, pais]) => `  '${inicio}/${bits}|${pais}',`).join('\n')}
];
`;
  writeFileSync(DESTINO_PAISES, conteudo, 'utf8');
}

// ---------------------------------------------------------------- execução

const texto = await baixar();
const porPais = lerPorPais(texto);

const brasil = porPais.get('BR');
if (!brasil || brasil.v4.length === 0 || brasil.v6.length === 0) {
  console.error('A publicação não trouxe as duas famílias para o Brasil. Nada foi escrito.');
  process.exit(1);
}

const quando = new Date().toISOString().slice(0, 10);

// ── Brasil, para o caminho quente ───────────────────────────────────────────
const brasilV4 = fundir(brasil.v4);
// O IPv6 não é fundido: fundir dois CIDRs vizinhos nem sempre dá um CIDR, e o
// formato legível vale mais aqui que as poucas linhas que a fusão economizaria.
const brasilV6 = [...brasil.v6].sort(porInicio);
escreverBrasil(brasilV4, brasilV6, quando);

// ── Todos os países, para o lote ────────────────────────────────────────────
// A fusão acontece DENTRO de cada país, e nunca entre países: faixas vizinhas
// de países diferentes são territórios diferentes, e fundi-las apagaria
// justamente a informação que este arquivo existe para carregar.
const paisesV4 = [];
const paisesV6 = [];
for (const [pais, faixas] of porPais) {
  for (const [inicio, fim] of fundir(faixas.v4)) paisesV4.push([inicio, fim, pais]);
  for (const [valor, inicio, bits] of faixas.v6) paisesV6.push([valor, inicio, bits, pais]);
}
paisesV4.sort(porInicio);
paisesV6.sort(porInicio);
escreverPaises(paisesV4, paisesV6, quando);

console.log(`Brasil  · IPv4: ${brasil.v4.length} registros → ${brasilV4.length} faixas · IPv6: ${brasilV6.length} blocos`);
console.log(`Países  · ${porPais.size} países · IPv4: ${paisesV4.length} faixas · IPv6: ${paisesV6.length} blocos`);
console.log(`Escritos em ${DESTINO_BRASIL}`);
console.log(`           ${DESTINO_PAISES}`);
