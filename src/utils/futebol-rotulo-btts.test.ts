import { describe, expect, it } from 'vitest';
import { pickLabel } from './futebol-score';
import { outcomeLabel } from './futebol-premissas';
import { publishedPickLabel } from '../../supabase/functions/notify-published-opportunities/message.ts';

// ============================================================================
// O "Ambos marcam" se escreve de um jeito só
// ============================================================================
// Este mercado tem TRÊS rótulos no produto, em dois runtimes: o da agenda e dos
// cards (`pickLabel`), o da bancada de mercados (`outcomeLabel`) e o da DM do
// Telegram (`publishedPickLabel`, que roda em Deno). Eles já divergiram — o
// painel dizia "Os dois marcam" enquanto a DM dizia "Ambos marcam: Sim" —, e
// ninguém vê, porque tela e DM são lidas por pessoas diferentes em momentos
// diferentes. É a mesma fronteira que a guarda da vitrine cobre.
//
// O nome é o DA CASA DE APOSTAS, e não uma descrição do que acontece em campo:
// quem aposta procura "Ambos marcam" na casa. A descrição mais precisa é menos
// reconhecível, e reconhecível ganha num rótulo de aposta.
//
// ⚠️ O rótulo do "Não" é o que erra sozinho. "Não marcam os dois" e "Os dois
// não marcam" descrevem o 0 a 0, que é OUTRA aposta: BTTS No cobre o 1 a 0
// também. Já esteve escrito assim.
// ============================================================================

const SAIDA = { home: 'Casa', away: 'Fora', line_value: null };

describe('rótulo do Ambos marcam', () => {
  it('as três telas dizem a mesma coisa no Sim', () => {
    const s = { market: 'btts', outcome: 'Yes', line_value: null };
    expect(pickLabel(s, SAIDA.home, SAIDA.away)).toBe('Ambos marcam: Sim');
    expect(outcomeLabel(s, SAIDA.home, SAIDA.away)).toBe('Ambos marcam: Sim');
    expect(
      publishedPickLabel({
        market: 'btts',
        outcome: 'Yes',
        line_value: null,
        home_team_name: SAIDA.home,
        away_team_name: SAIDA.away,
      }),
    ).toBe('Ambos marcam: Sim');
  });

  it('as três telas dizem a mesma coisa no Não', () => {
    const s = { market: 'btts', outcome: 'No', line_value: null };
    expect(pickLabel(s, SAIDA.home, SAIDA.away)).toBe('Ambos marcam: Não');
    expect(outcomeLabel(s, SAIDA.home, SAIDA.away)).toBe('Ambos marcam: Não');
    expect(
      publishedPickLabel({
        market: 'btts',
        outcome: 'No',
        line_value: null,
        home_team_name: SAIDA.home,
        away_team_name: SAIDA.away,
      }),
    ).toBe('Ambos marcam: Não');
  });

  it('o rótulo se basta sem o nome do mercado ao lado', () => {
    // Na agenda a linha é "Casa × Fora — <rótulo>", sem mercado. Um rótulo que
    // fosse só "Sim" não seria aposta nenhuma, e foi assim que já esteve.
    const s = { market: 'btts', outcome: 'Yes', line_value: null };
    expect(pickLabel(s, SAIDA.home, SAIDA.away)).toContain('Ambos marcam');
  });
});
