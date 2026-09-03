import { describe, expect, it } from 'vitest';
import { ROTULO_DO_ESTADO, estadoDaPremissa, type EstadoDaPremissa } from './futebol-estado-da-premissa';
import { premissaDe } from './futebol-premissas';
import type { Saida } from './futebol-saida';

// ============================================================================
// Os cinco estados de uma premissa (issue #357, spec #349)
// ============================================================================
// A tela tinha três rótulos e um contador para cinco coisas, e dois pares
// desses cinco apareciam como o mesmo silêncio:
//
//   · sem dado                 → o Motor não soube
//   · sem número para conferir → nós não mostramos
//
// São opostos. Estes testes fixam a separação.
// ============================================================================

const over = (linha = 2.5): Saida => ({ market: 'goals_over_under', outcome: 'Over', line_value: linha });
const under = (linha = 2.5): Saida => ({ market: 'goals_over_under', outcome: 'Under', line_value: linha });
const p = (slug: string) => premissaDe('goals_over_under', slug)!;

const estado = (
  slug: string,
  saida: Saida,
  acesas: string[],
  temNumero = true,
): EstadoDaPremissa => estadoDaPremissa({ premissa: p(slug), saida, acesas, temNumero });

describe('cada estado é alcançável e nenhum se confunde com outro', () => {
  it('acesa: o insumo cruzou o corte e a tela tem o número', () => {
    expect(estado('defesas_vazaveis', over(), ['defesas_vazaveis'])).toBe('acesa');
  });

  it('não atingiu o corte: foi avaliada e ficou aquém', () => {
    expect(estado('defesas_vazaveis', over(), [])).toBe('nao_atingiu_o_corte');
  });

  it('não se aplica: é do outro lado da saída', () => {
    expect(estado('defesas_firmes', over(), [])).toBe('nao_se_aplica');
    expect(estado('defesas_vazaveis', under(), [])).toBe('nao_se_aplica');
  });

  it('sem número para conferir: acendeu, e o front não tem o insumo', () => {
    // É o caso da premissa de ritmo: o insumo dela não existe em nada que o
    // front alcance (#348).
    expect(estado('ritmo_alto', over(), ['ritmo_alto'], false)).toBe('sem_numero_para_conferir');
  });
});

describe('os dois silêncios não se misturam', () => {
  it('sem número para conferir NÃO é sem dado', () => {
    // O primeiro é o modelo que avaliou e a tela que não mostra; o segundo é o
    // modelo que não pôde avaliar. Um veio com veredito, o outro não.
    expect(estado('ritmo_alto', over(), ['ritmo_alto'], false)).not.toBe('sem_dado');
  });

  it('sem dado nunca sai desta função, e o motivo está no módulo', () => {
    // Os NOMES das premissas cegas não chegam ao Postgres: no mart a premissa
    // sem insumo vira `false`, não `null`, e só o contador atravessa. Se um dia
    // este teste começar a falhar, é porque os nomes passaram a chegar — e aí a
    // mudança é deliberada, não acidente.
    const todos = new Set<EstadoDaPremissa>();
    for (const saida of [over(), under()]) {
      for (const slug of ['defesas_vazaveis', 'defesas_firmes', 'ritmo_alto', 'historico_over']) {
        for (const acesas of [[], [slug]]) {
          for (const temNumero of [true, false]) {
            todos.add(estado(slug, saida, acesas, temNumero));
          }
        }
      }
    }

    expect(todos.has('sem_dado')).toBe(false);
    expect([...todos].sort()).toEqual([
      'acesa',
      'nao_atingiu_o_corte',
      'nao_se_aplica',
      'sem_numero_para_conferir',
    ]);
  });
});

describe('os rótulos', () => {
  it('nenhum rótulo afirma que o fato não aconteceu', () => {
    // "Não aconteceu neste jogo" era falso: no clean sheets com 38%, os jogos
    // sem sofrer gol aconteceram — só ficaram abaixo do corte.
    for (const rotulo of Object.values(ROTULO_DO_ESTADO)) {
      expect(rotulo).not.toMatch(/não aconteceu/i);
    }
  });

  it('o rótulo do estado avaliado-e-aquém é o do glossário', () => {
    expect(ROTULO_DO_ESTADO.nao_atingiu_o_corte).toBe('não atingiu o corte');
  });

  it('os cinco estados têm rótulo', () => {
    expect(Object.keys(ROTULO_DO_ESTADO)).toHaveLength(5);
  });
});

describe('mercado sem lado declarado não descarta premissa nenhuma', () => {
  it('no resultado, toda premissa se aplica às três saídas', () => {
    const home: Saida = { market: 'match_winner', outcome: 'Home', line_value: null };
    const forma = premissaDe('match_winner', 'forma')!;

    expect(estadoDaPremissa({ premissa: forma, saida: home, acesas: [], temNumero: true })).toBe(
      'nao_atingiu_o_corte',
    );
  });
});
