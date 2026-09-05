import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// O vermelho do módulo Futebol é o da marca, e não o do Tailwind
// ============================================================================
// O verde e o vermelho das telas de futebol vinham de sistemas diferentes, e
// era isso que fazia o par parecer desalinhado sem ninguém saber apontar onde:
//
//   verde    #2f7d50  matiz 145°   status.success da marca
//   vermelho #be123c  matiz 345°   rose-700, do tema padrão do Tailwind
//
// Os 24° entre 345° e a matiz 9° do `status.danger` da marca (#b8341c) cruzam
// a fronteira do vermelho-alaranjado para o vermelho-rosado. Ao lado de um
// verde-mata quente, o rosa lê frio — e o guia visual do rebrand pede
// literalmente o contrário: "verde/vermelho/âmbar QUENTES mas nunca coloridos
// demais" (docs/futebol-rebrand-guia-visual.md, seção D5).
//
// A cor certa nunca esteve em disputa: o guia lista `danger #b8341c` na seção
// de tokens, e 41 arquivos do app já a usam. O módulo de futebol é que tinha
// pegado a do Tailwind, provavelmente por autocomplete.
//
// Esta guarda existe porque a divergência é invisível em review: `#be123c` e
// `#b8341c` diferem em dois caracteres e ninguém compara matiz lendo diff.
// ============================================================================

const RAIZ = resolve(__dirname, '../..');

/** Cores que não são da marca, e a da marca que ocupa o lugar delas. */
const PROIBIDAS: Record<string, string> = {
  '#be123c': '#b8341c (status.danger)',
  '#fbe3e8': '#fbeeec (sand.danger-bg)',
  '#f0c2cc': '#f0c8c1 (a mesma borda, na matiz da marca)',
};

/** Onde as telas de futebol moram. */
const PASTAS = ['src/components/futebol', 'src/pages'];
const SO_FUTEBOL = /^Futebol/;

function arquivosDeFutebol(): string[] {
  const achados: string[] = [];
  for (const pasta of PASTAS) {
    const dir = resolve(RAIZ, pasta);
    for (const nome of readdirSync(dir)) {
      if (!nome.endsWith('.tsx') || nome.includes('.test.')) continue;
      // Em `src/pages` convivem todos os módulos; só as telas de futebol
      // entram. Em `src/components/futebol` a pasta já é o recorte.
      if (pasta === 'src/pages' && !SO_FUTEBOL.test(nome)) continue;
      achados.push(`${pasta}/${nome}`);
    }
  }
  return achados;
}

describe('as cores de status do módulo Futebol', () => {
  it('não usam a paleta padrão do Tailwind no lugar da marca', () => {
    const infracoes: string[] = [];

    for (const rel of arquivosDeFutebol()) {
      const linhas = readFileSync(resolve(RAIZ, rel), 'utf8').split('\n');
      linhas.forEach((linha, i) => {
        for (const [cor, substituta] of Object.entries(PROIBIDAS)) {
          if (linha.toLowerCase().includes(cor)) {
            infracoes.push(`${rel}:${i + 1} usa ${cor} — troque por ${substituta}`);
          }
        }
      });
    }

    expect(infracoes, infracoes.join('\n')).toEqual([]);
  });

  it('o recorte pega arquivos de verdade', () => {
    // Sem isto, um erro no filtro faria o teste acima passar varrendo nada — a
    // guarda mais comum de falhar em silêncio.
    const arquivos = arquivosDeFutebol();
    expect(arquivos.length).toBeGreaterThan(10);
    expect(arquivos).toContain('src/components/futebol/FixtureRow.tsx');
    expect(arquivos).toContain('src/pages/FutebolJogo.tsx');
  });
});
