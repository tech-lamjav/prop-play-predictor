import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { FutebolFixtureByDay, FutebolValueBoardRow } from '@/services/futebol-data.service';

// ============================================================================
// O valor saiu da tela (#519)
// ============================================================================
// Este painel foi, um dia, o FURO da camada paga: chance, odd e vantagem
// apareciam limpas aqui enquanto as mesmas três estavam fechadas nas outras
// telas. O comentário no componente conta essa história.
//
// Agora a vantagem sobre o preço justo não é desenhada para NINGUÉM, assinante
// incluído — na grande maioria das oportunidades ela é negativa, e um número
// negativo ao lado de um pick lê-se como contradição.
//
// O teste é de TELA, e de propósito: o dado continua chegando do banco e o
// corte de publicação continua usando-o. O que mudou é só o que se desenha.
//
// Os hooks do painel viram dublês: ele faz nove consultas, e nenhuma delas
// decide se o valor é desenhado. Montá-las aqui testaria o serviço por engano.
// ============================================================================

const vazio = { data: undefined, isLoading: false };

vi.mock('@/hooks/use-futebol-data', () => ({
  useFutebolFixturePremissas: () => vazio,
  useFutebolFixtureNumeros: () => vazio,
  useFutebolFixtureInjuries: () => vazio,
  useFutebolFixtureHistorico: () => vazio,
  useFutebolFixtureReasonContract: () => vazio,
  useFutebolFixtureCortadas: () => ({ data: [], isLoading: false }),
  useFutebolFixtureInsumos: () => vazio,
  useVitrine: () => ({ vitrine: [], ocultos: [], isLoading: false }),
  useFutebolAccess: () => ({ data: { unlocked: true } }),
}));

// O CTA de registrar aposta tem consulta própria e não decide nada aqui.
vi.mock('./RegistrarAposta', () => ({ RegistrarApostaCTA: () => null }));

vi.mock('@/lib/analytics', () => ({
  analiseAberta: vi.fn(),
  propsDaOportunidade: () => ({}),
}));

const { JogoResumoPanel } = await import('./JogoResumoPanel');

const jogo = {
  fixture_id: 1,
  home_team_id: 10,
  away_team_id: 20,
  home_team_name: 'Palmeiras',
  away_team_name: 'Flamengo',
  competition: 'brasileirao',
  kickoff_utc: '2026-09-05T22:00:00Z',
  day_brt: '2026-09-05',
  status_short: 'NS',
  goals_home: null,
  goals_away: null,
} as unknown as FutebolFixtureByDay;

/** Uma leitura com preço coletado: é o estado em que o valor era desenhado. */
const leitura = {
  market: 'goals_over_under',
  outcome: 'Over',
  line_value: 2.5,
  best_odd: 1.95,
  prob_justa_fechamento: 0.55,
  edge: -0.014,
  score: 63,
  faixa: 'Alta',
} as unknown as FutebolValueBoardRow;

function renderPainel(best: FutebolValueBoardRow | null = leitura) {
  return render(
    <MemoryRouter>
      <JogoResumoPanel fixture={jogo} best={best} leituraCarregando={false} onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('JogoResumoPanel · o valor não é desenhado', () => {
  it('com leitura, o painel mostra chance e odd, e não mostra valor', () => {
    renderPainel();

    expect(screen.getByText('Chance')).toBeInTheDocument();
    expect(screen.getByText('Odd')).toBeInTheDocument();
    expect(screen.queryByText('Valor')).not.toBeInTheDocument();
  });

  it('nenhuma frase do painel promete valor', () => {
    renderPainel();

    expect(screen.queryByText(/valor/i)).not.toBeInTheDocument();
  });
});
