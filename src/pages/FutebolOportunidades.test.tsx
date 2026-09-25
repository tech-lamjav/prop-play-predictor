import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import type { OppLike } from '@/utils/futebol-registradas';

// ============================================================================
// O valor saiu da tela (#519)
// ============================================================================
// A lista desenhava a vantagem sobre o preço justo em três lugares: o cabeçalho
// da tabela, a célula de cada linha e o trio do celular. Os três saíram — na
// grande maioria das oportunidades esse número é negativo, e um número negativo
// ao lado de um pick lê-se como contradição.
//
// O teste é de TELA, e de propósito: o dado continua chegando do banco e o corte
// de publicação continua usando-o. O que mudou é só o que se desenha.
//
// Esta página liga dezessete hooks, e nenhum deles decide se o valor é
// desenhado. Todos viram dublê, na mesma razão do teste da página do placar:
// montá-los aqui testaria o serviço inteiro por engano. O recorte do dia também
// é dublê — ele tem teste próprio, e reproduzi-lo aqui só adiaria a linha.
// ============================================================================

vi.mock('@posthog/react', () => ({ usePostHog: () => ({ capture: vi.fn() }) }));
vi.mock('@/components/AnalyticsNav', () => ({ default: () => <nav>header do site</nav> }));
vi.mock('@/components/onboarding/OnboardingTour', () => ({ default: () => null }));
vi.mock('@/components/futebol/RegistrarAposta', () => ({ RegistrarApostaCTA: () => null }));

const vazio = { data: undefined, isLoading: false };
const acesso = { unlocked: true, state: 'subscriber' };

vi.mock('@/hooks/use-futebol-data', () => ({
  useFutebolValueBoard: () => ({ data: [], isLoading: false }),
  useFutebolValueHistory: () => vazio,
  useFutebolAccess: () => ({ data: acesso }),
  useFutebolFixturesMulti: () => vazio,
  useFutebolAlertedPicks: () => vazio,
  useFutebolCompetitions: () => vazio,
  useFutebolPlacarFresco: () => vazio,
  useVitrine: () => ({ vitrine: [], limiares: [], ocultos: [], isLoading: false }),
}));

vi.mock('@/hooks/use-faixa-de-acesso', () => ({
  useFaixaDeAcesso: () => acesso,
  esquecerFaixaDeAcesso: vi.fn(),
}));

vi.mock('@/hooks/use-futebol-publication-alerts', () => ({
  useFutebolPublicationAlerts: () => ({
    data: undefined,
    acknowledgeOnboarding: () => Promise.resolve(),
    isAcknowledging: false,
  }),
}));

vi.mock('@/hooks/use-now', () => ({ useNow: () => Date.parse('2026-09-05T18:00:00Z') }));
vi.mock('@/hooks/use-dia-na-url', () => ({ useDiaNaUrl: () => ['2026-09-05', vi.fn()] }));

vi.mock('@/components/onboarding/useOnboardingTour', () => ({
  useOnboardingTour: () => ({ run: false, steps: [], stepIndex: 0, onCallback: vi.fn(), start: vi.fn() }),
}));

vi.mock('@/hooks/use-impressao-de-oportunidade', () => ({
  reiniciarImpressoes: vi.fn(),
  useImpressaoDeOportunidade: () => ({ current: null }),
}));

vi.mock('@/components/onboarding/demo/use-demo-futebol', () => ({
  useDemoFutebolBoard: () => [],
}));

/** Uma oportunidade com preço: é o estado em que o valor era desenhado. */
const linha = {
  fixture_id: 1,
  home_team_id: 10,
  away_team_id: 20,
  home_team_name: 'Palmeiras',
  away_team_name: 'Flamengo',
  competition: 'brasileirao',
  kickoff_utc: '2026-09-05T22:00:00Z',
  market: 'goals_over_under',
  outcome: 'Over',
  line_value: 2.5,
  best_odd: 1.95,
  prob_justa_fechamento: 0.55,
  edge: -0.014,
  score: 63,
  faixa: 'Alta',
} as unknown as OppLike;

vi.mock('@/utils/futebol-registradas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/futebol-registradas')>()),
  oportunidadesDoDia: () => [linha],
}));

const { default: FutebolOportunidades } = await import('./FutebolOportunidades');

function renderLista() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <FutebolOportunidades />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

// A tabela do desktop e os cartões do celular montam os DOIS no jsdom — quem
// esconde um é só o CSS. Por isso as contagens são plurais: elas cobrem os dois
// arranjos de uma vez, que é exatamente o que se quer aqui.
describe('FutebolOportunidades · o valor não é desenhado', () => {
  it('a tabela não tem coluna Valor, e mantém Chance e Odd', () => {
    const { container } = renderLista();

    // Escopado à LISTA de propósito: o seletor de Valor na barra de filtros
    // ainda existe e sai no #520. Afirmar sobre a tela inteira aqui faria este
    // teste cobrar de um ticket o que é dever do outro.
    const lista = container.querySelector('[data-tour="fut-opp-lista"]');
    expect(lista).not.toBeNull();
    const naLista = within(lista as HTMLElement);

    expect(naLista.getAllByText('Chance').length).toBeGreaterThan(0);
    expect(naLista.getAllByText('Odd').length).toBeGreaterThan(0);
    expect(naLista.queryAllByText('Valor')).toHaveLength(0);
  });

  it('a oportunidade continua na tela: esconder o número não esconde a linha', () => {
    renderLista();

    expect(screen.getAllByText(/Palmeiras/).length).toBeGreaterThan(0);
  });
});
