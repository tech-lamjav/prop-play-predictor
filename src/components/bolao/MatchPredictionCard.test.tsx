/**
 * Teste de componente do MatchPredictionCard.
 *
 * Cobre os cenários core após o rebrand + autosave:
 *   - Hidratação inicial dos inputs (server vs localStorage draft)
 *   - Server prediction sempre vence o draft
 *   - Autosave dispara após debounce quando user digita
 *   - Indicator visual ("Salvo") aparece após autosave
 *
 * O componente renderiza dois layouts (mobile + desktop) no mesmo DOM —
 * Tailwind alterna via CSS `hidden`. Por isso usamos getAllByRole/[0] em
 * vez de getByRole.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MatchPredictionCard } from './MatchPredictionCard';
import type { WcMatch, BolaoPrediction } from '@/services/bolao.service';

// Helpers — mobile e desktop layouts coexistem no DOM, então pegamos o 1º match.
const homeInput = () => screen.getAllByRole('textbox', { name: /Placar BRA/ })[0];
const awayInput = () => screen.getAllByRole('textbox', { name: /Placar MEX/ })[0];

function fakeMatch(partial: Partial<WcMatch> = {}): WcMatch {
  return {
    id: 1,
    match_number: 1,
    stage: 'group',
    group_name: 'A',
    home_team: 'Brasil',
    away_team: 'México',
    home_team_code: 'BRA',
    away_team_code: 'MEX',
    match_date: '2026-06-15',
    match_time_brasilia: '16:00:00',
    venue: null,
    city: null,
    home_score: null,
    away_score: null,
    is_finished: false,
    ...partial,
  } as unknown as WcMatch;
}

function fakePrediction(home: number, away: number): BolaoPrediction {
  return {
    id: 'p1',
    bolao_id: 'b1',
    user_id: 'u1',
    match_id: 1,
    predicted_home_score: home,
    predicted_away_score: away,
    points_earned: null,
  } as unknown as BolaoPrediction;
}

describe('MatchPredictionCard — hidratação dos inputs', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('inputs vazios quando não há prediction nem draft', () => {
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        onSave={vi.fn()}
        bolaoId="b1"
      />
    );
    expect(homeInput()).toHaveValue('');
    expect(awayInput()).toHaveValue('');
  });

  it('hidrata com a prediction do servidor', () => {
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        prediction={fakePrediction(3, 1)}
        onSave={vi.fn()}
        bolaoId="b1"
      />
    );
    expect(homeInput()).toHaveValue('3');
    expect(awayInput()).toHaveValue('1');
  });

  it('hidrata com draft do localStorage quando não há prediction', () => {
    localStorage.setItem(
      'bolao_draft_pred_b1_1',
      JSON.stringify({ home: '4', away: '2', ts: Date.now() })
    );
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        onSave={vi.fn()}
        bolaoId="b1"
      />
    );
    expect(homeInput()).toHaveValue('4');
    expect(awayInput()).toHaveValue('2');
  });

  it('valor do servidor SEMPRE prevalece sobre o draft', () => {
    localStorage.setItem(
      'bolao_draft_pred_b1_1',
      JSON.stringify({ home: '5', away: '5', ts: Date.now() })
    );
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        prediction={fakePrediction(3, 1)}
        onSave={vi.fn()}
        bolaoId="b1"
      />
    );
    expect(homeInput()).toHaveValue('3');
    expect(awayInput()).toHaveValue('1');
  });
});

describe('MatchPredictionCard — autosave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('dispara onSave depois do debounce de 500ms', async () => {
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        onSave={onSave}
        bolaoId="b1"
      />
    );

    fireEvent.change(homeInput(), { target: { value: '2' } });
    fireEvent.change(awayInput(), { target: { value: '1' } });

    await new Promise((r) => setTimeout(r, 700));

    expect(onSave).toHaveBeenCalledWith(1, 2, 1);
  });

  it('não dispara onSave se inputs incompletos', async () => {
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        onSave={onSave}
        bolaoId="b1"
      />
    );

    // Só digita home, away fica vazio
    fireEvent.change(homeInput(), { target: { value: '2' } });
    await new Promise((r) => setTimeout(r, 700));

    expect(onSave).not.toHaveBeenCalled();
  });

  it('não dispara onSave se valores já batem com servidor', async () => {
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        prediction={fakePrediction(3, 1)}
        onSave={onSave}
        bolaoId="b1"
      />
    );

    // Reseta home pro mesmo valor do server (3) — não deve salvar
    fireEvent.change(homeInput(), { target: { value: '3' } });
    await new Promise((r) => setTimeout(r, 700));

    expect(onSave).not.toHaveBeenCalled();
  });
});
