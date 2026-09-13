import { describe, expect, it } from 'vitest';
import { liquidarTudo, type LinhaPublicada } from './placar-agregacao';
import { matriz, ordenadoPeloEstrago, ordenarPor } from './placar-matriz';
import { QUEBRAS } from './placar-quebras';
import { FAIXAS_DO_SCORE } from './placar-agregacao';

const porMercado = QUEBRAS.find((q) => q.titulo === 'Por mercado')!;
const porFaixa = QUEBRAS.find((q) => q.titulo === 'Por faixa de Score')!;

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

const montar = (publicadas: LinhaPublicada[]) => liquidarTudo(publicadas).liquidadas;

describe('as colunas', () => {
  it('saem das apostas, em ordem cronológica', () => {
    const m = matriz(
      montar([
        linha({ kickoff_utc: '2026-09-15T23:00:00' }),
        linha({ kickoff_utc: '2026-09-08T23:00:00' }),
      ]),
      porMercado,
      'semana',
      'jogo',
    );
    expect(m.gavetas.map((g) => g.chave)).toEqual(['2026-09-07', '2026-09-14']);
  });

  it('e não vêm de um calendário: semana sem aposta não vira coluna de traços', () => {
    // Com trinta dias na tela, coluna vazia é a maior parte da largura.
    const m = matriz(
      montar([
        linha({ kickoff_utc: '2026-09-08T23:00:00' }),
        linha({ kickoff_utc: '2026-09-22T23:00:00' }),
      ]),
      porMercado,
      'semana',
      'jogo',
    );
    expect(m.gavetas.map((g) => g.chave)).toEqual(['2026-09-07', '2026-09-21']);
  });
});

describe('as células', () => {
  const liquidadas = montar([
    linha({ kickoff_utc: '2026-09-08T23:00:00' }),
    linha({ kickoff_utc: '2026-09-08T23:00:00', outcome: 'Away' }),
    linha({ kickoff_utc: '2026-09-15T23:00:00' }),
  ]);

  it('guardam o número e as linhas que o formaram', () => {
    // É o que permite abrir a célula. Sem as linhas, a matriz mostra onde doeu
    // e não diz por quê.
    const m = matriz(liquidadas, porMercado, 'semana', 'jogo');
    const celula = m.linhas[0].porGaveta['2026-09-07'];
    expect(celula.celula.n).toBe(2);
    expect(celula.linhas).toHaveLength(2);
  });

  it('gaveta sem aposta não tem célula', () => {
    const m = matriz(liquidadas, porMercado, 'dia', 'jogo');
    expect(m.linhas[0].porGaveta['2026-09-09']).toBeUndefined();
  });

  it('e o total da linha soma o período inteiro', () => {
    const m = matriz(liquidadas, porMercado, 'semana', 'jogo');
    expect(m.linhas[0].total.celula.n).toBe(3);
    expect(m.linhas[0].total.linhas).toHaveLength(3);
  });
});

describe('a ordem das linhas', () => {
  it('segue a escala quando a quebra é ordinal', () => {
    const m = matriz(
      montar([linha({ score: 85 }), linha({ score: 20 }), linha({ score: 20 })]),
      porFaixa,
      'semana',
      'jogo',
    );
    expect(m.linhas.map((l) => l.chave)).toEqual([FAIXAS_DO_SCORE[0], FAIXAS_DO_SCORE[3]]);
  });

  it('e o tamanho da base quando não é', () => {
    const m = matriz(
      montar([
        linha({ market: 'btts', outcome: 'Yes' }),
        linha({ market: 'match_winner' }),
        linha({ market: 'match_winner' }),
      ]),
      porMercado,
      'semana',
      'jogo',
    );
    expect(m.linhas.map((l) => l.chave)).toEqual(['match_winner', 'btts']);
  });
});

describe('o que puxou a célula', () => {
  it('vem do pior para o melhor, e a odd mais alta desempata', () => {
    // Quem clica numa célula vermelha procura o que deu errado: a primeira
    // linha da lista tem de ser a resposta.
    const liquidadas = montar([
      linha({ best_odd: 2, goals_home: 2, goals_away: 0 }), // green, +1
      linha({ best_odd: 3, outcome: 'Away' }), // red, -1, odd 3
      linha({ best_odd: 2, outcome: 'Away' }), // red, -1, odd 2
    ]);
    const ordenado = ordenadoPeloEstrago(liquidadas);
    expect(ordenado.map((l) => l.lucro)).toEqual([-1, -1, 1]);
    expect(ordenado[0].linha.best_odd).toBe(3);
  });
});

describe('a ordenação do drill', () => {
  const amostra = montar([
    linha({ score: 76, best_odd: 1.57, goals_home: 1, goals_away: 0, outcome: 'Away' }),
    linha({ score: 44, best_odd: 2.45, goals_home: 2, goals_away: 0 }),
    linha({ score: 52, best_odd: 1.55, goals_home: 2, goals_away: 0, outcome: 'Away' }),
  ]);

  it('por Score, do menor para o maior', () => {
    expect(ordenarPor(amostra, 'score', false).map((l) => l.linha.score)).toEqual([44, 52, 76]);
  });

  it('e do maior para o menor quando se clica de novo', () => {
    expect(ordenarPor(amostra, 'score', true).map((l) => l.linha.score)).toEqual([76, 52, 44]);
  });

  it('por odd', () => {
    expect(ordenarPor(amostra, 'odd', false).map((l) => l.linha.best_odd)).toEqual([
      1.55, 1.57, 2.45,
    ]);
  });

  it('por lucro, que é o padrão: o pior primeiro', () => {
    const lucros = ordenarPor(amostra, 'lucro', false).map((l) => l.lucro);
    expect(lucros[0]).toBeLessThanOrEqual(lucros[1]);
  });

  it('o desempate é sempre o lucro, para a pior da faixa vir na frente', () => {
    const mesmaNota = montar([
      linha({ score: 50, best_odd: 2, goals_home: 2, goals_away: 0 }),
      linha({ score: 50, best_odd: 2, goals_home: 2, goals_away: 0, outcome: 'Away' }),
    ]);
    expect(ordenarPor(mesmaNota, 'score', false)[0].lucro).toBeLessThan(0);
  });
});
