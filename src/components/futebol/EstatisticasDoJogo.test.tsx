import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstatisticasDoJogo } from './EstatisticasDoJogo';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// O jogo a jogo da aba de Estatísticas
// ============================================================================
// Duas afirmações de domínio, e nenhuma é estética:
//
//   · isto é ESTATÍSTICA DA PARTIDA, não evidência de premissa — e é o que
//     autoriza mercado, janela, mando e time a serem escolha de quem olha;
//   · a LINHA é referência, não aposta: sem lado, sem preço, nada liquidado.
//
// E uma regra de desenho que já foi quebrada duas vezes: a legenda não pode
// desmentir o desenho. Mercado com grandeza vira BARRA num gráfico só; mercado
// binário vira QUADRO, sem linha e com um time por vez.
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

/** Mandante com quatro jogos de 1 a 4 gols; visitante com dois de 1 gol. */
const HISTORICO: FutebolFixtureHistorico[] = [
  ...[1, 2, 3, 4].map((n) =>
    jogo({ side: 'home', past_fixture_id: n, ordem: n, gols_pro: n, gols_contra: 0, total_gols: n }),
  ),
  ...[1, 2].map((n) =>
    jogo({
      side: 'away', team_id: 9, team_name: 'Palmeiras', past_fixture_id: 20 + n, ordem: n,
      em_casa: false, gols_pro: 0, gols_contra: 1, total_gols: 1, resultado: 'D',
    }),
  ),
];

const abrir = (props: Partial<React.ComponentProps<typeof EstatisticasDoJogo>> = {}) =>
  render(<EstatisticasDoJogo historico={HISTORICO} carregando={false} {...props} />);

/**
 * Janela e Mando viraram seletores compactos: o cabeçalho tinha quatro fileiras
 * empilhadas, que juntas ocupavam quase a altura do gráfico. Escolher agora é
 * abrir o menu e clicar no item, e não mais tocar num chip solto.
 */
const escolherNoMenu = async (gatilho: RegExp, item: string) => {
  await userEvent.click(screen.getByRole('button', { name: gatilho }));
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: item }));
};
const escolherJanela = (item: string) => escolherNoMenu(/^Janela/i, item);
const escolherMando = (item: string) => escolherNoMenu(/^Mando/i, item);

describe('a fronteira com a leitura do modelo', () => {
  it('declara que não é a leitura do modelo', () => {
    abrir();
    expect(screen.getByText(/não é a leitura do modelo/i)).toBeInTheDocument();
  });

  it('não toma emprestado vocabulário de premissa nem de aposta', () => {
    abrir();
    expect(screen.queryByText(/premissa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aposta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/taxa de acerto/i)).not.toBeInTheDocument();
  });
});

describe('o time vem antes do mercado', () => {
  it('oferece os dois times pelo nome, e os dois juntos', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Os dois' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flamengo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Palmeiras' })).toBeInTheDocument();
  });

  it('escolher um time deixa só ele no gráfico', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Flamengo' }));
    expect(screen.getByText(/Flamengo, últimos 4 jogos/)).toBeInTheDocument();
    expect(screen.queryByText(/Palmeiras, últimos/)).not.toBeInTheDocument();
  });
});

describe('mercado com grandeza: barras num gráfico só, com linha', () => {
  it('abre em gols, com a régua e a contagem', () => {
    abrir();
    expect(screen.getByLabelText('Linha de referência')).toBeInTheDocument();
    expect(screen.getByText(/dos 6 jogos dos dois times passaram de 2,5/i)).toHaveTextContent('2 dos 6 jogos');
  });

  it('a frase declara a janela, e o mando quando está ligado', async () => {
    abrir();
    expect(screen.getByText(/Janela: últimos 10 de cada time/i)).toBeInTheDocument();

    await escolherMando('Mando deste jogo');
    expect(screen.getByText(/só com o mando deste confronto/i)).toBeInTheDocument();
  });

  it('mexer na linha muda a conta', () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Linha de referência'), { target: { value: '1' } });
    expect(screen.getByText(/dos 6 jogos dos dois times passaram de 1,5/i)).toHaveTextContent('3 dos 6 jogos');
  });

  it('handicap mede o saldo do time', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Handicap' }));
    expect(screen.getByText(/saldo do time naquele jogo/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Linha de referência')).toBeInTheDocument();
  });
});

describe('mercado binário: quadro de jogo, sem linha e um time por vez', () => {
  it.each([
    ['Resultado', /Verde é vitória/i],
    ['Dupla chance', /Verde é vitória/i],
    ['Ambos marcam', /Verde quando os dois marcaram/i],
  ])('%s vira quadro, sem régua', async (chip, legenda) => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: chip }));

    expect(screen.queryByLabelText('Linha de referência')).not.toBeInTheDocument();
    expect(screen.getByText('4 a 0')).toBeInTheDocument();
    // ⚠️ A legenda tem de falar de QUADRO. Ela já disse "cada barra" embaixo de
    // quadrados uma vez, e é a tela desmentindo o próprio desenho.
    expect(screen.getByText(legenda)).toBeInTheDocument();
    expect(screen.getByText(/Cada quadrado é um jogo/i)).toBeInTheDocument();
  });

  it('não oferece os dois times juntos, e tira quem já estava neles', async () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Os dois' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Resultado' }));

    expect(screen.queryByRole('button', { name: 'Os dois' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flamengo' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('o que fica embaixo de cada barra', () => {
  it('mostra o placar embaixo do escudo', () => {
    abrir();
    expect(screen.getByText('4×0')).toBeInTheDocument();
    expect(screen.getAllByText('0×1')).toHaveLength(2);
  });

  it('com barras demais, o placar e o número cedem lugar', async () => {
    const muitos: FutebolFixtureHistorico[] = [
      ...Array.from({ length: 20 }, (_, i) =>
        jogo({ side: 'home', past_fixture_id: i + 1, ordem: i + 1, gols_pro: 4, gols_contra: 0, total_gols: 4 }),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        jogo({
          side: 'away', team_id: 9, team_name: 'Palmeiras', past_fixture_id: 100 + i, ordem: i + 1,
          em_casa: false, gols_pro: 0, gols_contra: 1, total_gols: 1,
        }),
      ),
    ];
    render(<EstatisticasDoJogo historico={muitos} carregando={false} />);

    await escolherJanela('Últimos 20');

    expect(screen.queryByText('4×0')).not.toBeInTheDocument();
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

  it('vazio POR CAUSA do mando manda voltar para todos os jogos', async () => {
    const trocado = HISTORICO.map((j) => ({ ...j, em_casa: j.side !== 'home' }));
    render(<EstatisticasDoJogo historico={trocado} carregando={false} />);

    await escolherMando('Mando deste jogo');

    expect(screen.getByText(/experimente todos os jogos/i)).toBeInTheDocument();
  });

  it('com um time só sobrando, nomeia quem ficou de fora e avisa da escala', async () => {
    const visitanteSoEmCasa = HISTORICO.map((j) => (j.side === 'away' ? { ...j, em_casa: true } : j));
    render(<EstatisticasDoJogo historico={visitanteSoEmCasa} carregando={false} />);

    await escolherMando('Mando deste jogo');

    expect(screen.getByText(/Palmeiras não tem jogo nesse recorte/)).toBeInTheDocument();
    expect(screen.getByText(/a escala é a dele, não a dos dois/)).toBeInTheDocument();
  });
});

describe('a aba nasce onde a pessoa estava', () => {
  it('abre no mercado que ela vinha lendo', () => {
    abrir({ mercadoInicial: 'btts' });
    expect(screen.queryByLabelText('Linha de referência')).not.toBeInTheDocument();
  });

  it('ignora mercado desconhecido em vez de quebrar', () => {
    abrir({ mercadoInicial: 'mercado_que_nao_existe' });
    expect(screen.getByLabelText('Linha de referência')).toBeInTheDocument();
  });
});
