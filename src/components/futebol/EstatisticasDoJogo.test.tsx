import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EstatisticasDoJogo } from './EstatisticasDoJogo';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// O jogo a jogo da aba de Estatísticas
// ============================================================================
// Duas afirmações de domínio são o que estes testes guardam, e nenhuma delas é
// estética:
//
//   · isto é ESTATÍSTICA DA PARTIDA, não evidência de premissa — e é isso que
//     autoriza mercado, janela, mando e time a serem escolha de quem olha;
//   · a LINHA é referência, não aposta: nada é liquidado, não há lado nem preço,
//     e o número que ela produz declara sempre a própria janela, porque existe
//     premissa contando os últimos cinco contra a linha.
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

/** Mandante com quatro jogos de 1, 2, 3 e 4 gols; visitante com dois de 1 gol. */
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

describe('o mercado manda no que o gráfico mede', () => {
  it('abre em gols, com linha de referência', () => {
    abrir();
    expect(screen.getByLabelText('Linha de referência')).toBeInTheDocument();
    expect(screen.getByText(/total de gols daquele jogo/i)).toBeInTheDocument();
  });

  it('handicap passa a medir o saldo do time', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Handicap' }));
    expect(screen.getByText(/saldo do time naquele jogo/i)).toBeInTheDocument();
  });

  it('mercado sem quantidade não ganha linha', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Ambos marcam' }));
    expect(screen.queryByLabelText('Linha de referência')).not.toBeInTheDocument();
  });

  it('Resultado vira QUADRO de jogo, e não barra', async () => {
    // Vitória não é "mais alta" que empate. Desenhar resultado como barra fazia
    // a tela imprimir "cada quadrado é um jogo" embaixo de barras de saldo de
    // gols — a legenda desmentindo o desenho logo acima dela. O teste anterior
    // só olhava a métrica e a linha, e por isso passou verde nesse defeito.
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Resultado' }));

    expect(screen.getByText('4 a 0')).toBeInTheDocument();
    expect(screen.getByText(/Cada quadrado é um jogo/i)).toBeInTheDocument();
    expect(screen.queryByText(/acima da linha/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/acima da média do time/i)).not.toBeInTheDocument();
  });
});

describe('a linha é referência, e o número declara a janela', () => {
  it('abre JÁ com uma linha, e conta quantos passaram dela', () => {
    // O gráfico nascia sem linha nenhuma, o que desligava justamente o que ele
    // veio fazer. Gols abre em 2,5, que é a linha canônica do mercado.
    // Mandante 1, 2, 3 e 4 gols; visitante 1 e 1. Acima de 2,5: só 3 e 4.
    abrir();
    expect(screen.getByText(/dos 6 jogos dos dois times passaram de 2,5/i)).toHaveTextContent('2 dos 6 jogos');
  });

  it('a frase declara a BASE inteira, não só o número', () => {
    // Ela dizia "dos últimos 6" somando as barras dos dois times — com janela 10
    // isso anunciaria "os últimos 20", uma janela que ninguém escolheu. Existe
    // premissa contando os últimos cinco contra a linha: dois números da mesma
    // forma só não se contradizem porque cada um diz de onde saiu.
    abrir();
    expect(screen.getByText(/Janela: últimos 10 de cada time/i)).toBeInTheDocument();
  });

  it('e diz quando o recorte de mando está ligado', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Mando deste jogo' }));
    expect(screen.getByText(/só com o mando deste confronto/i)).toBeInTheDocument();
  });

  it('com um time só, a frase nomeia o time', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Flamengo' }));
    expect(screen.getByText(/dos 4 jogos do Flamengo passaram de 2,5/i)).toBeInTheDocument();
  });

  it('mexer na linha muda a conta, sem mexer nas barras', () => {
    abrir();
    const regua = screen.getByLabelText('Linha de referência');

    // Índice 1 nas paradas de gols é 1,5: passam 2, 3 e 4.
    fireEvent.change(regua, { target: { value: '1' } });

    expect(screen.getByText(/dos 6 jogos dos dois times passaram de 1,5/i)).toHaveTextContent('3 dos 6 jogos');
  });
});

describe('quem entra no gráfico', () => {
  it('oferece os dois times pelo nome', () => {
    abrir();
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

describe('o recorte de mando', () => {
  it('aparece no título da série', async () => {
    abrir();
    await userEvent.click(screen.getByRole('button', { name: 'Mando deste jogo' }));
    expect(screen.getByText(/Flamengo em casa/)).toBeInTheDocument();
    expect(screen.getByText(/Palmeiras fora/)).toBeInTheDocument();
  });

  it('com um time só sobrando, nomeia quem ficou de fora e avisa da escala', async () => {
    // O visitante também só jogou em casa: o mando deste confronto, que o mede
    // FORA, não pega nenhum jogo dele.
    const visitanteSoEmCasa = HISTORICO.map((j) => (j.side === 'away' ? { ...j, em_casa: true } : j));
    render(<EstatisticasDoJogo historico={visitanteSoEmCasa} carregando={false} />);

    await userEvent.click(screen.getByRole('button', { name: 'Mando deste jogo' }));

    expect(screen.getByText(/Palmeiras não tem jogo nesse recorte/)).toBeInTheDocument();
    expect(screen.getByText(/a escala é a dele, não a dos dois/)).toBeInTheDocument();
    expect(screen.getByText(/Flamengo em casa/)).toBeInTheDocument();
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
