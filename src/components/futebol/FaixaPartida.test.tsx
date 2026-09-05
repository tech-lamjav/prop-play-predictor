import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FaixaPartida } from './FaixaPartida';
import type { JogoInfo } from './JogoResumo';

// O cabeçalho tem dois arranjos e o hook decide qual. Fixá-lo por teste é o que
// permite cobrir os dois sem depender da largura que o jsdom inventa.
const ehMobile = vi.fn(() => false);
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => ehMobile() }));

// ============================================================================
// Os três estados da leitura na faixa da partida
// ============================================================================
// "Sem leitura ainda" é uma CONCLUSÃO: significa que as duas fontes chegaram e
// nenhuma delas sustenta uma linha. Enquanto elas estão em voo, a resposta certa
// é o esqueleto, não a conclusão — senão a tela afirma um vazio que ela ainda
// não sabe se é verdade.
//
// Regra para quem mexer aqui depois (issue #310): nenhum teste deste arquivo
// afirma número de Score, peso de premissa ou slug. Eles só distinguem os três
// estados, e por isso atravessam a virada do contrato sem precisar de ajuste.
// ============================================================================

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

function renderFaixa(props: Partial<Parameters<typeof FaixaPartida>[0]> = {}) {
  return render(
    <FaixaPartida
      jogo={jogo}
      premissas={[]}
      valueRows={[]}
      leituraCarregando={false}
      locked={false}
      rodada="Rodada 24"
      estadio="Allianz Parque"
      data="05/09"
      hora="19:00"
      formHome={[]}
      formAway={[]}
      homeTeamId={10}
      awayTeamId={20}
      onAbrirMercado={vi.fn()}
      ocultos={[]}
      {...props}
    />,
  );
}

describe('FaixaPartida · estado da leitura', () => {
  it('mostra o esqueleto, e não a conclusão, enquanto a leitura carrega', () => {
    renderFaixa({ leituraCarregando: true });

    expect(screen.getByTestId('faixa-leitura-carregando')).toBeInTheDocument();
    expect(screen.queryByText('Sem leitura ainda')).not.toBeInTheDocument();
  });

  it('o confronto aparece na hora, sem esperar a leitura', () => {
    // O cabeçalho vem da lista de jogos e não depende das duas queries. Segurá-lo
    // atrás do carregando trocaria uma piscada por outra, e essa apagaria da tela
    // informação que já estava disponível.
    renderFaixa({ leituraCarregando: true });

    expect(screen.getByText('Palmeiras')).toBeInTheDocument();
    expect(screen.getByText('Flamengo')).toBeInTheDocument();
    expect(screen.getByText('05/09, 19:00')).toBeInTheDocument();
    expect(screen.getByText('Allianz Parque')).toBeInTheDocument();
  });

  it('só conclui "Sem leitura ainda" depois que as duas fontes chegaram', () => {
    renderFaixa({ leituraCarregando: false, premissas: [], valueRows: [] });

    expect(screen.queryByTestId('faixa-leitura-carregando')).not.toBeInTheDocument();
    expect(screen.getByText('Sem leitura ainda')).toBeInTheDocument();
  });
});

// ============================================================================
// Os dois arranjos do cabeçalho
// ============================================================================
// No celular o nome do time desce para baixo do escudo, e a data e o estado
// sobem para a linha da rodada. Não é gosto: com o escudo ao lado sobravam 77px
// para o nome, e de 202 times das nossas ligas só 119 cabiam.
//
// Os testes olham ONDE a informação está, e nunca o número dela — a regra do
// arquivo (#310) continua valendo.
// ============================================================================

describe('FaixaPartida · arranjo do cabeçalho', () => {
  it('no desktop, data e hora ficam juntas no meio da grade', () => {
    ehMobile.mockReturnValue(false);
    renderFaixa();

    expect(screen.getByText('05/09, 19:00')).toBeInTheDocument();
    expect(screen.getByText('Não começou')).toBeInTheDocument();
  });

  it('no celular, a hora fica sozinha e a data sobe para a linha da rodada', () => {
    ehMobile.mockReturnValue(true);
    renderFaixa();

    // Separadas: é isso que devolve largura para o nome do time.
    expect(screen.getByText('19:00')).toBeInTheDocument();
    expect(screen.getByText('05/09')).toBeInTheDocument();
    expect(screen.queryByText('05/09, 19:00')).not.toBeInTheDocument();
  });

  it('o estado do jogo aparece uma vez só, nos dois arranjos', () => {
    // Renderizar os dois arranjos e esconder um por CSS duplicaria o texto para
    // o leitor de tela. O hook existe para isso.
    ehMobile.mockReturnValue(true);
    const { unmount } = renderFaixa();
    expect(screen.getAllByText('Não começou')).toHaveLength(1);
    unmount();

    ehMobile.mockReturnValue(false);
    renderFaixa();
    expect(screen.getAllByText('Não começou')).toHaveLength(1);
  });

  it('o nome do time aparece nos dois arranjos', () => {
    ehMobile.mockReturnValue(true);
    const { unmount } = renderFaixa();
    expect(screen.getByText('Palmeiras')).toBeInTheDocument();
    expect(screen.getByText('Flamengo')).toBeInTheDocument();
    unmount();

    ehMobile.mockReturnValue(false);
    renderFaixa();
    expect(screen.getByText('Palmeiras')).toBeInTheDocument();
    expect(screen.getByText('Flamengo')).toBeInTheDocument();
  });
});
