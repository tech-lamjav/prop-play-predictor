import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resumoDosMercados, saidaQueAbreAFolha, melhorLeitura } from './futebol-leitura';
import { melhorCandidato } from './futebol-premissas';
import type { FutebolFixturePremissas } from '@/services/futebol-data.service';

// ============================================================================
// Sem oportunidade, a tela abre no que ela anuncia (issue #346)
// ============================================================================
// Flamengo × Mirassol, 02/09/2026, fixture 1492145. O jogo não tinha preço
// coletado. O painel de resumo anunciava "Menos de 3,25 gols"; o card do mercado
// dentro da tela do jogo repetia "Menos de 3,25 gols · sem cotação"; e a folha de
// detalhe, ao lado do card, abria em "Mais de 0,5 gols", odd 1.03.
//
// Três lugares, duas respostas — duas delas na mesma tela, lado a lado.
//
// A causa era um degrau que preferia QUALQUER candidata cotada à leitura
// anunciada, desempatando pela MENOR linha. Em gols a menor linha é sempre
// "Mais de 0,5", a mais verdadeira e mais inútil do mercado. Não era borda:
// acontecia em todo jogo sem oportunidade, que é a maioria dos jogos.
// ============================================================================

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

// O caso real: a leitura forte é o Under 3,25, e existe um Over 0,5 cotado que
// não diz nada. As três premissas do Under são as que o painel mostrava.
const DEFESAS = ['defesas_firmes', 'xg_baixo_combinado', 'historico_under'];
const ROWS = [
  prem('Under', 3.25, DEFESAS),
  prem('Over', 0.5, ['ataques_fracos']),
  prem('Over', 2.5, []),
];

const SEM_PRECO = null;
const SEM_OCULTOS: string[] = [];

describe('a leitura anunciada, sem preço nenhum', () => {
  it('o card do mercado nomeia a saída com mais premissas', () => {
    const [gols] = resumoDosMercados(ROWS, SEM_PRECO, null, SEM_OCULTOS);
    expect(gols.candidato.outcome).toBe('Under');
    expect(gols.candidato.line_value).toBe(3.25);
    expect(gols.value).toBeNull();
  });

  it('a folha de detalhe abre na saída anunciada, e não numa cotada qualquer', () => {
    // O caso concreto do defeito: existe um Over 0,5 na lista, e antes era ELE
    // que abria a folha por ter cotação, enquanto o card ao lado dizia
    // Under 3,25. O teste afirma o valor esperado, e não `=== resumo.candidato`
    // — comparar a função com a propriedade que ela devolve não falha nunca.
    const [gols] = resumoDosMercados(ROWS, SEM_PRECO, null, SEM_OCULTOS);
    const abre = saidaQueAbreAFolha(gols);

    expect(`${abre?.outcome} ${abre?.line_value}`).toBe('Under 3.25');
  });

  it('a saída do link vence, mesmo sem preço', () => {
    // Vindo do painel de resumo de um jogo sem oportunidade, o link carrega a
    // leitura que a pessoa estava lendo. Antes a preferência só era consultada
    // entre linhas COM preço, então ela sumia justamente neste caso.
    const [gols] = resumoDosMercados(
      ROWS,
      SEM_PRECO,
      { market: 'goals_over_under', outcome: 'Over', line_value: 2.5 },
      SEM_OCULTOS,
    );

    expect(gols.candidato.outcome).toBe('Over');
    expect(gols.candidato.line_value).toBe(2.5);
    expect(saidaQueAbreAFolha(gols)?.line_value).toBe(2.5);
  });

  it('link apontando para saída que não existe cai na leitura anunciada', () => {
    const [gols] = resumoDosMercados(
      ROWS,
      SEM_PRECO,
      { market: 'goals_over_under', outcome: 'Over', line_value: 9.5 },
      SEM_OCULTOS,
    );
    expect(gols.candidato.line_value).toBe(3.25);
  });
});

describe('melhorCandidato com preferência', () => {
  it('sem preferência, manda a contagem de premissas', () => {
    expect(melhorCandidato(ROWS, 'goals_over_under')?.line_value).toBe(3.25);
  });

  it('com preferência que casa, ela vence a contagem', () => {
    const c = melhorCandidato(ROWS, 'goals_over_under', {
      market: 'goals_over_under',
      outcome: 'Over',
      line_value: 0.5,
    });
    expect(`${c?.outcome} ${c?.line_value}`).toBe('Over 0.5');
  });

  it('preferência de outro mercado é ignorada', () => {
    const c = melhorCandidato(ROWS, 'goals_over_under', {
      market: 'match_winner',
      outcome: 'Home',
      line_value: null,
    });
    expect(c?.line_value).toBe(3.25);
  });
});

// A invariante de verdade mora entre dois arquivos: o card do mercado nomeia
// `resumo.candidato`, e a folha precisa abrir na mesma saída. Um teste de
// unidade não alcança isso — a folha é estado de componente.
//
// Esta guarda é modesta de propósito, e é bom dizer o que ela NÃO faz: ela não
// impede que alguém volte a calcular a saída por outro caminho. Uma tentativa de
// proibir o padrão antigo por regex reprovou código legítimo — `candidataCotada`
// existe no arquivo como variável local de outra coisa, e `estado === 'cotada'`
// aparece em quatro lugares corretos. Guarda que acusa código certo é pior que
// guarda nenhuma: ensina a contornar.
//
// O que ela garante é o mínimo verdadeiro: a Bancada continua consultando a
// decisão compartilhada em vez de ter a sua.
describe('a Bancada usa a decisão compartilhada', () => {
  it('chama saidaQueAbreAFolha', () => {
    const bancada = readFileSync(
      resolve(__dirname, '../components/futebol/BancadaMercados.tsx'),
      'utf8',
    );
    expect(bancada).toContain('saidaQueAbreAFolha(');
  });
});

describe('o desempate não é mais a menor linha', () => {
  // O defeito nascia do desempate: entre candidatas equivalentes, a menor linha
  // vencia, e em gols a menor é sempre a mais inútil. Aqui as três empatam em
  // premissas de propósito — sem empate, o teste não exercita o desempate.
  const EMPATADAS = [
    prem('Over', 0.5, ['ataque_combinado']),
    prem('Over', 2.5, ['ataque_combinado']),
    prem('Over', 5.5, ['ataque_combinado']),
  ];

  it('empatadas, ganha a linha que o mercado de fato negocia', () => {
    // Desempate por distância da linha central do mercado de gols, não por
    // ordem crescente. "Mais de 0,5" só venceria de novo se o critério voltasse
    // a ser a menor.
    expect(melhorCandidato(EMPATADAS, 'goals_over_under')?.line_value).toBe(2.5);
  });

  it('e a folha abre nela também', () => {
    const [gols] = resumoDosMercados(EMPATADAS, SEM_PRECO, null, SEM_OCULTOS);
    expect(saidaQueAbreAFolha(gols)?.line_value).toBe(2.5);
  });
});

describe('os três lugares nomeiam a mesma saída', () => {
  // A coerência que o defeito quebrou, percorrida pelos caminhos reais de cada
  // tela: o painel de resumo usa `melhorLeitura`, o card usa `resumoDosMercados`
  // e a folha usa `saidaQueAbreAFolha`. Antes os dois primeiros diziam
  // "Menos de 3,25" e o terceiro dizia "Mais de 0,5".
  it('painel de resumo, card do mercado e folha de detalhe', () => {
    const resumos = resumoDosMercados(ROWS, SEM_PRECO, null, SEM_OCULTOS);
    const doPainel = melhorLeitura(resumos);
    const doCard = resumos.find((r) => r.mercado.slug === 'goals_over_under');
    const daFolha = saidaQueAbreAFolha(doCard);

    const nome = (o: string | undefined, l: number | null | undefined) => `${o} ${l}`;
    expect(nome(doPainel?.candidato.outcome, doPainel?.candidato.line_value)).toBe('Under 3.25');
    expect(nome(doCard?.candidato.outcome, doCard?.candidato.line_value)).toBe('Under 3.25');
    expect(nome(daFolha?.outcome, daFolha?.line_value)).toBe('Under 3.25');
  });
});
