import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FutebolFixtureValueRow } from '@/services/futebol-data.service';
import type { JogoInfo } from './jogo-info';

// ============================================================================
// O valor saiu da tela (#519)
// ============================================================================
// A bancada desenhava a vantagem sobre o preço justo em DOIS arranjos — a
// tabelinha do celular e a linha do desktop —, e os dois saíram. Na grande
// maioria das oportunidades esse número é negativo, e um número negativo ao
// lado de um pick lê-se como contradição.
//
// O teste é de TELA, e de propósito: o dado continua chegando e o corte de
// publicação continua usando-o. O que mudou é só o que se desenha.
//
// O arranjo é fixado por teste, e não deixado ao jsdom: são dois desenhos
// diferentes, e sem fixar a largura só um deles seria coberto.
// ============================================================================

const ehMobile = vi.fn(() => false);
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => ehMobile() }));

const vazio = { data: undefined, isLoading: false };

vi.mock('@/hooks/use-futebol-data', () => ({
  useFutebolFixturePremissas: () => vazio,
  useFutebolFixtureNumeros: () => vazio,
  useFutebolFixtureHistorico: () => vazio,
  useFutebolFixtureInsumos: () => vazio,
  useFutebolFixtureInjuries: () => vazio,
  useFutebolFixtureOdds: () => vazio,
  useFutebolFixtureReasonContract: () => vazio,
  useFutebolFixtureDisponibilidade: () => vazio,
  useFutebolAccess: () => ({ data: { unlocked: true } }),
  useVitrine: () => ({ vitrine: [], ocultos: [], isLoading: false }),
}));

vi.mock('@/hooks/use-guarda-de-divergencia', () => ({
  useGuardaDeDivergencia: () => undefined,
}));

// O CTA de registrar aposta tem consulta própria e não decide nada aqui.
vi.mock('@/components/futebol/RegistrarAposta', () => ({ RegistrarApostaCTA: () => null }));

vi.mock('@/lib/analytics', () => ({
  motivosExpandidos: vi.fn(),
  propsDaOportunidade: () => ({}),
}));

const { BancadaMercados } = await import('./BancadaMercados');

const jogo: JogoInfo = {
  fixtureId: 1,
  home: 'Palmeiras',
  away: 'Flamengo',
  competition: 'brasileirao',
  season: 2026,
  kickoffUtc: '2026-09-05T22:00:00Z',
  statusShort: 'NS',
  goalsHome: null,
  goalsAway: null,
};

/** Uma linha com preço coletado: é o estado em que o valor era desenhado. */
const comPreco = [
  {
    market: 'goals_over_under',
    outcome: 'Over',
    outcome_order: 1,
    line_value: 2.5,
    edge: -0.014,
    best_odd: 1.95,
    prob_justa_fechamento: 0.55,
    score: 63,
    faixa: 'Alta',
    evidencias: [],
    avisos: [],
    contras: [],
  },
] as unknown as FutebolFixtureValueRow[];

function renderBancada(locked = false) {
  return render(
    <BancadaMercados
      jogo={jogo}
      valueRows={comPreco}
      cortadas={[]}
      locked={locked}
      mercadoAtivo="goals_over_under"
      onMercado={vi.fn()}
    />,
  );
}

describe('BancadaMercados · o valor não é desenhado', () => {
  it('no desktop, a bancada mostra chance e odd, e não mostra valor', () => {
    ehMobile.mockReturnValue(false);
    renderBancada();

    expect(screen.getAllByText('Chance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Odd').length).toBeGreaterThan(0);
    expect(screen.queryByText('Valor')).not.toBeInTheDocument();
  });

  it('no celular, a tabelinha também não tem valor', () => {
    ehMobile.mockReturnValue(true);
    renderBancada();

    expect(screen.getAllByText('Chance').length).toBeGreaterThan(0);
    expect(screen.queryByText('Valor')).not.toBeInTheDocument();
  });

  it('sem acesso, a frase do portão não lista o valor entre o que é de assinante', () => {
    // Esta frase só existe no estado TRAVADO, e é por isso que ela tem teste
    // próprio: os dois acima rodam destravados e nunca a alcançariam.
    ehMobile.mockReturnValue(false);
    renderBancada(true);

    expect(screen.getByText(/a aposta, a odd, a chance, o Score e as premissas/i)).toBeInTheDocument();
    expect(screen.queryByText(/o valor/i)).not.toBeInTheDocument();
  });
});
