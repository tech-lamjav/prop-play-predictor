import { describe, expect, it } from 'vitest';
import { SPECS } from './futebol-historico';
import { BUILDERS } from './futebol-evidencias';
import { MERCADOS } from './futebol-premissas';

// ============================================================================
// Os dois mapas de evidência são indexados por MERCADO e slug (#361)
// ============================================================================
// A porta única da evidência tem quatro degraus, e dois deles consultam um mapa
// indexado por premissa: o gráfico jogo a jogo (`SPECS`) e a frase do perfil de
// temporada (`BUILDERS`). Os dois eram indexados só pelo slug.
//
// O mesmo slug existe em dois mercados. `defesas_vazaveis` em Gols é a soma das
// médias de gols sofridos contra a linha; em Ambos marcam é o percentual de
// clean sheet de cada time contra 35. Com o slug sozinho, a do Ambos marcam
// recebia as duas coisas do mercado de Gols — gráfico e frase — sem ninguém
// escrever isso em lugar nenhum. A #361 chama essa colisão de estrutural e põe o
// conserto do seam como PRÉ-REQUISITO do resto.
//
// ⚠️ Rechavear cria um modo de falha novo: escrever o mercado errado numa chave
// não dá erro nenhum. A premissa simplesmente para de ter gráfico, ou para de
// ter frase, em silêncio. Estas guardas existem por causa disso, e é por isso
// que elas nascem no mesmo commit do rechaveamento.
//
// São DUAS por mapa, e as duas são necessárias:
//
//   · a de chave forasteira pega o mercado errado;
//   · a de cobertura pega a chave APAGADA — e ela conta a partir do CATÁLOGO,
//     não do mapa. Uma guarda que lê o próprio mapa nunca acusa uma remoção: a
//     lista encolhe junto e a comparação continua fechando consigo mesma.
//
// Mexer nas listas abaixo é decisão de produto: alguém ganhou ou perdeu o jogo a
// jogo, ou a frase. É para elas reprovarem e a mudança ser explicada no commit.
// ============================================================================

const paresDoCatalogo = () =>
  new Set(MERCADOS.flatMap((m) => m.premissas.map((p) => `${m.slug}:${p.slug}`)));

/** Os pares do catálogo que o mapa atende, na ordem em que o catálogo os declara. */
const atendidosPor = (mapa: Record<string, unknown>) =>
  MERCADOS.flatMap((m) => m.premissas.map((p) => `${m.slug}:${p.slug}`).filter((par) => mapa[par]));

describe('o mapa de gráficos', () => {
  it('não tem chave que o catálogo desconheça', () => {
    const doCatalogo = paresDoCatalogo();
    expect(Object.keys(SPECS).filter((par) => !doCatalogo.has(par))).toEqual([]);
  });

  // 25 pares. O 25º é `btts:defesas_vazaveis`, que antes era servida pela chave
  // de Gols por acidente de nome e agora está escrita.
  const COM_GRAFICO = [
    'asian_handicap:adversario_fragil_fora',
    'asian_handicap:defesa_fora_solida',
    'asian_handicap:mando_forte',
    'asian_handicap:raramente_perde_por_2',
    'asian_handicap:tende_golear',
    'btts:ambos_marcam',
    'btts:ataque_dos_dois',
    'btts:defesa_forte',
    'btts:defesas_vazaveis',
    'double_chance:adversario_limitado',
    'double_chance:invicto_recente',
    'goals_over_under:ambos_vazam',
    'goals_over_under:ataque_combinado',
    'goals_over_under:ataques_fracos',
    'goals_over_under:clean_sheets_altos',
    'goals_over_under:defesas_firmes',
    'goals_over_under:defesas_vazaveis',
    'goals_over_under:historico_over',
    'goals_over_under:historico_under',
    'goals_over_under:xg_baixo_combinado',
    'goals_over_under:xg_combinado_alto',
    'match_winner:forca_mismatch',
    'match_winner:forma',
    'match_winner:mando',
    'match_winner:superioridade_xg',
  ];

  it('atende exatamente estas premissas do catálogo', () => {
    expect(atendidosPor(SPECS).sort()).toEqual([...COM_GRAFICO].sort());
  });
});

describe('o mapa do perfil de temporada', () => {
  it('não tem chave que o catálogo desconheça', () => {
    const doCatalogo = paresDoCatalogo();
    expect(Object.keys(BUILDERS).filter((par) => !doCatalogo.has(par))).toEqual([]);
  });

  // 22 pares. Este mapa alcança três que o de gráficos não alcança —
  // `h2h_favoravel`, `superioridade_tabela` e `supremacia` —, que são as que
  // dependem de tabela e confronto direto: dado que o jogo a jogo não carrega.
  const COM_FRASE_DE_PERFIL = [
    'asian_handicap:adversario_fragil_fora',
    'asian_handicap:defesa_fora_solida',
    'asian_handicap:mando_forte',
    'asian_handicap:supremacia',
    'asian_handicap:tende_golear',
    'btts:ambos_marcam',
    'btts:ataque_dos_dois',
    'btts:defesa_forte',
    'btts:defesas_vazaveis',
    'double_chance:adversario_limitado',
    'double_chance:invicto_recente',
    'double_chance:lado_coberto_forte',
    'goals_over_under:ataque_combinado',
    'goals_over_under:ataques_fracos',
    'goals_over_under:clean_sheets_altos',
    'goals_over_under:defesas_firmes',
    'goals_over_under:defesas_vazaveis',
    'match_winner:forca_mismatch',
    'match_winner:forma',
    'match_winner:h2h_favoravel',
    'match_winner:mando',
    'match_winner:superioridade_tabela',
  ];

  it('atende exatamente estas premissas do catálogo', () => {
    expect(atendidosPor(BUILDERS).sort()).toEqual([...COM_FRASE_DE_PERFIL].sort());
  });
});

describe('a colisão que motivou o rechaveamento', () => {
  it('as defesas frágeis de Gols e a do Ambos marcam são entradas separadas nos dois mapas', () => {
    // Não é sobre serem diferentes HOJE — nos dois mapas as duas ainda apontam
    // para o mesmo desenho, e é assim que o rechaveamento não mudou pixel. É
    // sobre EXISTIREM separadas, que é o que deixa consertar uma sem a outra.
    expect(SPECS['goals_over_under:defesas_vazaveis']).toBeDefined();
    expect(SPECS['btts:defesas_vazaveis']).toBeDefined();
    expect(BUILDERS['goals_over_under:defesas_vazaveis']).toBeDefined();
    expect(BUILDERS['btts:defesas_vazaveis']).toBeDefined();
  });

  it('nenhum dos dois mapas responde a um slug sem mercado', () => {
    // A garantia de que nada ficou para trás chamando pela chave antiga: se
    // sobrasse um chamador com o slug cru, ele receberia indefinido e a tela
    // perderia a evidência sem erro nenhum.
    expect(SPECS['defesas_vazaveis']).toBeUndefined();
    expect(BUILDERS['defesas_vazaveis']).toBeUndefined();
  });
});
