import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import type { OppLike } from '@/utils/futebol-registradas';

// ============================================================================
// O valor saiu da tela (#519)
// ============================================================================
// A home desenhava a vantagem sobre o preço justo em dois lugares — o destaque
// do dia e o cartão de cada oportunidade — e nos dois a frase do "por quê"
// mudava de texto conforme o SINAL dela.
//
// Tudo isso saiu. Na grande maioria das oportunidades o número é negativo, e um
// número negativo ao lado de um pick lê-se como contradição; a frase que
// dependia do sinal, por tabela, também perdeu o objeto.
//
// O teste é de TELA, e de propósito: o dado continua chegando do banco e o
// corte de publicação continua usando-o. O que mudou é só o que se desenha.
//
// Os hooks viram dublê, como no teste da página do placar: nenhum deles decide
// se o valor é desenhado, e montá-los aqui testaria o serviço por engano.
// ============================================================================

vi.mock('@/components/AnalyticsNav', () => ({ default: () => <nav>header do site</nav> }));
vi.mock('@/components/onboarding/OnboardingTour', () => ({ default: () => null }));

const lista = { data: [], isLoading: false };
const vazio = { data: undefined, isLoading: false };
const acesso = { unlocked: true, state: 'subscriber' };

/** O acesso é mutável porque a frase do portão só existe no estado travado. */
const estado = vi.hoisted(() => ({ liberado: true, temLinha: true }));
const acessoAtual = () => (estado.liberado ? acesso : { unlocked: false, state: 'anonymous' });

vi.mock('@/hooks/use-futebol-data', () => ({
  useFutebolValueBoard: () => lista,
  useFutebolValueHistory: () => lista,
  useFutebolAccess: () => ({ data: acessoAtual() }),
  useFutebolFixturesMulti: () => lista,
  useFutebolAlertedPicks: () => lista,
  useFutebolCompetitions: () => vazio,
  useFutebolFixtureReasonContract: () => vazio,
  // Este devolve a LISTA direto, e não o envelope `{ data }` dos outros.
  useJogosComPlacarFresco: (jogos: unknown[] | undefined) => jogos ?? [],
  useVitrine: () => ({ vitrine: [], limiares: [], ocultos: [], isLoading: false }),
}));

vi.mock('@/hooks/use-faixa-de-acesso', () => ({
  useFaixaDeAcesso: () => acessoAtual(),
  esquecerFaixaDeAcesso: vi.fn(),
}));

vi.mock('@/hooks/use-now', () => ({ useNow: () => Date.parse('2026-09-05T18:00:00Z') }));
vi.mock('@/hooks/use-dia-na-url', () => ({
  useDiaNaUrl: () => ['2026-09-05', vi.fn()],
  comDia: (href: string) => href,
}));

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

/**
 * Uma oportunidade com VANTAGEM NEGATIVA — que é o caso comum, e o motivo do
 * trabalho. Era esta linha que fazia a home escrever "o preço fica 1,4% abaixo
 * do justo" logo abaixo de um pick que ela mesma recomenda.
 */
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
  evidencias: [],
  avisos: [],
  contras: [],
} as unknown as OppLike;

vi.mock('@/utils/futebol-registradas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/futebol-registradas')>()),
  oportunidadesDoDia: () => (estado.temLinha ? [linha] : []),
}));

const { default: FutebolHoje } = await import('./FutebolHoje');

function renderHome() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <FutebolHoje />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('FutebolHoje · o valor não é desenhado', () => {
  it('o destaque e os cartões mostram chance e odd, e não mostram valor', () => {
    renderHome();

    expect(screen.getAllByText('Chance').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Odd').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Valor')).toHaveLength(0);
  });

  it('nenhuma frase da home mede o preço contra o justo', () => {
    renderHome();

    expect(screen.queryByText(/abaixo do justo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/é aí que está o valor/i)).not.toBeInTheDocument();
  });

  it('a oportunidade continua na tela: esconder o número não esconde a linha', () => {
    renderHome();

    expect(screen.getAllByText(/Palmeiras/).length).toBeGreaterThan(0);
  });

  it('sem acesso, a frase do portão não lista o valor entre o que é de assinante', () => {
    // Esta frase só existe no estado TRAVADO, que nenhum dos testes acima
    // alcança.
    estado.liberado = false;
    try {
      renderHome();

      expect(screen.getByText(/A aposta, a odd, a chance e o Score são de assinante/i)).toBeInTheDocument();
    } finally {
      estado.liberado = true;
    }
  });

  it('o dia vazio é explicado pela régua, e não pelo preço', () => {
    // O estado vazio dizia "Sem valor claro hoje" e culpava a odd. Quem esvazia
    // esta tela é o Score, e o preço nem aparece mais — explicar por ele seria
    // explicar pelo invisível. Só existe com ZERO linhas, que é o estado que
    // nenhum dos outros testes monta.
    estado.temLinha = false;
    try {
      renderHome();

      expect(screen.getByText(/Nenhuma leitura em destaque/i)).toBeInTheDocument();
      expect(screen.queryByText(/sem valor claro/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/linha justa do mercado/i)).not.toBeInTheDocument();
    } finally {
      estado.temLinha = true;
    }
  });

  it('nenhuma frase da home fala em valor', () => {
    // Cobre a tela INTEIRA, incluindo o rodapé e o KPI — os dois falavam de
    // valor e os dois saíram. Vale a pena ser ampla: é a asserção que pega o
    // texto esquecido num canto, que foi exatamente como o rodapé escapou da
    // primeira passada.
    renderHome();

    expect(screen.queryAllByText(/\bvalor\b/i)).toHaveLength(0);
  });
});
