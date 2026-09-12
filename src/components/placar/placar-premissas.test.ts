import { describe, expect, it } from 'vitest';
import type { LinhaPublicada } from './placar-agregacao';
import {
  faixaDePontos,
  faixaSemDado,
  grupoDeCorroboracao,
  grupoDePenalidade,
} from './placar-premissas';

const linha = (p: Partial<LinhaPublicada> = {}): LinhaPublicada =>
  ({
    opportunity_key: 'k',
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
    modelo_api_concorda: false,
    linha_sharp_confirma: false,
    pen_odd_outlier: false,
    pen_poucas_casas: false,
    pen_odd_longshot: false,
    pen_odd_juice: false,
    ...p,
  }) satisfies LinhaPublicada;

describe('faixa de pontos de premissa', () => {
  it('muda nos limites', () => {
    expect(faixaDePontos(0)).toBe('0 a 9');
    expect(faixaDePontos(9)).toBe('0 a 9');
    expect(faixaDePontos(10)).toBe('10 a 19');
    expect(faixaDePontos(29)).toBe('20 a 29');
    expect(faixaDePontos(30)).toBe('30 ou mais');
    expect(faixaDePontos(40)).toBe('30 ou mais');
  });
});

describe('faixa de premissas sem dado', () => {
  it('separa nenhuma, uma, duas e o resto', () => {
    expect(faixaSemDado(0)).toBe('Nenhuma');
    expect(faixaSemDado(1)).toBe('Uma');
    expect(faixaSemDado(2)).toBe('Duas');
    expect(faixaSemDado(3)).toBe('Três ou mais');
    expect(faixaSemDado(7)).toBe('Três ou mais');
  });
});

describe('grupo de corroboração', () => {
  it('cada aposta cai em um grupo só', () => {
    // Uma tabela com os dois sinais como linhas soltas contaria a mesma aposta
    // duas vezes, e a soma dos denominadores passaria do total.
    expect(
      grupoDeCorroboracao(linha({ modelo_api_concorda: true, linha_sharp_confirma: true })),
    ).toBe('Modelo e sharp');
    expect(
      grupoDeCorroboracao(linha({ modelo_api_concorda: true, linha_sharp_confirma: false })),
    ).toBe('Só o modelo');
    expect(
      grupoDeCorroboracao(linha({ modelo_api_concorda: false, linha_sharp_confirma: true })),
    ).toBe('Só o sharp');
    expect(grupoDeCorroboracao(linha())).toBe('Nenhum dos dois');
  });

  it('nulo conta como não acendeu, e não como grupo próprio', () => {
    // A coluna do mart não tem nulo hoje, mas ela já teve: premissa sem dado
    // virava `false` em silêncio. Um grupo "não sei" com uma aposta dentro
    // sujaria a tabela sem informar nada.
    expect(
      grupoDeCorroboracao(linha({ modelo_api_concorda: null, linha_sharp_confirma: null })),
    ).toBe('Nenhum dos dois');
  });
});

describe('grupo de penalidade', () => {
  it('sem flag nenhuma, é sem penalidade', () => {
    expect(grupoDePenalidade(linha())).toBe('Sem penalidade');
  });

  it('com uma flag, é o nome dela', () => {
    expect(grupoDePenalidade(linha({ pen_odd_outlier: true }))).toBe('Só uma casa paga');
    expect(grupoDePenalidade(linha({ pen_odd_longshot: true }))).toBe('Odd de zebra');
    expect(grupoDePenalidade(linha({ pen_poucas_casas: true }))).toBe('Poucas casas');
    expect(grupoDePenalidade(linha({ pen_odd_juice: true }))).toBe('Odd baixa');
  });

  it('com duas ou mais, é um grupo só — senão a aposta entraria em duas linhas', () => {
    expect(grupoDePenalidade(linha({ pen_odd_outlier: true, pen_poucas_casas: true }))).toBe(
      'Mais de uma',
    );
  });
});
