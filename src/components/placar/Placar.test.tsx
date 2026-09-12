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
