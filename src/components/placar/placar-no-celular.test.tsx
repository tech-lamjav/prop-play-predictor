import { render, screen, within } from '@testing-library/react';
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
// O que se prova aqui NÃO é aparência — é que a leitura sobrevive à largura.
// Numa tela de 390px a matriz é mais larga que a tela, e a pergunta macro ("este
// mercado está ganhando ou perdendo?") não pode depender de a pessoa arrastar a
// tabela até o fim. Por isso o total sobe para dentro da coluna presa.
//
// E a lista de apostas deixa de ser tabela: sete colunas nessa largura quebram
// cada célula em três linhas. Vira um bloco por aposta — com a ordenação, que na
// tabela mora nos cabeçalhos, virando uma fila de botões.
// ============================================================================

const PERIODO = { de: '2026-09-04', ate: '2026-09-16' };

const BASE = {
  periodo: PERIODO,
  eixo: 'jogo' as const,
  granularidade: 'semana' as const,
  aoMudarGranularidade: () => {},
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

describe('a matriz no celular', () => {
  it('traz o total da linha para dentro da coluna que não rola', () => {
    // Sem isto, saber se Gols está ganhando exigiria arrastar a tabela até a
    // última coluna — e a leitura macro é justamente a que não pode custar isso.
    render(<Placar {...BASE} publicadas={[linha(), linha({ outcome: 'Away' })]} />);
    const tabela = screen.getByText('Por mercado').closest('details')!;
    const primeiraCelula = tabela.querySelector('tbody tr td:first-child')!;

    expect(within(primeiraCelula as HTMLElement).getByRole('button', { name: /%/ })).toBeVisible();
  });

  it('e esse total abre as apostas da linha, como a célula do fim abriria', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<Placar {...BASE} publicadas={[linha({ home_team_name: 'Perdeu', outcome: 'Away' })]} />);
    const tabela = screen.getByText('Por mercado').closest('details')!;
    const total = within(tabela.querySelector('tbody tr td:first-child') as HTMLElement).getByRole(
      'button',
      { name: /%/ },
    );

    await userEvent.click(total);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Perdeu');
  });

  it('e avisa que a tabela rola de lado', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    const tabela = screen.getByText('Por mercado').closest('details')!;
    expect(tabela).toHaveTextContent(/arraste a tabela para o lado/i);
  });
});

describe('o drill no celular', () => {
  const abrir = async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <Placar
        {...BASE}
        publicadas={[
          linha({ home_team_name: 'Nota alta', score: 76, outcome: 'Away' }),
          linha({ home_team_name: 'Nota baixa', score: 20 }),
        ]}
      />,
    );
    const tabela = screen.getByText('Por mercado').closest('details')!;
    await userEvent.click(tabela.querySelector('tbody tr td:nth-child(2)') as Element);
    return { dialogo: await screen.findByRole('dialog'), userEvent };
  };

  it('vira um bloco por aposta, e não uma tabela de sete colunas', async () => {
    const { dialogo } = await abrir();
    expect(dialogo.querySelector('table')).toBeNull();
    expect(dialogo.querySelectorAll('li')).toHaveLength(2);
  });

  it('e a ordenação vira uma fila de botões, porque os cabeçalhos sumiram com a tabela', async () => {
    const { dialogo, userEvent } = await abrir();
    const nomes = () => [...dialogo.querySelectorAll('li')].map((li) => li.textContent);

    // O pior primeiro, que é a pergunta de quem clicou numa célula vermelha.
    expect(nomes()[0]).toContain('Nota alta');

    await userEvent.click(within(dialogo).getByRole('button', { name: /score/i }));
    expect(nomes()[0]).toContain('Nota baixa');
  });

  it('e cada bloco mantém o placar e a distância até a linha', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <Placar
        {...BASE}
        publicadas={[
          linha({
            market: 'goals_over_under',
            outcome: 'Over',
            line_value: 3.5,
            goals_home: 2,
            goals_away: 1,
          }),
        ]}
      />,
    );
    const tabela = screen.getByText('Por mercado').closest('details')!;
    await userEvent.click(tabela.querySelector('tbody tr td:nth-child(2)') as Element);

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('2–1');
    expect(dialogo).toHaveTextContent('faltou 0,5');
  });
});
