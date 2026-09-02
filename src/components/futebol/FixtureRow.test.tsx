import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FixtureRow } from './FixtureRow';
import type { FutebolFixture } from '@/services/futebol-data.service';

// ============================================================================
// Os três estados da leitura na linha da agenda
// ============================================================================
// Mesma regra da faixa do detalhe: "sem leitura ainda" é uma CONCLUSÃO, e só
// cabe depois que o board respondeu. Enquanto ele está em voo a linha mostra o
// esqueleto, senão a agenda afirma um vazio que ainda não sabe se é verdade.
//
// Regra para quem mexer aqui depois (issue #310): nenhum teste deste arquivo
// afirma número de Score, peso de premissa ou slug — só distingue os estados.
// ============================================================================

const jogo = {
  fixture_id: 1,
  home_team_id: 10,
  away_team_id: 20,
  home_team_name: 'Londrina',
  away_team_name: 'Juventude',
  kickoff_utc: '2026-09-01T22:30:00Z',
  status_short: 'NS',
  goals_home: null,
  goals_away: null,
} as unknown as FutebolFixture;

function renderLinha(props: Partial<Parameters<typeof FixtureRow>[0]> = {}) {
  return render(
    <FixtureRow fixture={jogo} best={null} leituraCarregando={false} onClick={vi.fn()} {...props} />,
  );
}

describe('FixtureRow · estado da leitura', () => {
  it('mostra o esqueleto, e não a conclusão, enquanto o board carrega', () => {
    renderLinha({ leituraCarregando: true });

    expect(screen.getByTestId('linha-leitura-carregando')).toBeInTheDocument();
    expect(screen.queryByText(/sem leitura/i)).not.toBeInTheDocument();
  });

  it('o jogo aparece na hora, sem esperar a leitura', () => {
    renderLinha({ leituraCarregando: true });

    expect(screen.getByText('Londrina')).toBeInTheDocument();
    expect(screen.getByText('Juventude')).toBeInTheDocument();
  });

  it('o selo do Score não mostra o traço de "não tem" enquanto carrega', () => {
    // O travessão é a mesma conclusão em forma de símbolo: ele diz que não há
    // Score. Enquanto o board não respondeu, não há o que afirmar.
    renderLinha({ leituraCarregando: true });

    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.getByTestId('linha-selo-carregando')).toBeInTheDocument();
  });

  it('só conclui "sem leitura ainda" depois que o board respondeu', () => {
    renderLinha({ leituraCarregando: false, best: null });

    expect(screen.queryByTestId('linha-leitura-carregando')).not.toBeInTheDocument();
    expect(screen.getAllByText(/sem leitura/i).length).toBeGreaterThan(0);
  });
});
