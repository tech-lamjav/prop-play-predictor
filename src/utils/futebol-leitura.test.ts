import { describe, it, expect } from 'vitest';
import { resumoDosMercados, melhorLeitura, sufixoDeLeitura } from './futebol-leitura';
import type { FutebolFixturePremissas, FutebolFixtureValueRow } from '@/services/futebol-data.service';

// O caso é o Independ. Rivadavia x Fluminense (fixture 1547770, staging): o mart
// cotou UMA saída de gols, Mais de 1,5, Score 54 — e é ela que Oportunidades
// mostra. Nas premissas, quem tem mais linhas acesas é Menos de 4,5.
//
// A tela do jogo tirava o RÓTULO das premissas e os NÚMEROS do preço, então dizia
// "Menos de 4,5 gols" com a chance, a odd e o Score do "Mais de 1,5 gols" — e o
// botão de registrar gravava o Mais de 1,5 que o usuário nunca leu.

const prem = (outcome: string, line: number | null, acesas: string[]): FutebolFixturePremissas => ({
  market: 'goals_over_under',
  outcome,
  line_value: line,
  pts_premissas: 0,
  penalidades_pts: 0,
  acesas,
  apagadas: [],
  penalidades: [],
});

// Tipado de verdade, sem `as`: assim, campo novo obrigatório na RPC quebra o teste
// aqui em vez de chegar `undefined` na tela.
const VALUE_BASE: FutebolFixtureValueRow = {
  market: 'goals_over_under',
  outcome: 'Over',
  outcome_order: 1,
  line_value: 1.5,
  edge: 0.0088,
  best_odd: 1.65,
  best_book: 'bet365',
  avg_odd: 1.6,
  n_casas: 5,
  janela_usada: 'fechamento',
  prob_justa_fechamento: 0.6114,
  score_versao: 'legacy',
  pts_valor: 20,
  pts_premissas: 34,
  pts_corroboracao: 0,
  penalidades: 0,
  penalidades_globais_pts: 0,
  penalidades_especificas_pts: 0,
  score: 54,
  faixa: 'media',
  modelo_api_concorda: true,
  linha_sharp_confirma: false,
  evidencias: [],
  avisos: [],
  contras: [],
  premissas_sem_dado: 0,
};

const value = (
  outcome: string,
  line: number | null,
  score: number,
  faixa = 'Média',
): FutebolFixtureValueRow => ({
  ...VALUE_BASE,
  outcome,
  line_value: line,
  score,
  faixa,
});

const OVER_15 = ['defesas_vazaveis', 'ataque_combinado', 'xg_combinado_alto'];
const UNDER_45 = ['defesas_firmes', 'xg_baixo_combinado', 'ataques_fracos', 'historico_under'];

const rows = [prem('Over', 1.5, OVER_15), prem('Under', 4.5, UNDER_45)];

const gols = (r: ReturnType<typeof resumoDosMercados>) => r.find((x) => x.mercado.slug === 'goals_over_under')!;

describe('resumoDosMercados', () => {
  it('com preço, quem representa o mercado é a saída que tem preço', () => {
    const g = gols(resumoDosMercados(rows, [value('Over', 1.5, 54)]));
    expect(g.candidato.outcome).toBe('Over');
    expect(g.candidato.line_value).toBe(1.5);
    expect(g.value?.score).toBe(54);
  });

  it('as premissas contadas são as da saída que tem preço', () => {
    const g = gols(resumoDosMercados(rows, [value('Over', 1.5, 54)]));
    expect(g.nValem).toBe(OVER_15.length);
  });

  it('entre duas saídas com preço, vale a de maior Score', () => {
    const g = gols(resumoDosMercados(rows, [value('Over', 1.5, 54), value('Under', 4.5, 61)]));
    expect(g.candidato.outcome).toBe('Under');
    expect(g.value?.score).toBe(61);
  });

  it('empate de Score não troca a saída no meio do caminho', () => {
    const a = gols(resumoDosMercados(rows, [value('Over', 1.5, 50), value('Under', 4.5, 50)]));
    const b = gols(resumoDosMercados(rows, [value('Under', 4.5, 50), value('Over', 1.5, 50)]));
    expect(a.candidato.outcome).toBe(b.candidato.outcome);
  });

  it('sem preço nenhum, volta a mandar a saída com mais premissas', () => {
    const g = gols(resumoDosMercados(rows, []));
    expect(g.candidato.outcome).toBe('Under');
    expect(g.candidato.line_value).toBe(4.5);
    expect(g.value).toBeNull();
  });

  it('preço de uma saída sem premissa não empresta o número para outra saída', () => {
    const g = gols(resumoDosMercados(rows, [value('Over', 2.5, 71)]));
    expect(g.candidato.outcome).toBe('Under');
    expect(g.value).toBeNull();
  });

  it('casa a linha mesmo com a folga de float entre as duas RPCs', () => {
    const g = gols(resumoDosMercados(rows, [value('Over', 1.5000001, 54)]));
    expect(g.value?.score).toBe(54);
    expect(g.candidato.outcome).toBe('Over');
  });

  it('mercado sem linha (1X2) casa por saída, com line_value nulo', () => {
    const semLinha = [
      { ...prem('Home', null, ['forma', 'mando']), market: 'match_winner' },
      { ...prem('Away', null, ['superioridade_xg']), market: 'match_winner' },
    ];
    const v: FutebolFixtureValueRow = { ...VALUE_BASE, market: 'match_winner', outcome: 'Away', line_value: null, score: 58 };
    const r = resumoDosMercados(semLinha, [v]).find((x) => x.mercado.slug === 'match_winner')!;
    expect(r.candidato.outcome).toBe('Away');
    expect(r.value?.score).toBe(58);
  });

  it('destaca pela faixa que o backend publicou, não por régua local', () => {
    // A régua de 40 saiu na virada do Score de contexto (spec #301). Um Score
    // baixo em faixa Média continua sendo destaque, e um Score alto em faixa
    // Baixa não é: quem classifica é o backend.
    expect(gols(resumoDosMercados(rows, [value('Over', 1.5, 54, 'Alta')])).passa).toBe(true);
    expect(gols(resumoDosMercados(rows, [value('Over', 1.5, 31, 'Média')])).passa).toBe(true);
    expect(gols(resumoDosMercados(rows, [value('Over', 1.5, 54, 'Baixa')])).passa).toBe(false);
  });
});

// Oportunidades lista uma linha por SAÍDA, não por mercado: no board de staging,
// 18 dos 104 pares (jogo, mercado) têm duas ou mais saídas cotadas. Sem levar qual
// card foi clicado, abrir o de Score menor caía no de Score maior.
describe('resumoDosMercados com a saída clicada', () => {
  const doisPrecos = [value('Over', 1.5, 54), value('Under', 4.5, 61)];

  it('a saída clicada ganha do maior Score do mercado', () => {
    const g = gols(resumoDosMercados(rows, doisPrecos, { market: 'goals_over_under', outcome: 'Over', line_value: 1.5 }));
    expect(g.candidato.outcome).toBe('Over');
    expect(g.value?.score).toBe(54);
  });

  it('sem a saída clicada, segue mandando o maior Score', () => {
    const g = gols(resumoDosMercados(rows, doisPrecos, null));
    expect(g.candidato.outcome).toBe('Under');
    expect(g.value?.score).toBe(61);
  });

  it('saída clicada de OUTRO mercado não mexe neste', () => {
    const g = gols(resumoDosMercados(rows, doisPrecos, { market: 'match_winner', outcome: 'Home', line_value: null }));
    expect(g.candidato.outcome).toBe('Under');
  });

  it('link apontando para saída que não existe mais cai no maior Score, não em nada', () => {
    const g = gols(resumoDosMercados(rows, doisPrecos, { market: 'goals_over_under', outcome: 'Over', line_value: 9.5 }));
    expect(g.candidato.outcome).toBe('Under');
    expect(g.value?.score).toBe(61);
  });
});

// Handicap zero nunca acende premissa, e a régua da folha não lista essa parada. Um
// handicap zero COTADO virava o representante do mercado e a folha abria fora da
// régua: o mesmo bug de linha errada, por outra porta.
describe('handicap zero', () => {
  const ah = (outcome: string, line: number | null, acesas: string[]) => ({
    ...prem(outcome, line, acesas),
    market: 'asian_handicap',
  });
  const ahValue = (outcome: string, line: number | null, score: number): FutebolFixtureValueRow => ({
    ...VALUE_BASE,
    market: 'asian_handicap',
    outcome,
    line_value: line,
    score,
  });

  it('linha zero não representa o mercado, mesmo tendo o maior Score', () => {
    const linhas = [ah('Home', 0, []), ah('Home', -0.5, ['supremacia', 'tende_golear'])];
    const r = resumoDosMercados(linhas, [ahValue('Home', 0, 70), ahValue('Home', -0.5, 44)])
      .find((x) => x.mercado.slug === 'asian_handicap')!;
    expect(r.candidato.line_value).toBe(-0.5);
    expect(r.value?.score).toBe(44);
  });
});

describe('melhorLeitura', () => {
  it('o rótulo do hero e o Score do hero saem da MESMA saída', () => {
    const top = melhorLeitura(resumoDosMercados(rows, [value('Over', 1.5, 54)]))!;
    expect(top.candidato.outcome).toBe('Over');
    expect(top.candidato.line_value).toBe(top.value!.line_value);
    expect(top.candidato.outcome).toBe(top.value!.outcome);
  });
});

describe('sufixoDeLeitura', () => {
  it('não afirma um total enquanto o board não respondeu', () => {
    // Zero aqui seria a mesma mentira que "sem leitura ainda" na linha: a tela
    // ainda não tem do que contar.
    expect(sufixoDeLeitura(true, 0)).toBe('');
    expect(sufixoDeLeitura(true, 3)).toBe('');
  });

  it('conta depois que o board respondeu, inclusive quando o total é zero', () => {
    expect(sufixoDeLeitura(false, 0)).toBe(' · 0 com leitura');
    expect(sufixoDeLeitura(false, 2)).toBe(' · 2 com leitura');
  });
});
