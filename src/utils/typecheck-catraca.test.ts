import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

// ============================================================================
// A catraca do typecheck não pode voltar a checar nada
// ============================================================================
// Este repositório passou a existência inteira sem nunca ter sido typechecado, e
// ninguém percebeu porque o comando que todo mundo roda PASSA: o tsconfig da
// raiz tem `"files": []` e só `references`, e sem `-b` ou `-p` o tsc compila a
// lista vazia e sai com sucesso (#343).
//
// É o modo de falha mais difícil de notar — a ferramenta certa, rodando, dizendo
// que está tudo bem. Não há mensagem, aviso nem lista vazia.
//
// Por isso a guarda: se alguém apontar o script para a raiz, ou tirar o passo do
// CI, o buraco volta invisível e nenhum outro teste percebe.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');

const ler = (caminho: string) => readFileSync(resolve(RAIZ, caminho), 'utf8');

/** Quantos arquivos um projeto do TypeScript de fato compila. */
function arquivosDoProjeto(projeto: string): string[] {
  const caminho = resolve(RAIZ, projeto);
  const lido = ts.readConfigFile(caminho, ts.sys.readFile);
  expect(lido.error).toBeUndefined();
  return ts.parseJsonConfigFileContent(lido.config, ts.sys, dirname(caminho)).fileNames;
}

const SCRIPT = ler('scripts/typecheck.mjs');
const CI = ler('.github/workflows/ci.yml');
const PACKAGE = JSON.parse(ler('package.json')) as { scripts: Record<string, string> };
const DIVIDA = JSON.parse(ler('scripts/typecheck-divida.json')) as Record<string, unknown>;

describe('catraca do typecheck', () => {
  it('o tsconfig da raiz compila zero arquivos — a armadilha existe mesmo', () => {
    // Este teste não protege nada: ele DOCUMENTA. Se um dia a raiz passar a
    // compilar de verdade, ele fica vermelho e quem passar por aqui descobre
    // que o aviso escrito no tsconfig e no script virou mentira.
    expect(arquivosDoProjeto('tsconfig.json')).toEqual([]);
  });

  it('os projetos que o script checa compilam arquivos de verdade', () => {
    const projetos = [...SCRIPT.matchAll(/'(tsconfig\.[a-z]+\.json)'/g)].map((m) => m[1]);
    expect(projetos.length).toBeGreaterThan(0);

    for (const projeto of projetos) {
      expect(arquivosDoProjeto(projeto).length).toBeGreaterThan(0);
    }
  });

  it('o script não aponta para o tsconfig da raiz', () => {
    // `-p tsconfig.json` seria o mesmo verde vazio de sempre.
    expect(SCRIPT).not.toMatch(/'tsconfig\.json'/);
  });

  it('existe um comando de typecheck, e ele é o script', () => {
    expect(PACKAGE.scripts.typecheck).toBe('node scripts/typecheck.mjs');
  });

  it('o CI roda o typecheck', () => {
    // Sem isto, o comando existe e ninguém o executa — que era metade do
    // defeito: lint, teste e build passavam sem olhar tipo nenhum.
    expect(CI).toContain('npm run typecheck');
  });

  it('todo arquivo da dívida declarada ainda existe', () => {
    // Caminho que sumiu (renomeado, apagado) deixa um número protegendo nada, e
    // faz a dívida parecer maior do que é.
    const sumidos = Object.keys(DIVIDA)
      .filter((chave) => !chave.startsWith('_'))
      .filter((caminho) => !existsSync(resolve(RAIZ, caminho)));

    expect(sumidos).toEqual([]);
  });
});
