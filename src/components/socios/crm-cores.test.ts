import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// ============================================================================
// `ink-3` não é cor de texto
// ============================================================================
// A escala do rebrand tem quatro tons: `ink` (#1a1d1a), `ink-2` (#5a625a),
// `ink-dim` (#9aa097) e `ink-3` (#eef0ec). Os três primeiros são texto; o
// último é quase branco, e existe para SUPERFÍCIE — divisor, fundo de barra,
// preenchimento leve.
//
// Eu usei `text-ink-3` em dezessete lugares do painel. Em fundo branco, o
// resultado é texto invisível: legenda dos números, cabeçalho da tabela,
// telefone de cada linha, aba inativa. Nenhum teste pegou, porque todos eles
// leem o TEXTO do elemento — e o texto estava lá, só não dava para ver.
//
// Este guarda existe porque o erro é silencioso por natureza: só aparece
// abrindo a tela, e some da memória de quem escreve na semana seguinte.
// ============================================================================

const PASTA = __dirname;

const componentes = readdirSync(PASTA).filter(
  (arquivo) => arquivo.endsWith('.tsx') && !arquivo.endsWith('.test.tsx'),
);

describe('as cores de texto do painel', () => {
  it('existe componente para conferir', () => {
    // Sem isto, apagar a pasta inteira deixaria a suíte verde.
    expect(componentes.length).toBeGreaterThan(3);
  });

  it.each(componentes)('%s não pinta texto com o tom de superfície', (arquivo) => {
    const fonte = readFileSync(resolve(PASTA, arquivo), 'utf8');
    // `bg-ink-3` continua permitido: como fundo, o tom é justamente o certo.
    expect(fonte).not.toMatch(/text-ink-3\b/);
    expect(fonte).not.toMatch(/placeholder:text-ink-3\b/);
  });
});
