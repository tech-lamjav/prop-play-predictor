import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
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

// A linha virou `<Link>` (#341), para o clique do meio abrir a tela do jogo em
// outra aba. Isso exige um Router em volta — não é acoplamento novo do
// componente ao roteador, é o preço de a linha ser um link de verdade em vez de
// um botão que finge navegar.
function renderLinha(props: Partial<Parameters<typeof FixtureRow>[0]> = {}) {
  return render(
    <MemoryRouter>
      <FixtureRow
        fixture={jogo}
        best={null}
        leituraCarregando={false}
        to={`/futebol/jogo/${jogo.fixture_id}`}
        onClick={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
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

// ============================================================================
// A camada de valor é paga também aqui (03/09)
// ============================================================================
// A agenda entregava de graça exatamente os três números que a lista de
// Oportunidades borra: o pick, a odd e a chance. Era a mesma informação, na
// mesma sessão anônima, com preço diferente dependendo da tela.
//
// O Blur envolve o trecho num span aria-hidden com filtro de desfoque, então
// "borrado" se testa pelo invólucro, e não pela ausência do texto: o conteúdo
// continua no DOM (é o borrão que cria o desejo), só sai da árvore acessível.
// ============================================================================

const leitura = {
  market: 'goals_over_under',
  outcome: 'Over',
  line_value: 2.5,
  best_odd: 1.95,
  prob_justa_fechamento: 0.55,
  score: 63,
  faixa: 'Alta',
} as unknown as Parameters<typeof FixtureRow>[0]['best'];

describe('FixtureRow · acesso à camada de valor', () => {
  it('sem acesso, o pick e a odd saem borrados', () => {
    renderLinha({ best: leitura, locked: true });

    expect(screen.getByText(/odd 1/).closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText(/Mais de 2,5/i).closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('com acesso, os números aparecem sem desfoque', () => {
    renderLinha({ best: leitura });

    expect(screen.getByText(/odd 1/).closest('[aria-hidden="true"]')).toBeNull();
  });

  it('jogo encerrado não borra, nem sem acesso', () => {
    // O passado é registro do que foi publicado, não pick para apostar — mesma
    // exceção da lista de Oportunidades.
    renderLinha({
      best: leitura,
      locked: true,
      fixture: { ...jogo, status_short: 'FT', goals_home: 2, goals_away: 1 } as typeof jogo,
    });

    expect(screen.getByText(/odd 1/).closest('[aria-hidden="true"]')).toBeNull();
  });
});
