import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstatisticasDoJogo } from './EstatisticasDoJogo';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// O jogo a jogo da aba de Estatísticas
// ============================================================================
// A aba não tinha teste nenhum. O que se testa aqui é o observável, e em
// primeiro lugar a fronteira de domínio: este gráfico é ESTATÍSTICA DA
// PARTIDA, não evidência de premissa. É ela que autoriza a janela a ser
// escolhida por quem olha, e é ela que a tela precisa declarar — um gráfico ao
// lado da leitura do modelo é lido como parte dela se ninguém disser o
// contrário.
// ============================================================================

const jogo = (over: Partial<FutebolFixtureHistorico> = {}): FutebolFixtureHistorico => ({
  side: 'home',
  team_id: 1,
  team_name: 'Flamengo',
  past_fixture_id: 1,
  data: '2026-08-01',
  ordem: 1,
  mesma_competicao: true,
  em_casa: true,
  adversario: 'Adversário',
  adversario_id: 2,
  gols_pro: 2,
  gols_contra: 1,
  total_gols: 3,
  ambos_marcaram: true,
  sem_sofrer: false,
  sem_marcar: false,
  xg: 1.4,
  xg_contra: 0.9,
  resultado: 'V',
  ...over,
});

/** Três jogos de cada time, o mandante em casa e o visitante fora. */
const HISTORICO: FutebolFixtureHistorico[] = [
  ...[1, 2, 3].map((n) =>
    jogo({ side: 'home', team_id: 1, team_name: 'Flamengo', past_fixture_id: n, ordem: n, em_casa: true }),
  ),
  ...[1, 2, 3].map((n) =>
    jogo({ side: 'away', team_id: 9, team_name: 'Palmeiras', past_fixture_id: 10 + n, ordem: n, em_casa: false }),
  ),
];

const abrir = (props: Partial<React.ComponentProps<typeof EstatisticasDoJogo>> = {}) =>
  render(<EstatisticasDoJogo historico={HISTORICO} carregando={false} {...props} />);

describe('a fronteira com a leitura do modelo', () => {
  it('declara que não é a leitura do modelo', () => {
    abrir();

    expect(screen.getByText(/não é a leitura do modelo/i)).toBeInTheDocument();
  });

  it('a legenda explica a cor sem tomar emprestado vocabulário de premissa', () => {
    // Na aba de mercados a legenda diz "o lado que a premissa quer", porque lá
    // existe uma saída escolhida. Aqui não existe, e repetir aquilo faria a aba
    // afirmar um conceito que ela não tem.
    abrir();

    expect(screen.getByText(/acima da média do time/i)).toBeInTheDocument();
    expect(screen.queryByText(/premissa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/a favor/i)).not.toBeInTheDocument();
  });

  it('avisa que a cor compara com a média e não julga o jogo', () => {
    // Em gols sofridos, acima da média é barra escura — e escuro lê como "bom"
    // quando ali significa ter sofrido mais gol.
    abrir();

    expect(screen.getByText(/não diz se foi bom/i)).toBeInTheDocument();
  });
});

describe('o gráfico dos dois times', () => {
  it('desenha uma série por time, nomeando o recorte', () => {
    abrir();

    expect(screen.getByText(/Flamengo, últimos 3 jogos/)).toBeInTheDocument();
    expect(screen.getByText(/Palmeiras, últimos 3 jogos/)).toBeInTheDocument();
  });

  it('troca o que é medido quando a métrica muda', async () => {
    abrir();
    expect(screen.getByText(/mais gols o time marcou/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Gols sofridos' }));

    expect(screen.getByText(/mais gols o time sofreu/i)).toBeInTheDocument();
    expect(screen.queryByText(/mais gols o time marcou/i)).not.toBeInTheDocument();
  });

  it('o recorte de mando aparece no título da série', async () => {
    abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Mando deste jogo' }));

    expect(screen.getByText(/Flamengo em casa/)).toBeInTheDocument();
    expect(screen.getByText(/Palmeiras fora/)).toBeInTheDocument();
  });
});

describe('quando não há o que desenhar', () => {
  it('diz que está carregando, em vez de afirmar ausência cedo demais', () => {
    abrir({ historico: undefined, carregando: true });

    expect(screen.getByText(/carregando os jogos anteriores/i)).toBeInTheDocument();
  });

  it('sem jogo anterior nenhum, diz isso', () => {
    abrir({ historico: [], carregando: false });

    expect(screen.getByText(/sem jogos anteriores/i)).toBeInTheDocument();
  });

  it('com um time só sobrando, nomeia quem ficou de fora e avisa da escala', async () => {
    // O caso que o estado vazio NÃO cobria: ele só falava quando os dois ficavam
    // sem jogo. Com um sobrando, a aba desenhava um time calada sobre o outro —
    // e a escala passava a ser a dele, o que derruba a promessa de que altura de
    // barra compara entre os dois.
    //
    // Aqui o visitante também só jogou em casa, então o mando deste confronto,
    // que o mede FORA, não pega nenhum jogo dele.
    const visitanteSoEmCasa = HISTORICO.map((j) => (j.side === 'away' ? { ...j, em_casa: true } : j));
    render(<EstatisticasDoJogo historico={visitanteSoEmCasa} carregando={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Mando deste jogo' }));

    expect(screen.getByText(/Palmeiras não tem jogo nesse recorte/)).toBeInTheDocument();
    expect(screen.getByText(/a escala é a dele, não a dos dois/)).toBeInTheDocument();
    // E o time que sobrou continua desenhado: o aviso acompanha o gráfico, não
    // substitui ele.
    expect(screen.getByText(/Flamengo em casa/)).toBeInTheDocument();
  });

  it('vazio POR CAUSA do mando manda voltar para todos os jogos', async () => {
    // O mandante que só jogou fora, e o visitante que só jogou em casa: o
    // recorte de mando deste confronto não pega nenhum dos dois. Dizer "sem
    // histórico" aqui mandaria a pessoa embora de um gráfico que existe.
    const trocado = HISTORICO.map((j) => ({ ...j, em_casa: j.side !== 'home' }));
    render(<EstatisticasDoJogo historico={trocado} carregando={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Mando deste jogo' }));

    expect(screen.getByText(/experimente todos os jogos/i)).toBeInTheDocument();
  });
});
