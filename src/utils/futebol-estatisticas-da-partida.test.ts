import { describe, expect, it } from 'vitest';
import {
  ESCOLHA_PADRAO,
  seriesDaEstatistica,
  type EscolhaDaEstatistica,
} from './futebol-estatisticas-da-partida';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// A série da aba de Estatísticas
// ============================================================================
// Ela desenha ESTATÍSTICA DA PARTIDA, não evidência de premissa. A diferença
// não é de palavra: é ela que autoriza a janela a ser escolhida por quem olha,
// enquanto o gráfico das premissas tem a janela travada pelo modelo.
//
// O que se testa aqui é o observável: dadas as linhas do jogo a jogo e uma
// escolha, quais barras saem e qual média é desenhada.
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
  gols_pro: 1,
  gols_contra: 1,
  total_gols: 2,
  ambos_marcaram: true,
  sem_sofrer: false,
  sem_marcar: false,
  xg: 1.2,
  xg_contra: 1.0,
  resultado: 'E',
  ...over,
});

/** Dez jogos do mandante: os seis mais antigos em casa, os quatro últimos fora. */
const DEZ_DO_MANDANTE: FutebolFixtureHistorico[] = Array.from({ length: 10 }, (_, i) =>
  jogo({
    side: 'home',
    team_id: 1,
    team_name: 'Flamengo',
    past_fixture_id: i + 1,
    ordem: i + 1,
    em_casa: i + 1 <= 6,
    gols_pro: i + 1 <= 6 ? 3 : 0,
    gols_contra: i + 1 <= 6 ? 0 : 2,
  }),
);

const DOIS_DO_VISITANTE: FutebolFixtureHistorico[] = [
  jogo({ side: 'away', team_id: 9, team_name: 'Palmeiras', past_fixture_id: 91, ordem: 1, em_casa: false }),
  jogo({ side: 'away', team_id: 9, team_name: 'Palmeiras', past_fixture_id: 92, ordem: 2, em_casa: false }),
];

const escolha = (over: Partial<EscolhaDaEstatistica> = {}): EscolhaDaEstatistica => ({
  ...ESCOLHA_PADRAO,
  ...over,
});

describe('a série da estatística', () => {
  it('devolve uma série por time do confronto', () => {
    const series = seriesDaEstatistica(escolha(), [...DEZ_DO_MANDANTE, ...DOIS_DO_VISITANTE]);

    expect(series.map((s) => s.teamName)).toEqual(['Flamengo', 'Palmeiras']);
  });

  it('não devolve nada quando o histórico ainda não chegou', () => {
    expect(seriesDaEstatistica(escolha(), undefined)).toEqual([]);
    expect(seriesDaEstatistica(escolha(), [])).toEqual([]);
  });

  it('a janela recorta os jogos mais RECENTES', () => {
    const [flamengo] = seriesDaEstatistica(escolha({ janela: 5 }), DEZ_DO_MANDANTE);

    expect(flamengo.jogos).toHaveLength(5);
    expect(flamengo.jogos.map((j) => j.ordem)).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('a ordem entre a janela e o mando', () => {
  // ⚠️ O teste mais importante deste arquivo.
  //
  // A janela é de JOGOS e o mando recorta DENTRO dela: "os últimos 5 jogos,
  // dos quais 1 em casa". Invertido viraria "os últimos 5 jogos EM CASA", que
  // aqui atravessaria o dobro do histórico e daria outra média inteira.
  //
  // Dos dez jogos do mandante, os seis mais antigos são em casa e os quatro
  // mais recentes são fora. Então nos últimos cinco sobra UM em casa.
  it('recorta a janela primeiro e o mando depois', () => {
    const [flamengo] = seriesDaEstatistica(escolha({ janela: 5, mando: 'proprio' }), DEZ_DO_MANDANTE);

    expect(flamengo.jogos.map((j) => j.ordem)).toEqual([6]);
  });

  it('sem recorte de mando, a janela inteira entra', () => {
    const [flamengo] = seriesDaEstatistica(escolha({ janela: 5, mando: 'todos' }), DEZ_DO_MANDANTE);

    expect(flamengo.jogos).toHaveLength(5);
  });
});

describe('o que cada métrica desenha', () => {
  it('gols marcados, gols sofridos e o total do jogo saem de campos diferentes', () => {
    const umJogo = [jogo({ side: 'home', gols_pro: 3, gols_contra: 1, total_gols: 4 })];

    const gf = seriesDaEstatistica(escolha({ metrica: 'gf' }), umJogo)[0];
    const ga = seriesDaEstatistica(escolha({ metrica: 'ga' }), umJogo)[0];
    const total = seriesDaEstatistica(escolha({ metrica: 'total' }), umJogo)[0];

    expect(gf.jogos[0].valor).toBe(3);
    expect(ga.jogos[0].valor).toBe(1);
    expect(total.jogos[0].valor).toBe(4);
  });

  it('gol esperado ausente vira barra sem dado, e fica fora da média', () => {
    // 9% dos jogos não têm o número. Contá-lo como zero puxaria a média para
    // baixo e a tela afirmaria um valor que a fonte não entregou.
    const dois = [
      jogo({ side: 'home', past_fixture_id: 1, ordem: 1, xg: 2 }),
      jogo({ side: 'home', past_fixture_id: 2, ordem: 2, xg: null }),
    ];

    const [serie] = seriesDaEstatistica(escolha({ metrica: 'xg' }), dois);

    expect(serie.jogos.map((j) => j.valor)).toEqual([2, null]);
    expect(serie.media).toBe(2);
  });

  it('a média é a dos jogos DESENHADOS, não a do histórico inteiro', () => {
    // Os seis antigos marcaram 3 e os quatro recentes marcaram 0. Na janela de
    // 4 a média é 0; no histórico inteiro seria 1,8.
    const [flamengo] = seriesDaEstatistica(escolha({ metrica: 'gf', janela: 4 }), DEZ_DO_MANDANTE);

    expect(flamengo.media).toBe(0);
  });
});

describe('a explicação do gráfico não empresta vocabulário de premissa', () => {
  // A aba de mercados explica o total de gols dizendo "a linha tracejada é a
  // linha que você escolheu" — linha ali é a da aposta. Aqui não há aposta
  // nenhuma escolhida, e repetir aquela frase faria a aba afirmar um conceito
  // que ela não tem.
  it.each(['gf', 'ga', 'total', 'xg'] as const)('em %s, fala de média e não de linha nem de premissa', (metrica) => {
    const [serie] = seriesDaEstatistica(escolha({ metrica }), DEZ_DO_MANDANTE);

    expect(serie.comoLer).toMatch(/média/i);
    expect(serie.comoLer).not.toMatch(/premissa|linha que você|aposta/i);
  });
});
