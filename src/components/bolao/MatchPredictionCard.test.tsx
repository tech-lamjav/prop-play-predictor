/**
 * Teste de componente do MatchPredictionCard.
 *
 * Cobre o bug do "Bloco A teste 2" da Onda 2:
 * "Edição muda rascunho" — quando o usuário edita um palpite JÁ SALVO,
 * o badge 'Rascunho' deve reaparecer (porque diverge do servidor).
 *
 * Versão original do componente travava o `hasDraft` no mount inicial e
 * não reagia a edições. Esses testes garantem que o comportamento correto
 * seja mantido.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchPredictionCard } from './MatchPredictionCard';
import type { WcMatch, BolaoPrediction } from '@/services/bolao.service';

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
    match_date: '2026-06-15', // futuro — sempre destravado nos testes
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

describe('MatchPredictionCard — badge "Rascunho"', () => {
  beforeEach(() => {
    localStorage.clear();
    // Trava o tempo num momento bem antes do kickoff (15/jun) pra evitar lock
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
  });

  it('NÃO mostra "Rascunho" inicialmente em jogo sem palpite (campos vazios)', () => {
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        onSave={onSave}
        bolaoId="b1"
      />
    );
    expect(screen.queryByText('Rascunho')).not.toBeInTheDocument();
  });

  it('mostra "Rascunho" quando o user digita em jogo SEM palpite', async () => {
    vi.useRealTimers(); // userEvent precisa do real timer
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        onSave={onSave}
        bolaoId="b1"
      />
    );

    const homeInput = screen.getByRole('textbox', { name: /Placar BRA/ });
    await user.type(homeInput, '2');

    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('NÃO mostra "Rascunho" quando os valores BATEM com o servidor', () => {
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        prediction={fakePrediction(3, 1)}
        onSave={onSave}
        bolaoId="b1"
      />
    );
    expect(screen.queryByText('Rascunho')).not.toBeInTheDocument();
  });

  // ESTE é o teste que pega o bug que o usuário reportou:
  it('mostra "Rascunho" quando user edita palpite JÁ SALVO pra divergir do servidor', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        prediction={fakePrediction(3, 1)} // server: 3 x 1
        onSave={onSave}
        bolaoId="b1"
      />
    );

    // Inicialmente sem badge (matches server)
    expect(screen.queryByText('Rascunho')).not.toBeInTheDocument();

    // User edita o home pra 5 → diverge do server
    const homeInput = screen.getByRole('textbox', { name: /Placar BRA/ });
    await user.clear(homeInput);
    await user.type(homeInput, '5');

    // Badge deve reaparecer
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('volta a esconder "Rascunho" quando user reverte os valores pro server', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MatchPredictionCard
        match={fakeMatch()}
        prediction={fakePrediction(3, 1)}
        onSave={onSave}
        bolaoId="b1"
      />
    );

    const homeInput = screen.getByRole('textbox', { name: /Placar BRA/ });

    // Edita pra 5 → badge aparece
    await user.clear(homeInput);
    await user.type(homeInput, '5');
    expect(screen.getByText('Rascunho')).toBeInTheDocument();

    // Volta pra 3 → badge some
    await user.clear(homeInput);
    await user.type(homeInput, '3');
    expect(screen.queryByText('Rascunho')).not.toBeInTheDocument();
  });
});

describe('MatchPredictionCard — restauração de rascunho', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T10:00:00Z'));
  });

  it('hidrata os inputs com o rascunho salvo no localStorage', () => {
    // Simula que o user já tinha digitado algo numa sessão anterior
    localStorage.setItem(
      'bolao_draft_pred_b1_1',
      JSON.stringify({ home: '4', away: '2', ts: Date.now() })
    );

    render(
      <MatchPredictionCard
        match={fakeMatch()}
        // sem `prediction` → não há palpite no servidor
        onSave={vi.fn()}
        bolaoId="b1"
      />
    );

    expect(screen.getByRole('textbox', { name: /Placar BRA/ })).toHaveValue('4');
    expect(screen.getByRole('textbox', { name: /Placar MEX/ })).toHaveValue('2');
    // Como diverge do "vazio" do server, badge "Rascunho" aparece
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('valor do servidor SEMPRE prevalece sobre o rascunho', () => {
    // Servidor diz 3 x 1. Mesmo que tenha rascunho 5 x 5, mostra o do server.
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

    expect(screen.getByRole('textbox', { name: /Placar BRA/ })).toHaveValue('3');
    expect(screen.getByRole('textbox', { name: /Placar MEX/ })).toHaveValue('1');
    expect(screen.queryByText('Rascunho')).not.toBeInTheDocument();
  });
});
