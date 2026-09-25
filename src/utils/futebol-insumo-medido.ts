/**
 * O valor que o modelo comparou, publicado pelo mart (#464, absorvendo a #406).
 *
 * É a evidência mais próxima do critério que existe: não é uma reconstrução
 * nossa da janela, é o número que a premissa de fato comparou. Por isso ele
 * entra logo depois da prestação de contas na porta única, e antes das duas
 * rotas que recalculam.
 *
 * ── Agnóstico de nome, de propósito ─────────────────────────────────────────
 *
 * O vocabulário de insumo (`s_rank`, `o_rank`, `h2h_total`, …) vive no catálogo
 * do dbt, não aqui. Decorar uma frase por nome deste lado criaria uma terceira
 * cópia de vocabulário para divergir sozinha — que é a classe de problema que a
 * #464 está consertando. Então a frase mostra o par nome e valor como veio.
 *
 * Quando o critério de cada premissa for transcrito (hoje só o mercado de Gols
 * tem), a prestação de contas assume na frente desta rota e a frase crua some
 * sozinha, sem ninguém precisar apagar nada.
 */

import { plural, type Evidencia } from '@/utils/futebol-evidencias';

/** Uma linha de `futebol.fact_insumos_medidos`, só com o que esta escolha usa. */
export interface InsumoMedido {
  outcome: string;
  market: string;
  premissa: string;
  insumo: string;
  valor: number | null;
}

/** `1.485` vira `1,49`; inteiro fica inteiro. */
function numero(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
}

/**
 * Os insumos que uma premissa comparou, na saída daquele lado.
 *
 * O casamento de lado é por `lower(outcome)`: o mercado de Resultado grava a
 * saída capitalizada, e comparar com a caixa errada devolve vazio sem erro —
 * foi assim que a primeira medição desta issue saiu zerada.
 */
export function insumosDaPremissa(
  mercado: string,
  slug: string,
  lado: 'home' | 'away' | null,
  insumos: InsumoMedido[] | undefined,
): InsumoMedido[] {
  if (!insumos?.length || !lado) return [];
  return insumos.filter(
    (i) =>
      i.market === mercado &&
      i.premissa === slug &&
      i.outcome?.toLowerCase() === lado &&
      i.valor != null,
  );
}

/**
 * Como cada premissa lê os insumos dela em português.
 *
 * ⚠️ Isto é APRESENTAÇÃO, não critério. O corte continua sendo do modelo; aqui
 * só se decide como o número medido vira frase. Por isso não é a "terceira
 * cópia de vocabulário" que o cabeçalho deste arquivo teme: nada aqui decide se
 * a premissa acende.
 *
 * `s_` é o time da saída e `o_` o adversário. Uma forma só devolve frase quando
 * TODOS os insumos que ela usa vieram; faltando qualquer um, cai no par cru, que
 * é honesto e não inventa o que não veio.
 *
 * Premissa sem forma aqui também cai no par cru — é o que mantém a rota
 * agnóstica para as outras seis do 1X2 e para as que o mart publicar depois.
 */
/** Os nomes dos dois times, para a barra. Nome não é medição: não muda com a janela. */
export interface NomesDoConfronto {
  time?: string | null;
  adversario?: string | null;
}

/**
 * Onde cada lado joga NESTE jogo.
 *
 * `venue` no nome da coluna (`s_ga_venue`, `o_ga_venue`, `s_gf_venue`) significa
 * que o insumo foi recortado por mando, e a frase tem de dizer qual — senão
 * declara janela mais larga que a medida, que pelo glossário é o gráfico
 * desmentindo o número que ele deveria explicar.
 */
function ondeCadaUmJoga(lado: 'home' | 'away'): { doTime: string; doAdversario: string } {
  return lado === 'home'
    ? { doTime: 'em casa', doAdversario: 'fora' }
    : { doTime: 'fora', doAdversario: 'em casa' };
}

/**
 * Posição e pontos por jogo dos dois lados — a forma das premissas de TABELA.
 *
 * Duas premissas leem a classificação com os MESMOS quatro insumos e cortes
 * diferentes: `superioridade_tabela` (Resultado) e `supremacia` (Handicap, que
 * acende com `o_rank - s_rank >= 8` OU `s_ppg >= 1.5 * o_ppg`).
 *
 * A frase mostra os quatro números e não afirma qual condição acendeu: eleger
 * uma esconderia que a outra existe, e a tela passaria a dizer um critério que
 * o modelo pode não ter usado.
 *
 * A barra compara a mesma grandeza da frase, com a posição no rótulo. Mais
 * pontos por jogo é o lado bom da aposta, daí o destaque à esquerda.
 *
 * ⚠️ O destaque só sai quando o lado da aposta TEM o número maior, e é por isso
 * que ele é condicional. As duas premissas acendem também por POSIÇÃO, e nesse
 * ramo o adversário pode ter mais pontos por jogo — destacar a esquerda ali
 * pintaria de verde a barra MENOR, dizendo ao assinante que a vantagem está no
 * lado que tem menos.
 *
 * Medido no mart: acontece em 46 dos 6.716 acendimentos do Resultado e em 38
 * dos 5.404 do Handicap. Quase todos na fase de liga da Champions, onde os
 * times jogaram números diferentes de partidas e a posição descola do
 * aproveitamento — o caso extremo é um 20º colocado com 3,00 pontos por jogo.
 *
 * Sem número maior, `destaque: 'nenhum'`: a barra continua mostrando os dois
 * lados e deixa de afirmar qual é o bom, em vez de afirmar errado.
 *
 * Pela ADR 0008 do dbt (`analytics-engineering`, numeração de LÁ — este
 * repositório tem a sua própria em `docs/adr/`), classificação é sempre
 * COMPETIÇÃO-SCOPED: a posição sai da tabela daquele campeonato, nunca de um
 * ranking juntado.
 */
function formaDaTabela(v: Record<string, number>, n: NomesDoConfronto): Evidencia | null {
  if (v.s_rank == null || v.o_rank == null || v.s_ppg == null || v.o_ppg == null) return null;
  return {
    texto:
      `${numero(v.s_rank)}º com ${numero(v.s_ppg)} pontos por jogo, contra ` +
      `${numero(v.o_rank)}º e ${numero(v.o_ppg)} do adversário`,
    comparacao: {
      esqLabel: `${n.time ?? 'O time'}, ${numero(v.s_rank)}º`,
      esqValor: v.s_ppg,
      dirLabel: `${n.adversario ?? 'Adversário'}, ${numero(v.o_rank)}º`,
      dirValor: v.o_ppg,
      destaque: v.s_ppg > v.o_ppg ? 'esq' : 'nenhum',
    },
  };
}

const FORMAS: Record<
  string,
  (v: Record<string, number>, n: NomesDoConfronto, lado: 'home' | 'away' | null) => Evidencia | null
> = {
  // O modelo compara pontos POR JOGO; a frase antiga mostrava o total da
  // temporada ("76 pontos"), que é outra grandeza. Era um número verdadeiro que
  // não é o insumo — o que o glossário chama de ilustrar sem explicar.
  //
  // O desenho da frase e da barra vive no `formaDaTabela`, compartilhado com a
  // `supremacia` do Handicap: mesmos quatro insumos, cortes diferentes.
  'match_winner:superioridade_tabela': formaDaTabela,

  // Sem barra, de propósito. O mart dá vitórias e TOTAL; entre as duas existem
  // os empates, e daqui não dá para separar empate de derrota. A barra só
  // conseguiria desenhar "vitórias contra o resto", que é outra afirmação —
  // melhor frase sozinha do que barra dizendo o que o dado não diz.
  'match_winner:h2h_favoravel': (v) => {
    if (v.s_wins == null || v.h2h_total == null) return null;
    return {
      texto:
        `${numero(v.s_wins)} ${v.s_wins === 1 ? 'vitória' : 'vitórias'} em ` +
        `${numero(v.h2h_total)} ${v.h2h_total === 1 ? 'confronto' : 'confrontos'}`,
    };
  },

  // Sem barra: o critério é `n_wins_last5 >= 3`, um número do time contra um
  // corte — não existe segundo lado para comparar. A frase antiga listava
  // "3 vitórias, 1 empate e 1 derrota", montada do `form` da API: verdadeira, e
  // não era o insumo. Empate e derrota não entram na conta que acende.
  //
  // O gráfico (`SPECS.forma`) desenha os 5 jogos por resultado, e esta frase
  // conta as vitórias DESSES jogos: mesma grandeza, uma resumindo a outra.
  'match_winner:forma': (v) => {
    if (v.n_wins_last5 == null) return null;
    return { texto: `${plural(v.n_wins_last5, 'vitória', 'vitórias')} nos últimos 5 jogos` };
  },

  // Duas grandezas diferentes: gol MARCADO pelo time e gol SOFRIDO pelo
  // adversário, cada uma com o seu corte (1,4 e 1,3).
  //
  // ⚠️ E CADA UMA NO MANDO DELA — `venue` está no nome das duas colunas. A
  // primeira versão desta frase dizia "marca 1,60 por jogo", que declara janela
  // mais larga que a medida; pelo glossário (Janela da premissa), recorte de
  // mando desencontrado do número é o gráfico desmentindo o número que ele
  // deveria explicar. É por isso que a forma recebe o `lado`.
  //
  // `destaque: 'nenhum'` pelo mesmo motivo da rota antiga: os dois números altos
  // favorecem a aposta, então pintar o maior de verde diria que a defesa vazada
  // do adversário é o lado "bom" da comparação.
  'match_winner:forca_mismatch': (v, n, lado) => {
    if (v.s_gf_venue == null || v.o_ga_venue == null || lado == null) return null;
    const { doTime: ondeTime, doAdversario: ondeAdv } = ondeCadaUmJoga(lado);
    return {
      texto:
        `${n.time ?? 'O time'} marca ${numero(v.s_gf_venue)} ${ondeTime} e ` +
        `${n.adversario ?? 'o adversário'} sofre ${numero(v.o_ga_venue)} ${ondeAdv}`,
      comparacao: {
        esqLabel: `${n.time ?? 'O time'} marca ${ondeTime}`,
        esqValor: v.s_gf_venue,
        dirLabel: `${n.adversario ?? 'Adversário'} sofre ${ondeAdv}`,
        dirValor: v.o_ga_venue,
        destaque: 'nenhum',
      },
    };
  },

  // O critério tem DUAS condições e as duas contam: `o_missing >= 1` e
  // `s_missing = 0`. Mostrar só os desfalques do adversário esconderia metade —
  // um time com dois desfalques próprios não acende esta premissa, e a tela
  // diria o contrário.
  //
  // `destaque: 'nenhum'`: aqui o lado bom é o adversário ter MAIS e o time ter
  // MENOS. Não existe "maior é melhor" que sirva para os dois.
  'match_winner:desfalque_adversario': (v, n) => {
    if (v.o_missing == null || v.s_missing == null) return null;
    const doAdv = plural(v.o_missing, 'desfalque', 'desfalques');
    const doTime = v.s_missing === 0 ? 'nenhum' : numero(v.s_missing);
    return {
      texto: `${n.adversario ?? 'Adversário'} com ${doAdv} de titular, contra ${doTime} do ${n.time ?? 'time'}`,
      comparacao: {
        esqLabel: `${n.time ?? 'O time'}`,
        esqValor: v.s_missing,
        dirLabel: `${n.adversario ?? 'Adversário'}`,
        dirValor: v.o_missing,
        destaque: 'nenhum',
      },
    };
  },

  // ── Handicap asiático (AE#202) ──────────────────────────────────────────────
  // Quatro das oito. As outras quatro estão fora por motivo declarado, e o teste
  // de cada uma guarda o motivo:
  //
  //   `mando_forte`            o critério é percentual de pontos e o gráfico
  //                            desenha `metrica: 'resultado'`. Mesma regra que
  //                            excluiu a `mando` do Resultado.
  //   `raramente_perde_por_2`  ⚠️ NÃO é "frase errada": a rota do histórico já
  //                            diz a grandeza certa. Fica de fora porque essa
  //                            frase sai das MESMAS linhas que o gráfico
  //                            desenha, e trocar a fonte para o mart quebraria
  //                            essa garantia de origem única.
  //   `tende_golear`           o mart mede os dois insumos do TIME e
  //                            `SPECS.tende_golear` desenha o ga do ADVERSÁRIO.
  //   `favorito_irregular`     a tela a esconde de propósito: vale 0 ponto e
  //                            acende em 43% das linhas.

  // Mesmos quatro insumos da `superioridade_tabela`, corte diferente: aqui
  // acende com oito posições de distância OU 50% mais pontos por jogo.
  'asian_handicap:supremacia': formaDaTabela,

  // `s_rank <= 6 OR s_rank >= n_teams - 3`, e só em liga de pontos corridos: o
  // time está no topo brigando por algo, ou embaixo brigando contra a queda —
  // nos dois casos não poupa jogador. Os dois números do corte são a posição e
  // o tamanho da liga, e são eles que a frase mostra.
  //
  // Sem barra: não existe segundo lado. Comparar o time com o número de times
  // da liga não é comparação, é categoria contra contagem.
  'asian_handicap:sem_rodizio': (v) => {
    if (v.s_rank == null || v.n_teams == null) return null;
    const times = v.n_teams === 1 ? 'time' : 'times';
    return { texto: `${numero(v.s_rank)}º entre ${numero(v.n_teams)} ${times}` };
  },

  // `o_ga_venue >= 1.6`, e o `venue` é do ADVERSÁRIO: apostando no mandante, o
  // número que acendeu é o dele jogando fora. Sem barra — é um número contra um
  // corte, e o time da aposta não entra nessa conta.
  'asian_handicap:adversario_fragil_fora': (v, n, lado) => {
    if (v.o_ga_venue == null || lado == null) return null;
    return {
      texto: `${n.adversario ?? 'Adversário'} sofre ${numero(v.o_ga_venue)} ${ondeCadaUmJoga(lado).doAdversario}`,
    };
  },

  // `s_ga_venue <= 1.1`, premissa de azarão, recortada no mando do PRÓPRIO
  // time. Sem barra pelo mesmo motivo da de cima.
  'asian_handicap:defesa_fora_solida': (v, n, lado) => {
    if (v.s_ga_venue == null || lado == null) return null;
    return {
      texto: `${n.time ?? 'O time'} sofre ${numero(v.s_ga_venue)} ${ondeCadaUmJoga(lado).doTime}`,
    };
  },
};

/**
 * A evidência a partir do valor medido, ou `null` quando não há como formar uma.
 *
 * ⚠️ Premissa sem forma conhecida devolve `null` DE PROPÓSITO, e não o par cru.
 * Imprimir `s_form_pts 11` seria pôr identificador de coluna do dbt na cara do
 * assinante — e, pior, faria a premissa falar por uma janela enquanto o gráfico
 * logo abaixo dela desenha outra. Devolvendo nulo, ela cai na rota do histórico,
 * que calcula a frase da MESMA série que o gráfico desenha, e as duas não têm
 * como discordar.
 *
 * Ausência de insumo também é normal, não erro: o funil é append-only e linha
 * gravada antes do deploy não tem valor medido.
 */
export function evidenciaDoInsumoMedido(
  mercado: string,
  slug: string,
  lado: 'home' | 'away' | null,
  insumos: InsumoMedido[] | undefined,
  nomes: NomesDoConfronto = {},
): Evidencia | null {
  const achados = insumosDaPremissa(mercado, slug, lado, insumos);
  if (!achados.length) return null;

  const porNome: Record<string, number> = {};
  for (const i of achados) porNome[i.insumo] = i.valor as number;

  return FORMAS[`${mercado}:${slug}`]?.(porNome, nomes, lado) ?? null;
}
