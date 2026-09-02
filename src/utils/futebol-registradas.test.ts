import { describe, expect, it } from 'vitest';
import { oportunidadesDoDia, oppFromAlerted, oppKey, type OppLike } from './futebol-registradas';
import type { FutebolAlertedPick, FutebolFixture } from '@/services/futebol-data.service';

function registrada(over: Partial<FutebolAlertedPick> = {}): FutebolAlertedPick {
  return {
    game_day: '2026-08-29',
    fixture_id: 1,
    market: 'match_winner',
    outcome: 'Home',
    line_value: null,
    bet_description: 'Coritiba vence',
    betting_market: 'Resultado',
    league: 'brasileirao-b',
    match_description: 'Coritiba × Palmeiras',
    odds: 2.1,
    janela_usada: 'manha',
    score: 62,
    faixa: 'alta',
    edge: 0.08,
    prob_justa_fechamento: 0.52,
    sent_at: '2026-08-29T11:00:00Z',
    ...over,
  };
}

function doBoard(over: Partial<OppLike> = {}): OppLike {
  return {
    fixture_id: 1,
    home_team_id: 10,
    away_team_id: 20,
    home_team_name: 'Coritiba',
    away_team_name: 'Palmeiras',
    competition: 'brasileirao-b',
    kickoff_utc: '2026-08-29T22:00:00Z',
    status_short: 'NS',
    market: 'match_winner',
    outcome: 'Home',
    line_value: null,
    best_odd: 2.1,
    best_book: 'bet365',
    avg_odd: 2.05,
    n_casas: 4,
    janela_usada: 'manha',
    pts_valor: 20,
    pts_premissas: 30,
    pts_corroboracao: 5,
    penalidades: 0,
    evidencias: [],
    premissas_sem_dado: 0,
    score: 62,
    faixa: 'alta',
    edge: 0.08,
    prob_justa_fechamento: 0.52,
    ...over,
  };
}

const semFixtures = new Map<number, FutebolFixture>();

describe('oportunidadesDoDia', () => {
  it('soma a registrada que o board não tem mais', () => {
    // O bug que originou este módulo: num sábado de seis oportunidades a home
    // mostrava três, porque só a outra tela somava as registradas.
    const lista = oportunidadesDoDia({
      doBoard: [doBoard()],
      registradas: [registrada({ fixture_id: 2, match_description: 'Sport × Goiás' })],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(2);
    expect(lista[1].home_team_name).toBe('Sport');
  });

  it('não duplica a oportunidade que já está no board', () => {
    const lista = oportunidadesDoDia({
      doBoard: [doBoard()],
      registradas: [registrada()],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(1);
  });

  it('a mesma partida com outra aposta entra como linha própria', () => {
    // A chave é jogo + mercado + saída + linha: dois palpites no mesmo jogo são
    // duas oportunidades, e colapsá-los esconderia uma.
    const lista = oportunidadesDoDia({
      doBoard: [doBoard()],
      registradas: [registrada({ market: 'over_under', outcome: 'Over', line_value: 2.5 })],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(2);
  });

  it('registrada de outro dia fica de fora', () => {
    const lista = oportunidadesDoDia({
      doBoard: [],
      registradas: [registrada({ game_day: '2026-08-28' })],
      dia: '2026-08-29',
      fixturePorId: semFixtures,
    });

    expect(lista).toHaveLength(0);
  });

  it('com o jogo casado, usa os nomes e o horário do fixture', () => {
    const fx = {
      fixture_id: 7,
      home_team_id: 33,
      away_team_id: 44,
      home_team_name: 'Athletico-PR',
      away_team_name: 'Vila Nova',
      kickoff_utc: '2026-08-29T19:30:00Z',
      status_short: 'FT',
    } as FutebolFixture;

    const linha = oppFromAlerted(registrada({ fixture_id: 7, match_description: 'CAP × VIL' }), fx);

    expect(linha.home_team_name).toBe('Athletico-PR');
    expect(linha.kickoff_utc).toBe('2026-08-29T19:30:00Z');
    expect(linha.status_short).toBe('FT');
  });

  it('sem jogo casado, mantém a oportunidade com os nomes do registro', () => {
    // Perder o escudo é aceitável; perder a oportunidade da lista não é.
    const linha = oppFromAlerted(registrada({ match_description: 'Ceará × Bahia' }));

    expect(linha.home_team_name).toBe('Ceará');
    expect(linha.away_team_name).toBe('Bahia');
    expect(linha.kickoff_utc).toBeNull();
  });

  it('a registrada não declara versão de escala', () => {
    // Carimbá-la de legacy faria a legenda achar que toda janela é mista.
    expect(oppFromAlerted(registrada()).score_versao).toBeUndefined();
  });

  it('a chave ignora campos que não identificam a aposta', () => {
    expect(oppKey(1, 'over_under', 'Over', 2.5)).toBe(oppKey(1, 'over_under', 'Over', 2.5));
    expect(oppKey(1, 'over_under', 'Over', 2.5)).not.toBe(oppKey(1, 'over_under', 'Over', 3.5));
  });
});
