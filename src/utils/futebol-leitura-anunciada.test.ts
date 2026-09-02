import { describe, it, expect } from 'vitest';
import { resumoDosMercados, candidatoQueAbreAFolha } from './futebol-leitura';
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

  it('a folha de detalhe abre NA MESMA saída do card', () => {
    // A invariante que o defeito quebrou. Antes a folha preferia uma candidata
    // cotada e abria em Over 0,5 enquanto o card ao lado dizia Under 3,25.
    const [gols] = resumoDosMercados(ROWS, SEM_PRECO, null, SEM_OCULTOS);
    const abre = candidatoQueAbreAFolha(gols);

    expect(abre).not.toBeNull();
    expect(`${abre!.outcome} ${abre!.line_value}`).toBe(
      `${gols.candidato.outcome} ${gols.candidato.line_value}`,
    );
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
    expect(candidatoQueAbreAFolha(gols)?.line_value).toBe(2.5);
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
