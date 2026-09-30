// ============================================================================
// gen-i18n-premissas.mjs — gera o catálogo em português DA PRÓPRIA FUNÇÃO
// ============================================================================
// O valor em português de cada chave do catálogo `premissas` tem de ser
// IDÊNTICO ao que a função de copy devolve hoje — é isso que faz o #544 não
// mudar uma vírgula do produto em português. Copiar 200 frases à mão é o jeito
// mais seguro de introduzir uma divergência que ninguém vê.
//
// Então o arquivo é gerado. A fonte é `src/utils/futebol-copy-catalogo.ts`, que
// monta o catálogo a partir dos mapas de copy dos sete arquivos de `src/utils`.
//
// Uso:
//   node scripts/gen-i18n-premissas.mjs            escreve o arquivo
//   node scripts/gen-i18n-premissas.mjs --conferir  só confere, e sai 1 se mudou
//
// ⚠️ O ESPANHOL NÃO É GERADO. Ele é escrito à mão, revisado contra o glossário
// (`CONTEXT.md`, seção "Vocabulario en español"), e quem cobra que ele tenha
// exatamente estas chaves é `src/i18n/catalogo-paridade.test.ts`.
// ============================================================================
import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DESTINO = path.join(RAIZ, 'src/i18n/locales/pt/premissas.json');

/**
 * Traz o catálogo do TypeScript para dentro deste script.
 *
 * Passa pelo esbuild porque o módulo é TS e usa o alias `@/`. O bundle sai num
 * diretório temporário DO SISTEMA (`os.tmpdir`), e não em `/tmp`: no node deste
 * Windows `/tmp` é `C:\tmp` e não existe.
 */
async function carregarCatalogo() {
  const pasta = await mkdtemp(path.join(tmpdir(), 'gen-i18n-premissas-'));
  const saida = path.join(pasta, 'catalogo.mjs');
  try {
    await build({
      entryPoints: [path.join(RAIZ, 'src/utils/futebol-copy-catalogo.ts')],
      outfile: saida,
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node18',
      logLevel: 'warning',
      alias: { '@': path.join(RAIZ, 'src') },
    });
    return await import(pathToFileURL(saida).href);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

/**
 * O fim de linha do arquivo que já está no disco.
 *
 * O worktree é CRLF. Escrever LF num arquivo CRLF (ou o contrário) faz o diff
 * mostrar o arquivo inteiro reescrito e esconde a mudança de verdade.
 */
function fimDeLinha(caminho) {
  if (!existsSync(caminho)) return '\r\n';
  return readFileSync(caminho, 'utf8').includes('\r\n') ? '\r\n' : '\n';
}

const { catalogoDaCopyEmPortugues, catalogoAninhado } = await carregarCatalogo();
const plano = catalogoDaCopyEmPortugues();
const eol = fimDeLinha(DESTINO);
const texto = JSON.stringify(catalogoAninhado(plano), null, 2).split('\n').join(eol) + eol;

const conferir = process.argv.includes('--conferir');
const atual = existsSync(DESTINO) ? await readFile(DESTINO, 'utf8') : null;

if (conferir) {
  if (atual === texto) {
    console.log(`ok — ${Object.keys(plano).length} chaves, catálogo em dia`);
  } else {
    console.error('DIVERGIU — rode `node scripts/gen-i18n-premissas.mjs` e confira o diff');
    process.exit(1);
  }
} else {
  await writeFile(DESTINO, texto, 'utf8');
  console.log(
    `${Object.keys(plano).length} chaves escritas em src/i18n/locales/pt/premissas.json` +
      (atual === texto ? ' (sem mudança)' : ''),
  );
}
