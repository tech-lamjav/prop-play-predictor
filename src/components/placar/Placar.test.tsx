import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Placar } from './Placar';
import type { LinhaPublicada } from './placar-agregacao';

// ============================================================================
// A tela do placar
// ============================================================================
// A aritmética tem teste próprio. O que se prova aqui é o que a tela DIZ, e as
// três coisas que ela não pode deixar de dizer:
//
//   · o denominador ao lado de cada número;
//   · quantas oportunidades ainda não liquidaram;
//   · que ela mede a foto de nascimento, e que a candidata recusada não está
//     aqui — as duas frases que impedem uma conclusão errada sobre o corte.
// ============================================================================

/** A janela que o gráfico usa para escolher a granularidade. */
const PERIODO = { de: '2026-09-04', ate: '2026-09-16' };

/** O que toda montagem precisa: a janela, o eixo e o degrau do tempo. */
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

describe('o placar diz o que está medindo', () => {
  it('avisa que mede a foto de nascimento, e não o estado no apito', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.getByText(/foto de nascimento/i)).toBeInTheDocument();
  });

  it('avisa que a candidata recusada pelo funil não está aqui', () => {
    // Sem esta frase, o sócio olha a tabela e conclui que o corte está certo —
    // e a tela nunca teve como saber.
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.getByText(/recusou/i)).toBeInTheDocument();
  });
});

describe('o placar mostra o denominador', () => {
  it('junto do ROI e junto da taxa de acerto', () => {
    render(<Placar {...BASE} publicadas={[linha(), linha({ outcome: 'Away' })]} />);
    // Duas apostas liquidadas, nenhuma anulada: os dois denominadores são 2.
    expect(screen.getAllByText('em 2').length).toBeGreaterThanOrEqual(2);
  });
});

describe('o placar conta o que não liquidou', () => {
  it('diz quantas estão pendentes, e que elas ficam fora da conta', () => {
    render(
      <Placar {...BASE}
        publicadas={[linha(), linha({ status_short: 'NS', goals_home: null, goals_away: null })]}
      />,
    );
    expect(screen.getByText(/ainda não liquidou/i)).toBeInTheDocument();
  });

  it('e não fala de pendente quando não há nenhuma', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.queryByText(/ainda não liquid/i)).not.toBeInTheDocument();
  });
});

describe('a tabela por mercado', () => {
  it('usa o nome que o produto dá ao mercado', () => {
    render(<Placar {...BASE} publicadas={[linha({ market: 'goals_over_under', outcome: 'Over', line_value: 2.5 })]} />);
    // Escopado à tabela: o mesmo nome aparece no seletor de mercado do gráfico.
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).toHaveTextContent('Gols (mais ou menos)');
  });

  it('sem nada liquidado, não mostra tabela vazia fingindo resultado', () => {
    render(<Placar {...BASE} publicadas={[linha({ status_short: '2H' })]} />);
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).toHaveTextContent(/nenhuma oportunidade liquidada/i);
    expect(tabela?.querySelector('tbody')).toBeNull();
  });
});

describe('as outras quebras', () => {
  it('mostra as quatro tabelas, e cada uma diz o que responde', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.getByText('Por mercado')).toBeInTheDocument();
    expect(screen.getByText('Por faixa de Score')).toBeInTheDocument();
    expect(screen.getByText('Por faixa de odd')).toBeInTheDocument();
    expect(screen.getByText('Por campeonato')).toBeInTheDocument();
  });

  it('a faixa de Score sai na ordem da escala, não na do tamanho da base', () => {
    // Três apostas na Baixa e uma na Alta: ordenada pela base, a Alta viria
    // depois de qualquer jeito. O caso que pega o erro é a Baixa vir primeiro
    // mesmo sendo a maior — então o teste usa a ordem inversa de tamanho.
    render(
      <Placar {...BASE}
        publicadas={[
          linha({ score: 85 }),
          linha({ score: 85 }),
          linha({ score: 85 }),
          linha({ score: 20 }),
        ]}
      />,
    );
    const tabela = screen.getByText('Por faixa de Score').closest('section');
    const grupos = [...(tabela?.querySelectorAll('tbody tr td:first-child') ?? [])].map(
      (td) => td.textContent,
    );
    expect(grupos).toEqual(['Baixa (<30)', 'Alta (80+)']);
  });

  it('o campeonato sem nome não some da conta', () => {
    render(<Placar {...BASE} publicadas={[linha({ competition: null })]} />);
    expect(screen.getByText('Sem campeonato')).toBeInTheDocument();
  });
});

describe('os avisos do período', () => {
  it('aparecem acima dos números, porque aviso embaixo chega depois da conclusão', () => {
    render(<Placar {...BASE} publicadas={[linha()]} avisos={['a nota está em outra escala']} />);
    const aviso = screen.getByText(/outra escala/i);
    const liquidadas = screen.getByText('Liquidadas');
    // compareDocumentPosition: 4 = o aviso vem ANTES do bloco de números.
    expect(aviso.compareDocumentPosition(liquidadas) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('sem aviso, não sobra moldura de aviso vazia', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.queryByText(/atenção:/i)).not.toBeInTheDocument();
  });
});

describe('o mercado fora da vitrine', () => {
  const OCULTOS = [{ market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z' }];

  it('aparece na tabela com selo dizendo que está fora', () => {
    render(
      <Placar {...BASE}
        publicadas={[linha({ market: 'asian_handicap', outcome: 'Home', line_value: -1 })]}
        ocultos={OCULTOS}
      />,
    );
    expect(screen.getByText('fora da vitrine')).toBeInTheDocument();
  });

  it('e o mercado que está na tela não ganha selo', () => {
    render(<Placar {...BASE} publicadas={[linha()]} ocultos={OCULTOS} />);
    expect(screen.queryByText('fora da vitrine')).not.toBeInTheDocument();
  });

  it('quando a conta é restrita à vitrine, a tela diz quantas ficaram de fora', () => {
    render(<Placar {...BASE} publicadas={[linha()]} ocultos={OCULTOS} foraDaVitrine={3} />);
    expect(screen.getByText(/3 oportunidades ficaram de fora/i)).toBeInTheDocument();
  });

  it('e não fala disso quando a conta é do board inteiro', () => {
    render(<Placar {...BASE} publicadas={[linha()]} ocultos={OCULTOS} />);
    expect(screen.queryByText(/ficaram de fora/i)).not.toBeInTheDocument();
  });
});

describe('a seção de ROI por premissa', () => {
  it('mede dentro do lado do mercado, e diz isso', () => {
    // O erro que quase foi para a tela: medir a premissa contra o mercado
    // inteiro em vez de contra o próprio lado. Em Gols, isso inflava a
    // diferença de uma premissa de Over com o buraco do Under.
    render(
      <Placar {...BASE}
        publicadas={[
          linha({ market: 'goals_over_under', outcome: 'Over', line_value: 1.5 }),
          linha({ market: 'goals_over_under', outcome: 'Under', line_value: 1.5 }),
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'ROI por premissa' })).toBeInTheDocument();
    expect(screen.getByText(/dentro do lado do mercado/i)).toBeInTheDocument();
    expect(screen.getByText('Gols (mais ou menos) · Mais gols')).toBeInTheDocument();
    expect(screen.getByText('Gols (mais ou menos) · Menos gols')).toBeInTheDocument();
  });

  it('lista as premissas do lado, com a que acendeu primeiro', () => {
    render(
      <Placar {...BASE}
        publicadas={[
          linha({ market: 'goals_over_under', outcome: 'Over', line_value: 1.5, premissas_acesas: ['ritmo_alto'] }),
          linha({ market: 'goals_over_under', outcome: 'Over', line_value: 1.5, premissas_acesas: ['ritmo_alto'] }),
          linha({ market: 'goals_over_under', outcome: 'Over', line_value: 1.5, goals_home: 0, goals_away: 0 }),
          linha({ market: 'goals_over_under', outcome: 'Over', line_value: 1.5, goals_home: 0, goals_away: 0 }),
        ]}
      />,
    );
    // O card de premissa é um <details> desde que ficou recolhível.
    const secao = screen.getByText('Gols (mais ou menos) · Mais gols').closest('details');
    const primeira = secao?.querySelector('tbody tr td:first-child');
    expect(primeira?.textContent).toBe('Jogo de ritmo alto');
  });

  it('diz que a flag vem recalculada e que o insumo ainda não chega', () => {
    // É o limite honesto da medição: mudar o critério de uma premissa reescreve
    // o passado, e sem o insumo não se separa 'acendeu raspando' de 'com folga'.
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.getByText(/recalculada do mart/i)).toBeInTheDocument();
    expect(screen.getByText(/insumo, ainda não/i)).toBeInTheDocument();
  });

  it('e o bloco de cortes do dado saiu da tela, a pedido', () => {
    // Premissas sem dado, corroboração e penalidade eram três tabelas que
    // ninguém usava para decidir. Saíram inteiras, com o módulo delas.
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.queryByText('O dado por trás da linha')).not.toBeInTheDocument();
    expect(screen.queryByText('Por penalidade aplicada')).not.toBeInTheDocument();
  });

  it('e o card do lado recolhe', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    const card = screen.getByText('Resultado', { selector: 'h3' }).closest('details');
    expect(card).toHaveAttribute('open');
    expect(card?.querySelector('summary')).toBeInTheDocument();
  });
});

describe('comparando dois períodos', () => {
  const comparacao = (publicadas: LinhaPublicada[]) => ({
    publicadas,
    rotuloDeA: '06/09 a 12/09',
    rotuloDeB: '30/08 a 05/09',
  });

  it('mostra os dois períodos como colunas, com o nome de cada um', () => {
    render(<Placar {...BASE} publicadas={[linha()]} comparacao={comparacao([linha()])} />);
    expect(screen.getAllByText('06/09 a 12/09').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30/08 a 05/09').length).toBeGreaterThan(0);
  });

  it('com base pequena dos dois lados, diz que a diferença é ruído', () => {
    // Um green de um lado e um red do outro: a diferença é enorme e não
    // sustenta nada. Mostrar o número puro convidaria à conclusão.
    render(
      <Placar {...BASE}
        publicadas={[linha(), linha({ outcome: 'Away' })]}
        comparacao={comparacao([linha({ outcome: 'Away' }), linha()])}
      />,
    );
    expect(screen.getAllByText(/dentro do ruído/i).length).toBeGreaterThan(0);
  });

  it('o grupo que só existe num dos lados não ganha diferença', () => {
    render(
      <Placar {...BASE}
        publicadas={[linha({ market: 'btts', outcome: 'Yes' })]}
        comparacao={comparacao([])}
      />,
    );
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).toHaveTextContent(/sem aposta/i);
  });

  it('sem comparação, a tabela de mercado volta a ter uma coluna de números', () => {
    // Escopado à tabela de mercado: a seção de premissa tem coluna de diferença
    // sempre, porque lá a diferença é entre acesa e apagada, não entre períodos.
    render(<Placar {...BASE} publicadas={[linha()]} />);
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).not.toHaveTextContent('Diferença');
  });
});

describe('o total do período', () => {
  it('mostra acertos e anuladas em número, e não só dentro da taxa', () => {
    // São eles que explicam por que a taxa e o ROI têm denominadores
    // diferentes: sem o número de anuladas, a diferença parece erro de conta.
    render(
      <Placar {...BASE}
        publicadas={[
          linha(),
          linha({ outcome: 'Away' }),
          linha({ market: 'asian_handicap', line_value: 0, goals_home: 1, goals_away: 1 }),
        ]}
      />,
    );
    expect(screen.getByText('Anuladas')).toBeInTheDocument();
    expect(screen.getByText(/Acerto: 1 em 2/)).toBeInTheDocument();
  });
});

describe('o gráfico de evolução', () => {
  it('vem antes das tabelas, porque a primeira pergunta é se está melhorando', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    const grafico = screen.getByText('Evolução do ROI');
    const tabela = screen.getByText('Por mercado');
    expect(grafico.compareDocumentPosition(tabela) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('oferece os mercados presentes para escolher', () => {
    render(
      <Placar {...BASE} publicadas={[linha(), linha({ market: 'btts', outcome: 'Yes' })]} />,
    );
    const grafico = screen.getByText('Evolução do ROI').closest('section');
    expect(grafico).toHaveTextContent('Resultado');
    expect(grafico).toHaveTextContent('Ambos marcam');
  });

  it('e convida a abrir o degrau de baixo', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    expect(screen.getByText(/clique numa barra para abrir por dia/i)).toBeInTheDocument();
  });

  it('o texto de contexto fica atrás de um resumo, e não em cima dos números', () => {
    // A queixa era de tela que parecia relatório. As frases continuam lá, uma
    // linha de distância: quem lê todo dia já leu, quem chega hoje abre.
    render(<Placar {...BASE} publicadas={[linha()]} />);
    const resumo = screen.getByText('Como este número é medido');
    expect(resumo.tagName).toBe('SUMMARY');
    expect(resumo.closest('details')).not.toHaveAttribute('open');
  });
});

describe('a matriz das quebras', () => {
  it('põe as datas nas colunas e o total no fim', () => {
    render(
      <Placar
        {...BASE}
        publicadas={[
          linha({ kickoff_utc: '2026-09-08T23:00:00' }),
          linha({ kickoff_utc: '2026-09-15T23:00:00' }),
        ]}
      />,
    );
    const tabela = screen.getByText('Por mercado').closest('section');
    const colunas = [...(tabela?.querySelectorAll('thead th') ?? [])].map((th) => th.textContent);
    expect(colunas[0]).toBe('Grupo');
    expect(colunas[colunas.length - 1]).toBe('Total');
    expect(colunas).toContain('07/09');
    expect(colunas).toContain('14/09');
  });

  it('e cada célula convida a abrir o que está dentro', () => {
    render(<Placar {...BASE} publicadas={[linha()]} />);
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).toHaveTextContent(/clique para ver o que está dentro/i);
  });

  it('clicar numa célula abre o drill, do pior para o melhor', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <Placar
        {...BASE}
        publicadas={[
          linha({ kickoff_utc: '2026-09-08T23:00:00', home_team_name: 'Ganhou' }),
          linha({ kickoff_utc: '2026-09-08T23:00:00', home_team_name: 'Perdeu', outcome: 'Away' }),
        ]}
      />,
    );
    const tabela = screen.getByText('Por mercado').closest('section');
    const celula = tabela?.querySelector('tbody tr td:nth-child(2)');
    await userEvent.click(celula as Element);

    const dialogo = await screen.findByRole('dialog');
    expect(dialogo).toHaveTextContent('Perdeu');
    expect(dialogo).toHaveTextContent('Ganhou');
    const jogos = [...dialogo.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(jogos[0]).toContain('Perdeu');
  });

  it('comparando dois períodos, a matriz sai de cena', () => {
    // Duas matrizes lado a lado não se leem: comparando, quem ocupa as colunas
    // são os dois períodos.
    render(
      <Placar
        {...BASE}
        publicadas={[linha()]}
        comparacao={{ publicadas: [linha()], rotuloDeA: 'A', rotuloDeB: 'B' }}
      />,
    );
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).toHaveTextContent('Diferença');
    expect(tabela).not.toHaveTextContent(/clique para ver o que está dentro/i);
  });
});

describe('o drill mostra o placar e a distância até a linha', () => {
  const abrirPrimeiraCelula = async (publicadas: LinhaPublicada[]) => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<Placar {...BASE} publicadas={publicadas} />);
    const tabela = screen.getByText('Por mercado').closest('section');
    await userEvent.click(tabela?.querySelector('tbody tr td:nth-child(2)') as Element);
    return screen.findByRole('dialog');
  };

  it('em Gols, diz o placar e quanto faltou para bater', async () => {
    // 2–1 são três gols numa linha de Over 3,5: faltou meio gol. Sem isso, "Red"
    // não distingue azar de leitura errada.
    const dialogo = await abrirPrimeiraCelula([
      linha({
        market: 'goals_over_under',
        outcome: 'Over',
        line_value: 3.5,
        goals_home: 2,
        goals_away: 1,
      }),
    ]);
    expect(dialogo).toHaveTextContent('2–1');
    expect(dialogo).toHaveTextContent('faltou 0,5');
  });

  it('e em mercado sem linha mostra o placar, sem inventar margem', async () => {
    const dialogo = await abrirPrimeiraCelula([
      linha({ market: 'match_winner', outcome: 'Home', line_value: null, goals_home: 3, goals_away: 0 }),
    ]);
    expect(dialogo).toHaveTextContent('3–0');
    expect(dialogo).not.toHaveTextContent(/faltou|sobrou/);
  });
});

describe('a régua anterior do Score', () => {
  // Publicada em 03/09, jogo em 08/09: nota na régua velha, jogo dentro do
  // período. Ela conta em toda tabela, menos na de faixa — e a tela diz isso,
  // em vez de oferecer uma faixa chamada "antes de 04/09", que numa tabela de
  // colunas por data lê como recorte de calendário.
  const velha = () =>
    linha({ detectada_em: '2026-09-03T03:00:00', kickoff_utc: '2026-09-08T23:00:00', score: 85 });
  const nova = () =>
    linha({ detectada_em: '2026-09-08T03:00:00', kickoff_utc: '2026-09-08T23:00:00', score: 85 });

  it('não vira uma faixa na tabela de Score', () => {
    render(<Placar {...BASE} publicadas={[velha(), nova()]} />);
    const tabela = screen.getByText('Por faixa de Score').closest('section');
    expect(tabela).not.toHaveTextContent(/escala antiga/i);
  });

  it('mas a tabela diz quantas ficaram de fora, e por quê', () => {
    render(<Placar {...BASE} publicadas={[velha(), nova()]} />);
    const tabela = screen.getByText('Por faixa de Score').closest('section');
    expect(tabela).toHaveTextContent('1 aposta fora desta tabela');
    expect(tabela).toHaveTextContent(/outra régua/i);
    expect(tabela).toHaveTextContent(/não é recorte de data/i);
  });

  it('e ela conta normalmente nas outras tabelas', () => {
    render(<Placar {...BASE} publicadas={[velha(), nova()]} />);
    const porMercado = screen.getByText('Por mercado').closest('section');
    const total = porMercado?.querySelector('tbody tr td:last-child');
    expect(total?.textContent).toContain('2');
  });
});

describe('a ordenação dentro do drill', () => {
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
    const tabela = screen.getByText('Por mercado').closest('section');
    await userEvent.click(tabela?.querySelector('tbody tr td:nth-child(2)') as Element);
    return { dialogo: await screen.findByRole('dialog'), userEvent };
  };

  const nomes = (dialogo: HTMLElement) =>
    [...dialogo.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent?.trim());

  it('abre no pior primeiro, que é a pergunta de quem clicou numa célula vermelha', async () => {
    const { dialogo } = await abrir();
    expect(nomes(dialogo)[0]).toContain('Nota alta');
  });

  it('e o cabeçalho do Score reordena', async () => {
    const { dialogo, userEvent } = await abrir();
    await userEvent.click(screen.getByRole('button', { name: /score/i }));
    expect(nomes(dialogo)[0]).toContain('Nota baixa');

    await userEvent.click(screen.getByRole('button', { name: /score/i }));
    expect(nomes(dialogo)[0]).toContain('Nota alta');
  });
});
