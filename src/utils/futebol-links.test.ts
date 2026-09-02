import { describe, expect, it } from 'vitest';
import { hrefDoJogo, hrefDaSaida } from './futebol-links';

// ============================================================================
// O link carrega a saída clicada (issue #344)
// ============================================================================
// Vindo de Oportunidades, a tela do jogo abria já na saída que a pessoa clicou.
// Vindo da home ou do painel da agenda, abria no primeiro mercado da lista —
// gols, normalmente — e o pick que ela tinha acabado de ler não estava mais na
// tela. A tela do jogo sempre soube ler `?mercado=&saida=&linha=`; só a
// Oportunidades sabia escrever.
//
// A URL passa a ser montada num lugar só, para não existir de novo uma origem
// que esquece o filtro.
// ============================================================================

const over25 = { fixture_id: 42, market: 'goals_over_under', outcome: 'Over', line_value: 2.5 };

describe('hrefDoJogo', () => {
  it('sem saída, é só a tela do jogo', () => {
    expect(hrefDoJogo(42)).toBe('/futebol/jogo/42');
  });
});

describe('hrefDaSaida', () => {
  it('carrega mercado, saída e linha', () => {
    expect(hrefDaSaida(over25)).toBe('/futebol/jogo/42?mercado=goals_over_under&saida=Over&linha=2.5');
  });

  it('omite a linha quando o mercado não tem linha', () => {
    // 1x2 não tem linha. Mandar `linha=null` faria a tela procurar uma saída
    // com linha nula literal e não achar nada.
    expect(hrefDaSaida({ fixture_id: 7, market: 'match_winner', outcome: 'Home', line_value: null }))
      .toBe('/futebol/jogo/7?mercado=match_winner&saida=Home');
  });

  it('a linha zero é linha, e não ausência de linha', () => {
    // Handicap 0 existe e é diferente de "sem linha". Um `if (line_value)` o
    // apagaria — é o tipo de engano que só aparece num mercado específico.
    expect(hrefDaSaida({ fixture_id: 9, market: 'asian_handicap', outcome: 'Home', line_value: 0 }))
      .toBe('/futebol/jogo/9?mercado=asian_handicap&saida=Home&linha=0');
  });

  it('a linha negativa sobrevive ao encode', () => {
    expect(hrefDaSaida({ fixture_id: 9, market: 'asian_handicap', outcome: 'Away', line_value: -1.25 }))
      .toContain('linha=-1.25');
  });

  it('sem saída identificável, devolve a tela do jogo sem filtro', () => {
    // O trilho da agenda mostra jogo, não oportunidade: pode não haver leitura
    // com preço. Melhor abrir a tela inteira que inventar um filtro.
    expect(hrefDaSaida({ fixture_id: 42, market: null, outcome: null, line_value: null }))
      .toBe('/futebol/jogo/42');
    expect(hrefDaSaida(null, 42)).toBe('/futebol/jogo/42');
  });

  it('o que a tela do jogo lê é o que este módulo escreve', () => {
    // Guarda de contrato entre as duas pontas. Se alguém renomear um parâmetro
    // de um lado só, o link continua válido e o filtro para de funcionar em
    // silêncio — que é exatamente o defeito que a #344 conserta.
    const url = new URL(hrefDaSaida(over25), 'https://x');
    expect(url.searchParams.get('mercado')).toBe('goals_over_under');
    expect(url.searchParams.get('saida')).toBe('Over');
    expect(url.searchParams.get('linha')).toBe('2.5');
  });
});
