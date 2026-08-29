import { describe, expect, it } from 'vitest';
import { disponivelDesdeDaSaida, rotuloDisponivelDesde } from './futebol-disponibilidade';

// ============================================================================
// "Disponível desde" (issue #300, investigação AE #120/#121)
// ============================================================================
// A regra de contiguidade — o que é atualização e o que é reativação — mora no
// backend, e é lá que ela está testada contra o snapshot. O que se testa aqui é
// a escolha da linha e a frase: pegar a saída certa e não escrever horário
// quando o backend não tem um para dar.
// ============================================================================

const linhas = [
  { market: 'goals_over_under', outcome: 'Over', line_value: 3.5, disponivel_desde: '2026-08-25T18:03:09.498041' },
  { market: 'goals_over_under', outcome: 'Under', line_value: 3.5, disponivel_desde: '2026-08-25T19:00:00' },
  { market: 'match_winner', outcome: 'Home', line_value: null, disponivel_desde: null },
];

describe('escolher a linha da saída analisada', () => {
  it('casa mercado, saída e linha', () => {
    expect(
      disponivelDesdeDaSaida(linhas, { market: 'goals_over_under', outcome: 'Over', line_value: 3.5 }),
    ).toBe('2026-08-25T18:03:09.498041');
  });

  it('não confunde os dois lados da mesma linha', () => {
    expect(
      disponivelDesdeDaSaida(linhas, { market: 'goals_over_under', outcome: 'Under', line_value: 3.5 }),
    ).toBe('2026-08-25T19:00:00');
  });

  it('casa mercado sem linha, como o 1X2', () => {
    expect(
      disponivelDesdeDaSaida(linhas, { market: 'match_winner', outcome: 'Home', line_value: null }),
    ).toBeNull();
  });

  it('saída que o backend não devolveu não inventa horário', () => {
    expect(
      disponivelDesdeDaSaida(linhas, { market: 'btts', outcome: 'Yes', line_value: null }),
    ).toBeNull();
    expect(
      disponivelDesdeDaSaida(linhas, { market: 'goals_over_under', outcome: 'Over', line_value: 2.5 }),
    ).toBeNull();
  });

  it('sem dados ou sem saída, devolve nulo em vez de estourar', () => {
    expect(disponivelDesdeDaSaida(undefined, { market: 'btts', outcome: 'Yes', line_value: null })).toBeNull();
    expect(disponivelDesdeDaSaida(linhas, null)).toBeNull();
  });
});

describe('a frase', () => {
  it('sai em horário de Brasília, e não no UTC que vem do banco', () => {
    // O caso medido da issue: publicado às 15:03 BRT, que são 18:03 UTC.
    expect(rotuloDisponivelDesde('2026-08-25T18:03:09.498041')).toBe('25/08 às 15:03');
  });

  it('não escreve nada quando o backend não tem horário para dar', () => {
    // Chave anterior à estreia do snapshot: o horário dataria a estreia, não a
    // publicação. Melhor vazio que inventado.
    expect(rotuloDisponivelDesde(null)).toBeNull();
    expect(rotuloDisponivelDesde(undefined)).toBeNull();
    expect(rotuloDisponivelDesde('')).toBeNull();
  });
});
