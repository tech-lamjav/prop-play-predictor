import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Placar } from './Placar';
import type { LinhaPublicada } from './placar-agregacao';

// O painel tem dois arranjos e o hook decide qual. Fixá-lo por teste é o que
// permite cobrir o celular sem depender da largura que o jsdom inventa — o
// mesmo caminho que a FaixaPartida já usava.
const ehCelular = vi.fn(() => true);
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => ehCelular() }));

// ============================================================================
// O placar num aparelho pequeno
// ============================================================================
// O que se prova aqui não é aparência, é que a leitura cabe na largura. A
// primeira versão para celular manteve a matriz e prendeu a coluna do grupo; na
// tela de verdade a tabela empurrava a página para o lado, e o título e o
// cabeçalho ficavam para trás. A regra agora é que no celular NÃO existe tabela:
// cada grupo é um cartão, o tempo corre para baixo dentro da ficha, e as
// quebras aparecem uma por vez.
// ============================================================================

const PERIODO = { de: '2026-09-04', ate: '2026-09-16' };

const BASE = {
  periodo: PERIODO,
  eixo: 'jogo' as const,
  granularidade: 'semana' as const,
  aoMudarGranularidade: () => {},
  gaveta: null,
  aoAbrirGaveta: () => {},
  aoFecharGaveta: () => {},
};

const linha = (p: Partial<LinhaPublicada> = {}): LinhaPublicada => ({
  opportunity_key: Math.random().toString(36).slice(2),
  fixture_id: 1,
  competition: 'Brasileirão',
  home_team_name: 'Casa',
  away_team_name: 'Fora',
  kickoff_utc: '2026-09-10T23:00:00',
  status_short: 'FT',
  goals_home: 2,
  goals_away: 0,
  detectada_em: '2026-09-10T03:00:00',
  market: 'match_winner',
  outcome: 'Home',
  line_value: null,
  best_odd: 2,
  edge: 1,
  score: 65,
  faixa: 'Alta',
  score_versao: 'contexto_v1',
  pts_premissas: 20,
  penalidades: 0,
  premissas_sem_dado: 0,
  modelo_api_concorda: true,
  linha_sharp_confirma: false,
  pen_odd_outlier: false,
  pen_poucas_casas: false,
  pen_odd_longshot: false,
  pen_odd_juice: false,
  premissas_acesas: [],
  ...p,
});

/** Gols acima de 1,5 num 2–0: Over ganha, Under perde. */
const gols = (p: Partial<LinhaPublicada> = {}) =>
  linha({ market: 'goals_over_under', outcome: 'Over', line_value: 1.5, ...p });

/** O cartão de Gols. O nome inclui a base, que o distingue do chip de mercado do gráfico. */
const cartaoDeGols = () => screen.getByRole('button', { name: /^gols \(mais ou menos\).*apostas?/i });

describe('o topo no celular', () => {
  it('abre pelo ROI, e o que é contexto vira uma linha', () => {
    render(<Placar {...BASE} publicadas={[gols(), gols({ outcome: 'Under' })]} />);

    expect(screen.getByText('ROI do período')).toBeInTheDocument();
    expect(
      screen.getByText(/2 publicadas · 2 liquidadas · 0 pendentes · 0 anuladas/),
    ).toBeInTheDocument();
  });
});

describe('as quebras no celular', () => {
  it('não existe tabela nenhuma na tela: é ela que saía pela lateral', () => {
    const { container } = render(
      <Placar {...BASE} publicadas={[gols({ score: 85 }), gols({ outcome: 'Under', score: 20 })]} />,
    );
    expect(container.querySelector('table')).toBeNull();
  });

  it('uma quebra por vez, trocada pelo seletor', async () => {
    render(<Placar {...BASE} publicadas={[gols({ competition: 'Série B' })]} />);

    // Abre em mercado: o campeonato ainda não está na tela.
    expect(screen.queryByRole('button', { name: /^série b/i })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Campeonato' }));
    expect(screen.getByRole('button', { name: /^série b/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^gols \(mais ou menos\).*apostas?/i })).toBeNull();
  });

  it('cada grupo é um cartão com o total e a tirinha do tempo, em ordem de calendário', () => {
    render(
      <Placar
        {...BASE}
        publicadas={[
          gols({ kickoff_utc: '2026-09-08T23:00:00' }),
          gols({ kickoff_utc: '2026-09-15T23:00:00', outcome: 'Under' }),
        ]}
      />,
    );

    const tirinha = cartaoDeGols().querySelector('[role="img"]');
    // Duas semanas, a que começa em 07/09 e a que começa em 14/09, nessa ordem.
    expect(tirinha?.getAttribute('aria-label')).toMatch(/^ROI por semana: 07\/09 .*, 14\/09 /);
  });
});

describe('a ficha da linha', () => {
  const duasSemanas = () => [
    gols({ kickoff_utc: '2026-09-08T23:00:00', home_team_name: 'Ganhou' }),
    gols({ kickoff_utc: '2026-09-15T23:00:00', home_team_name: 'Perdeu', outcome: 'Under' }),
  ];

  it('tocar no cartão abre a ficha, com o tempo correndo para baixo e o mais recente primeiro', async () => {
    render(<Placar {...BASE} publicadas={duasSemanas()} />);
    await userEvent.click(cartaoDeGols());

    const ficha = await screen.findByRole('dialog');
    expect(ficha).toHaveTextContent('Semana a semana');

    const semanas = within(ficha).getAllByRole('button', { name: /^\d{2}\/\d{2}/ });
    expect(semanas[0]).toHaveTextContent('14/09');
    expect(semanas[1]).toHaveTextContent('07/09');
  });

  it('e a semana abre as apostas dela, e só as dela', async () => {
    render(<Placar {...BASE} publicadas={duasSemanas()} />);
    await userEvent.click(cartaoDeGols());
    const ficha = await screen.findByRole('dialog');

    await userEvent.click(within(ficha).getAllByRole('button', { name: /^14\/09/ })[0]);

    expect(await screen.findByText('Perdeu x Fora')).toBeInTheDocument();
    expect(screen.queryByText('Ganhou x Fora')).toBeNull();
  });

  it('e desce um degrau: Gols abre por faixa de Score, e o voltar sobe', async () => {
    render(<Placar {...BASE} publicadas={[gols({ score: 85 }), gols({ score: 20 })]} />);
    await userEvent.click(cartaoDeGols());

    const ficha = await screen.findByRole('dialog');
    expect(ficha).toHaveTextContent('Por faixa de Score');

    await userEvent.click(within(ficha).getByRole('button', { name: /^alta \(80\+\)/i }));
    expect(
      await screen.findByRole('heading', { name: 'Gols (mais ou menos) · Alta (80+)' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { name: 'Gols (mais ou menos)' })).toBeInTheDocument();
  });
});

describe('as apostas no celular', () => {
  const abrir = async () => {
    render(
      <Placar
        {...BASE}
        publicadas={[
          gols({ home_team_name: 'Nota alta', score: 76, outcome: 'Under' }),
          gols({ home_team_name: 'Nota baixa', score: 20 }),
        ]}
      />,
    );
    await userEvent.click(cartaoDeGols());
    await userEvent.click(await screen.findByRole('button', { name: 'Ver as 2 apostas' }));
    await screen.findByText('Nota alta x Fora');
    // Com a ficha e as apostas abertas, a de cima é a última.
    return screen.getAllByRole('dialog').at(-1)!;
  };

  it('são um bloco por aposta, e a ordenação vira uma fila de botões', async () => {
    const dialogo = await abrir();
    const nomes = () => [...dialogo.querySelectorAll('li')].map((li) => li.textContent);

    expect(dialogo.querySelector('table')).toBeNull();
    // O pior primeiro, que é a pergunta de quem abriu as apostas.
    expect(nomes()[0]).toContain('Nota alta');

    await userEvent.click(within(dialogo).getByRole('button', { name: /score/i }));
    expect(nomes()[0]).toContain('Nota baixa');
  });
});

describe('a comparação no celular', () => {
  it('cada grupo mostra os dois períodos no mesmo cartão, sem tabela', () => {
    const { container } = render(
      <Placar
        {...BASE}
        publicadas={[gols()]}
        comparacao={{ publicadas: [gols()], rotuloDeA: 'Esta semana', rotuloDeB: 'Semana passada' }}
      />,
    );

    expect(container.querySelector('table')).toBeNull();
    expect(screen.getAllByText('Esta semana').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Semana passada').length).toBeGreaterThan(0);
  });
});
