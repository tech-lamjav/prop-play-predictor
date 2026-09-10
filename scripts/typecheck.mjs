#!/usr/bin/env node
// ============================================================================
// O typecheck que realmente checa
// ============================================================================
// Este repositório nunca foi typechecado. Não foi regressão: `tsconfig.json` na
// raiz tem `"files": []` e só `references`, e sem `-b` ou `-p` o tsc compila a
// lista vazia e sai com sucesso. `npx tsc --noEmit` sempre passou olhando NADA.
// O CI também não checava tipo: lint, build e teste não olham tipo, e o build é
// Vite/esbuild, que apaga os tipos sem verificá-los (#343).
//
// O custo já apareceu: um componente usando <Link> sem importar passou batido, e
// quatro trocas de assinatura falharam em silêncio por CRLF e só apareceriam no
// navegador.
//
// ── Por que não ligar o gate de uma vez ─────────────────────────────────────
// A dívida existente deixaria o CI vermelho no primeiro PR, e o time desligaria
// o gate. É assim que gate morre. Então a barreira é uma CATRACA: a dívida de
// hoje está declarada arquivo por arquivo em typecheck-divida.json, e o que ela
// impede é a dívida CRESCER — arquivo novo com erro reprova, arquivo conhecido
// que piora reprova, e o resto do repositório fica barrado por padrão.
//
// Arquivo que melhora não reprova, só avisa. É de propósito: reprovar quem
// consertou é a friction que mata catraca.
//
// ── A armadilha da raiz ─────────────────────────────────────────────────────
// Se alguém apontar este script para o `tsconfig.json` da raiz, o problema volta
// invisível: o tsc não reclama de uma lista de arquivos EXPLICITAMENTE vazia,
// ele só não tem o que fazer. Por isso o script conta os arquivos de entrada de
// cada projeto antes de rodar e morre se algum resolver para zero.
// ============================================================================

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Os projetos de verdade. A raiz NÃO entra: ela não compila nada. */
const PROJETOS = ['tsconfig.app.json', 'tsconfig.node.json'];

/**
 * A dívida declarada. Chaves com `_` no começo são texto para quem lê o
 * arquivo, e não caminho — JSON não aceita comentário.
 */
const DIVIDA = Object.fromEntries(
  Object.entries(
    JSON.parse(readFileSync(resolve(RAIZ, 'scripts/typecheck-divida.json'), 'utf8')),
  ).filter(([chave]) => !chave.startsWith('_')),
);

/** `src/foo/bar.ts(12,5): error TS2345: ...` → o caminho, normalizado. */
const LINHA_DE_ERRO = /^(.+?)\((\d+),(\d+)\): error TS\d+:/;

function arquivosDoProjeto(projeto) {
  const caminho = resolve(RAIZ, projeto);
  const lido = ts.readConfigFile(caminho, ts.sys.readFile);
  if (lido.error) {
    throw new Error(`${projeto}: ${ts.flattenDiagnosticMessageText(lido.error.messageText, ' ')}`);
  }
  return ts.parseJsonConfigFileContent(lido.config, ts.sys, dirname(caminho)).fileNames;
}

function rodarTsc(projeto) {
  const tsc = resolve(RAIZ, 'node_modules/typescript/bin/tsc');
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', projeto], {
    cwd: RAIZ,
    encoding: 'utf8',
  });
  return `${r.stdout || ''}${r.stderr || ''}`;
}

const errosPorArquivo = new Map();
let saidaBruta = '';

for (const projeto of PROJETOS) {
  const entradas = arquivosDoProjeto(projeto);
  if (entradas.length === 0) {
    console.error(
      `\n✗ ${projeto} resolveu ZERO arquivos de entrada.\n` +
        `  É exatamente o defeito da #343: o tsc passaria sem olhar nada.\n` +
        `  Conserte o projeto ou tire-o da lista PROJETOS deste script.\n`,
    );
    process.exit(2);
  }
  console.log(`· ${projeto}: ${entradas.length} arquivos`);

  const saida = rodarTsc(projeto);
  saidaBruta += saida;
  for (const linha of saida.split('\n')) {
    const m = LINHA_DE_ERRO.exec(linha.trim());
    if (!m) continue;
    const arquivo = m[1].replace(/\\/g, '/');
    errosPorArquivo.set(arquivo, (errosPorArquivo.get(arquivo) ?? 0) + 1);
  }
}

const total = [...errosPorArquivo.values()].reduce((a, b) => a + b, 0);

const novos = []; // arquivo com erro que não está na dívida declarada
const piores = []; // arquivo da dívida que passou do teto
const melhores = []; // arquivo da dívida que melhorou (só aviso)

for (const [arquivo, n] of errosPorArquivo) {
  const teto = DIVIDA[arquivo];
  if (teto == null) novos.push([arquivo, n]);
  else if (n > teto) piores.push([arquivo, n, teto]);
  else if (n < teto) melhores.push([arquivo, n, teto]);
}
for (const arquivo of Object.keys(DIVIDA)) {
  if (!errosPorArquivo.has(arquivo)) melhores.push([arquivo, 0, DIVIDA[arquivo]]);
}

const tetoTotal = Object.values(DIVIDA).reduce((a, b) => a + b, 0);
console.log(`\n${total} erro(s) de tipo · dívida declarada: ${tetoTotal}`);

if (melhores.length) {
  console.log('\n↓ melhorou (não reprova, mas atualize o número):');
  for (const [arquivo, n, teto] of melhores) console.log(`    ${arquivo}: ${teto} → ${n}`);
}

if (novos.length || piores.length) {
  console.error('\n✗ a dívida de tipo CRESCEU\n');
  for (const [arquivo, n] of novos) {
    console.error(`  ${arquivo}: ${n} erro(s), e este arquivo não está na dívida declarada.`);
  }
  for (const [arquivo, n, teto] of piores) {
    console.error(`  ${arquivo}: ${n} erro(s), acima dos ${teto} declarados.`);
  }
  console.error(
    '\n  Os erros estão acima, na saída do tsc. Conserte-os — declarar o número\n' +
      '  novo em scripts/typecheck-divida.json desliga a catraca.\n',
  );
  console.error(saidaBruta.trim().split('\n').slice(0, 60).join('\n'));
  process.exit(1);
}

console.log('\n✓ nenhum erro de tipo novo');
