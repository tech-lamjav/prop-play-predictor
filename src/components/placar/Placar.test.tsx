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
  ...p,
});

describe('o placar diz o que está medindo', () => {
  it('avisa que mede a foto de nascimento, e não o estado no apito', () => {
    render(<Placar publicadas={[linha()]} />);
    expect(screen.getByText(/foto de nascimento/i)).toBeInTheDocument();
  });

  it('avisa que a candidata recusada pelo funil não está aqui', () => {
    // Sem esta frase, o sócio olha a tabela e conclui que o corte está certo —
    // e a tela nunca teve como saber.
    render(<Placar publicadas={[linha()]} />);
    expect(screen.getByText(/recusou/i)).toBeInTheDocument();
  });
});

describe('o placar mostra o denominador', () => {
  it('junto do ROI e junto da taxa de acerto', () => {
    render(<Placar publicadas={[linha(), linha({ outcome: 'Away' })]} />);
    // Duas apostas liquidadas, nenhuma anulada: os dois denominadores são 2.
    expect(screen.getAllByText('em 2').length).toBeGreaterThanOrEqual(2);
  });
});

describe('o placar conta o que não liquidou', () => {
  it('diz quantas estão pendentes, e que elas ficam fora da conta', () => {
    render(
      <Placar
        publicadas={[linha(), linha({ status_short: 'NS', goals_home: null, goals_away: null })]}
      />,
    );
    expect(screen.getByText(/ainda não liquidou/i)).toBeInTheDocument();
  });

  it('e não fala de pendente quando não há nenhuma', () => {
    render(<Placar publicadas={[linha()]} />);
    expect(screen.queryByText(/ainda não liquid/i)).not.toBeInTheDocument();
  });
});

describe('a tabela por mercado', () => {
  it('usa o nome que o produto dá ao mercado', () => {
    render(<Placar publicadas={[linha({ market: 'goals_over_under', outcome: 'Over', line_value: 2.5 })]} />);
    expect(screen.getByText('Gols (mais ou menos)')).toBeInTheDocument();
  });

  it('sem nada liquidado, não mostra tabela vazia fingindo resultado', () => {
    render(<Placar publicadas={[linha({ status_short: '2H' })]} />);
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).toHaveTextContent(/nenhuma oportunidade liquidada/i);
    expect(tabela?.querySelector('tbody')).toBeNull();
  });
});

describe('as outras quebras', () => {
  it('mostra as quatro tabelas, e cada uma diz o que responde', () => {
    render(<Placar publicadas={[linha()]} />);
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
      <Placar
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
    render(<Placar publicadas={[linha({ competition: null })]} />);
    expect(screen.getByText('Sem campeonato')).toBeInTheDocument();
  });
});

describe('os avisos do período', () => {
  it('aparecem acima dos números, porque aviso embaixo chega depois da conclusão', () => {
    render(<Placar publicadas={[linha()]} avisos={['a nota está em outra escala']} />);
    const aviso = screen.getByText(/outra escala/i);
    const liquidadas = screen.getByText('Liquidadas');
    // compareDocumentPosition: 4 = o aviso vem ANTES do bloco de números.
    expect(aviso.compareDocumentPosition(liquidadas) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('sem aviso, não sobra moldura de aviso vazia', () => {
    render(<Placar publicadas={[linha()]} />);
    expect(screen.queryByText(/atenção:/i)).not.toBeInTheDocument();
  });
});

describe('o mercado fora da vitrine', () => {
  const OCULTOS = [{ market: 'asian_handicap', oculto_desde: '2026-09-01T00:00:00' }];

  it('aparece na tabela com selo dizendo que está fora', () => {
    render(
      <Placar
        publicadas={[linha({ market: 'asian_handicap', outcome: 'Home', line_value: -1 })]}
        ocultos={OCULTOS}
      />,
    );
    expect(screen.getByText('fora da vitrine')).toBeInTheDocument();
  });

  it('e o mercado que está na tela não ganha selo', () => {
    render(<Placar publicadas={[linha()]} ocultos={OCULTOS} />);
    expect(screen.queryByText('fora da vitrine')).not.toBeInTheDocument();
  });

  it('quando a conta é restrita à vitrine, a tela diz quantas ficaram de fora', () => {
    render(<Placar publicadas={[linha()]} ocultos={OCULTOS} foraDaVitrine={3} />);
    expect(screen.getByText(/3 oportunidades ficaram de fora/i)).toBeInTheDocument();
  });

  it('e não fala disso quando a conta é do board inteiro', () => {
    render(<Placar publicadas={[linha()]} ocultos={OCULTOS} />);
    expect(screen.queryByText(/ficaram de fora/i)).not.toBeInTheDocument();
  });
});

describe('o que dá para dizer de premissa', () => {
  it('diz, antes das tabelas, que isto não é ROI por premissa', () => {
    // É a frase que impede a confusão entre "mais pontos rende mais" e "a
    // premissa X rende mais", que foi o pedido original.
    render(<Placar publicadas={[linha()]} />);
    expect(screen.getByText(/não é ROI por premissa/i)).toBeInTheDocument();
  });

  it('explica por que não dá: a evidência do histórico é reconstruída de hoje', () => {
    render(<Placar publicadas={[linha()]} />);
    expect(screen.getByText(/flags de HOJE/i)).toBeInTheDocument();
  });

  it('mostra as quatro aproximações que existem de verdade', () => {
    render(<Placar publicadas={[linha()]} />);
    expect(screen.getByText('Por pontos de premissa')).toBeInTheDocument();
    expect(screen.getByText('Por premissas sem dado')).toBeInTheDocument();
    expect(screen.getByText('Por corroboração de preço')).toBeInTheDocument();
    expect(screen.getByText('Por penalidade aplicada')).toBeInTheDocument();
  });

  it('e avisa que o teto de pontos é diferente por mercado', () => {
    // Sem esse aviso, a faixa "30 ou mais" parece a mesma coisa em Gols e no
    // Resultado, e ela não é: os tetos são 40 e 30.
    render(<Placar publicadas={[linha()]} />);
    expect(screen.getByText(/teto de pontos é diferente por mercado/i)).toBeInTheDocument();
  });
});

describe('comparando dois períodos', () => {
  const comparacao = (publicadas: LinhaPublicada[]) => ({
    publicadas,
    rotuloDeA: '06/09 a 12/09',
    rotuloDeB: '30/08 a 05/09',
  });

  it('mostra os dois períodos como colunas, com o nome de cada um', () => {
    render(<Placar publicadas={[linha()]} comparacao={comparacao([linha()])} />);
    expect(screen.getAllByText('06/09 a 12/09').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30/08 a 05/09').length).toBeGreaterThan(0);
  });

  it('com base pequena dos dois lados, diz que a diferença é ruído', () => {
    // Um green de um lado e um red do outro: a diferença é enorme e não
    // sustenta nada. Mostrar o número puro convidaria à conclusão.
    render(
      <Placar
        publicadas={[linha(), linha({ outcome: 'Away' })]}
        comparacao={comparacao([linha({ outcome: 'Away' }), linha()])}
      />,
    );
    expect(screen.getAllByText(/dentro do ruído/i).length).toBeGreaterThan(0);
  });

  it('o grupo que só existe num dos lados não ganha diferença', () => {
    render(
      <Placar
        publicadas={[linha({ market: 'btts', outcome: 'Yes' })]}
        comparacao={comparacao([])}
      />,
    );
    const tabela = screen.getByText('Por mercado').closest('section');
    expect(tabela).toHaveTextContent(/sem aposta/i);
  });

  it('sem comparação, a tabela volta a ter uma coluna de números', () => {
    render(<Placar publicadas={[linha()]} />);
    expect(screen.queryByText(/dentro do ruído/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Diferença')).not.toBeInTheDocument();
  });
});
