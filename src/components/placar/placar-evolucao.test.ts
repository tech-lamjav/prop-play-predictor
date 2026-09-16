import { describe, expect, it } from 'vitest';
import { liquidarTudo, type LinhaPublicada } from './placar-agregacao';
import {
  abrirGaveta,
  gavetaDe,
  granularidadeAbaixo,
  granularidadesDe,
  inicioDaSemana,
  janelaDaGaveta,
  mercadosPresentes,
  rotuloDaGaveta,
  serie,
} from './placar-evolucao';

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
  detectada_em: '2026-09-09T03:00:00',
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

describe('a semana', () => {
  it('começa na segunda, como a rodada', () => {
    // 10/09/2026 é uma quinta. A semana dela começa na segunda, 07/09, e é isso
    // que mantém sábado e domingo da mesma rodada na mesma barra.
    expect(inicioDaSemana('2026-09-10')).toBe('2026-09-07');
    expect(inicioDaSemana('2026-09-07')).toBe('2026-09-07');
    expect(inicioDaSemana('2026-09-13')).toBe('2026-09-07');
    expect(inicioDaSemana('2026-09-14')).toBe('2026-09-14');
  });
});

describe('a gaveta', () => {
  it('é o dia, a segunda da semana ou o mês', () => {
    expect(gavetaDe('2026-09-10', 'dia')).toBe('2026-09-10');
    expect(gavetaDe('2026-09-10', 'semana')).toBe('2026-09-07');
    expect(gavetaDe('2026-09-10', 'mes')).toBe('2026-09');
  });

  it('e o rótulo cabe embaixo da barra', () => {
    expect(rotuloDaGaveta('2026-09', 'mes')).toBe('set/26');
    expect(rotuloDaGaveta('2026-09-07', 'semana')).toBe('07/09');
    expect(rotuloDaGaveta('2026-09-10', 'dia')).toBe('10/09');
  });
});

describe('as granularidades que o período sustenta', () => {
  it('sem dois meses, não oferece mês — uma barra só não é série', () => {
    expect(granularidadesDe({ de: '2026-09-04', ate: '2026-09-12' })).toEqual(['semana', 'dia']);
  });

  it('cruzando dois meses, oferece mês', () => {
    expect(granularidadesDe({ de: '2026-08-20', ate: '2026-09-12' })).toEqual([
      'mes',
      'semana',
      'dia',
    ]);
  });

  it('período curto só tem dia', () => {
    expect(granularidadesDe({ de: '2026-09-10', ate: '2026-09-12' })).toEqual(['dia']);
  });

  it('o degrau de baixo é mês, semana, dia — e o dia não abre mais nada', () => {
    expect(granularidadeAbaixo('mes')).toBe('semana');
    expect(granularidadeAbaixo('semana')).toBe('dia');
    expect(granularidadeAbaixo('dia')).toBeNull();
  });
});

describe('a janela de uma gaveta', () => {
  it('do dia é o próprio dia', () => {
    expect(janelaDaGaveta('2026-09-10', 'dia')).toEqual({ de: '2026-09-10', ate: '2026-09-10' });
  });

  it('da semana é segunda a domingo', () => {
    expect(janelaDaGaveta('2026-09-07', 'semana')).toEqual({
      de: '2026-09-07',
      ate: '2026-09-13',
    });
  });

  it('do mês vai até o último dia dele, inclusive em fevereiro', () => {
    expect(janelaDaGaveta('2026-09', 'mes')).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(janelaDaGaveta('2026-02', 'mes')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
  });
});

describe('a série', () => {
  const { liquidadas } = liquidarTudo([
    linha({ kickoff_utc: '2026-09-08T23:00:00' }),
    linha({ kickoff_utc: '2026-09-10T23:00:00', outcome: 'Away' }),
    linha({ kickoff_utc: '2026-09-15T23:00:00', market: 'btts', outcome: 'Yes' }),
  ]);

  it('agrupa por gaveta e sai em ordem cronológica', () => {
    const pontos = serie(liquidadas, 'semana', 'jogo');
    expect(pontos.map((p) => p.chave)).toEqual(['2026-09-07', '2026-09-14']);
    expect(pontos[0].total.n).toBe(2);
    expect(pontos[1].total.n).toBe(1);
  });

  it('por dia, cada jogo na sua barra', () => {
    const pontos = serie(liquidadas, 'dia', 'jogo');
    expect(pontos.map((p) => p.chave)).toEqual(['2026-09-08', '2026-09-10', '2026-09-15']);
  });

  it('gaveta sem aposta não vira barra de zero', () => {
    // 09/09 não teve jogo liquidado. Uma barra de zero ali leria como ROI zero,
    // que é outra coisa — o buraco é a informação.
    const pontos = serie(liquidadas, 'dia', 'jogo');
    expect(pontos.map((p) => p.chave)).not.toContain('2026-09-09');
  });

  it('respeita o eixo: por detecção as gavetas mudam', () => {
    const pontos = serie(liquidadas, 'dia', 'deteccao');
    expect(pontos.map((p) => p.chave)).toEqual(['2026-09-09']);
  });

  it('filtra por mercado quando a tela pede', () => {
    const pontos = serie(liquidadas, 'semana', 'jogo', ['btts']);
    expect(pontos).toHaveLength(1);
    expect(pontos[0].total.n).toBe(1);
  });

  it('e quebra a gaveta por mercado, para a barra empilhada', () => {
    const pontos = serie(liquidadas, 'mes', 'jogo');
    expect(pontos).toHaveLength(1);
    expect(Object.keys(pontos[0].porMercado).sort()).toEqual(['btts', 'match_winner']);
    expect(pontos[0].porMercado.match_winner.n).toBe(2);
  });
});

describe('abrir uma gaveta', () => {
  it('devolve a janela, o rótulo, o degrau que abre e o de volta', () => {
    // As três contas juntas num lugar só: espalhadas no JSX de quem chamava,
    // elas eram a única parte da regra sem onde ser provada.
    expect(abrirGaveta('2026-09-07', 'semana')).toEqual({
      janela: { de: '2026-09-07', ate: '2026-09-13' },
      rotulo: '07/09',
      degrau: 'dia',
      volta: 'semana',
    });
  });

  it('não abre o dia, que é o último degrau', () => {
    // Null aqui é o que impede a tela de trocar a janela por uma igual e ainda
    // pedir um degrau abaixo que não existe.
    expect(abrirGaveta('2026-09-07', 'dia')).toBeNull();
  });
});

describe('os mercados presentes', () => {
  it('vêm da base maior para a menor', () => {
    const { liquidadas } = liquidarTudo([
      linha({ market: 'btts', outcome: 'Yes' }),
      linha({ market: 'match_winner' }),
      linha({ market: 'match_winner' }),
    ]);
    expect(mercadosPresentes(liquidadas)).toEqual(['match_winner', 'btts']);
  });
});
