import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hrefDoJogo, hrefDaSaida, PARAMS_DA_SAIDA } from './futebol-links';

// ============================================================================
// O link carrega a saída clicada (issue #344)
// ============================================================================
// Vindo de Oportunidades, a tela do jogo abria já na saída que a pessoa clicou.
// Vindo da home ou do painel da agenda, abria no primeiro mercado da lista —
// gols, normalmente — e o pick que ela tinha acabado de ler não estava mais na
// tela. A tela do jogo sempre soube ler `?mercado=&saida=&linha=`; só a
// Oportunidades sabia escrever.
// ============================================================================

const over25 = { market: 'goals_over_under', outcome: 'Over', line_value: 2.5 };

describe('hrefDoJogo', () => {
  it('é só a tela do jogo', () => {
    expect(hrefDoJogo(42)).toBe('/futebol/jogo/42');
  });
});

describe('hrefDaSaida', () => {
  it('carrega mercado, saída e linha', () => {
    expect(hrefDaSaida(42, over25)).toBe('/futebol/jogo/42?mercado=goals_over_under&saida=Over&linha=2.5');
  });

  it('omite a linha quando o mercado não tem linha', () => {
    // 1x2 não tem linha. Mandar `linha=null` faria a tela procurar uma saída
    // com linha nula literal e não achar nada.
    expect(hrefDaSaida(7, { market: 'match_winner', outcome: 'Home', line_value: null }))
      .toBe('/futebol/jogo/7?mercado=match_winner&saida=Home');
  });

  it('a linha zero é linha, e não ausência de linha', () => {
    // Handicap 0 existe e é diferente de "sem linha". Um `if (line_value)` o
    // apagaria — é o tipo de engano que só aparece num mercado específico.
    expect(hrefDaSaida(9, { market: 'asian_handicap', outcome: 'Home', line_value: 0 }))
      .toBe('/futebol/jogo/9?mercado=asian_handicap&saida=Home&linha=0');
  });

  it('a linha negativa sobrevive ao encode', () => {
    expect(hrefDaSaida(9, { market: 'asian_handicap', outcome: 'Away', line_value: -1.25 }))
      .toContain('linha=-1.25');
  });

  it('sem saída, devolve a tela do jogo sem filtro', () => {
    // O trilho da agenda mostra jogo, não oportunidade: pode não haver leitura
    // com preço. Melhor abrir a tela inteira que inventar um filtro.
    expect(hrefDaSaida(42)).toBe('/futebol/jogo/42');
    expect(hrefDaSaida(42, undefined)).toBe('/futebol/jogo/42');
  });

  it('saída sem mercado também não vira filtro pela metade', () => {
    // Alcançável de verdade: `oppFromAlerted` monta `OppLike` com `market:
    // a.market!`, e o `!` mente — o campo de origem é nulável ("null nas linhas
    // antigas sem pick estruturado"). A montagem anterior produzia
    // `mercado=null&saida=null` nesses casos.
    expect(hrefDaSaida(42, { market: null, outcome: null, line_value: null }))
      .toBe('/futebol/jogo/42');
  });
});

// ============================================================================
// A guarda de contrato entre quem escreve e quem lê
// ============================================================================
// A primeira versão desta guarda não guardava nada: ela repetia os literais
// `mercado`, `saida` e `linha` no próprio teste e lia de volta o que o módulo
// tinha acabado de escrever. Renomear na tela do jogo deixava tudo verde e o
// filtro morto — que é exatamente o defeito da #344, voltando pela porta dos
// fundos.
//
// O que amarra de verdade é `PARAMS_DA_SAIDA` ser a única fonte dos dois lados.
// Estes testes protegem esse acordo: um confere que a montagem usa a constante,
// o outro confere que a tela do jogo não voltou a cravar os nomes na mão.
// ============================================================================

describe('contrato dos parâmetros', () => {
  it('a montagem usa os nomes da constante, e não literais próprios', () => {
    const url = new URL(hrefDaSaida(42, over25), 'https://x');
    expect(url.searchParams.get(PARAMS_DA_SAIDA.mercado)).toBe('goals_over_under');
    expect(url.searchParams.get(PARAMS_DA_SAIDA.saida)).toBe('Over');
    expect(url.searchParams.get(PARAMS_DA_SAIDA.linha)).toBe('2.5');
  });

  it('a tela do jogo lê pela constante, não por literal', () => {
    // Guarda de arquivo, no mesmo espírito do shape-file: se alguém trocar
    // `params.get(PARAMS_DA_SAIDA.mercado)` por `params.get('mercado')`, o
    // acordo se desfaz em silêncio e a próxima renomeação quebra o filtro sem
    // quebrar teste nenhum.
    const tela = readFileSync(resolve(__dirname, '../pages/FutebolJogo.tsx'), 'utf8');

    for (const nome of Object.values(PARAMS_DA_SAIDA)) {
      expect(tela, `a tela lê "${nome}" por literal`).not.toContain(`params.get('${nome}')`);
    }
    expect(tela).toContain('PARAMS_DA_SAIDA');
  });
});
