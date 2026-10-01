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

import { fmtDecimal } from '@/utils/formato';
import { ladoDaSaida, plural, type Evidencia } from '@/utils/futebol-evidencias';

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
  return Number.isInteger(v) ? String(v) : fmtDecimal(v, 2);
}

/**
 * Percentual de jogos: `33.333` vira `33%`.
 *
 * Inteiro de propósito. O insumo é `clean_sheet_total / played_total` sobre uma
 * janela de no máximo dez jogos, então o número real anda de dez em dez — e as
 * casas decimais só aparecem quando o time tem MENOS de dez jogos, que é
 * justamente quando a amostra é curta demais para prometer duas casas.
 *
 * É também o que o próprio dbt escreve nos bullets dele (`%.0f%%`), então a
 * mesma medição não sai com dois arredondamentos diferentes conforme a tela.
 */
function percentual(v: number): string {
  return `${Math.round(v)}%`;
}

/**
 * Os insumos que uma premissa comparou, na saída escolhida.
 *
 * ⚠️ O casamento é com a SAÍDA do mart, e não com o lado do confronto. Ele era
 * `outcome.toLowerCase() === lado` e funcionava por coincidência: no Resultado e
 * no Handicap a saída se chama `Home`/`Away`, que em minúscula É o lado. Nos
 * outros dois mercados ela não se chama assim, e a busca saía vazia sem erro:
 *
 *   Dupla chance   `1X`/`X2` nunca é igual a `home`/`away`.
 *   Ambos marcam   `Yes`/`No` não tem lado de confronto nenhum — ali `lado`
 *                  chega nulo, e a busca parava na primeira linha, antes mesmo
 *                  de olhar o dado.
 *
 * `lower` continua porque a caixa varia entre mercados, e comparar com a caixa
 * errada devolve vazio sem erro — foi assim que a primeira medição da #464 saiu
 * zerada.
 */
export function insumosDaPremissa(
  mercado: string,
  slug: string,
  saida: string | null,
  insumos: InsumoMedido[] | undefined,
): InsumoMedido[] {
  if (!insumos?.length || !saida) return [];
  const alvo = saida.toLowerCase();
  return insumos.filter(
    (i) =>
      i.market === mercado &&
      i.premissa === slug &&
      i.outcome?.toLowerCase() === alvo &&
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
/**
 * Os nomes dos dois times, para a barra. Nome não é medição: não muda com a janela.
 *
 * São DOIS pares do mesmo confronto, e não um par com apelidos:
 *
 *   `time`/`adversario`       o lado APOSTADO e quem está contra. Existe só
 *                            onde a aposta tem lado — Resultado, Handicap,
 *                            Dupla chance.
 *   `mandante`/`visitante`    quem joga em casa e quem joga fora. É o par do
 *                            Ambos marcam, onde nenhum dos dois é o lado
 *                            apostado e o mart mede os dois por isso
 *                            (`home_*`/`away_*`, e não `s_`/`o_`).
 *
 * Traduzir um par no outro aqui seria inventar um lado que a aposta não tem.
 */
export interface NomesDoConfronto {
  time?: string | null;
  adversario?: string | null;
  mandante?: string | null;
  visitante?: string | null;
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
 *
 * ⚠️ COMPETIÇÃO-SCOPED NÃO É TORNEIO-SCOPED, e a diferença vai aparecer na tela.
 *
 * Se você chegou aqui investigando um número que parece errado — "2º entre 30"
 * num campeonato de 15 times, ou uma posição que não bate com a tabela que o
 * site da liga mostra — é provavelmente isto, e é conhecido:
 *
 * Argentina, Colômbia, Peru e México rodam DOIS torneios curtos por ano
 * (Apertura e Clausura). A `season` é uma só, e o rank e o ppg que chegam aqui
 * ACUMULAM OS DOIS. A posição que esta frase mostra é de um campeonato que
 * ninguém jogou. Na Argentina o `n_teams` dá 30, contra zonas de 15.
 *
 * Três premissas leem isso e não filtram por torneio: `superioridade_tabela`
 * (Resultado), `supremacia` (Handicap) e o braço `x_superioridade_tabela` da
 * `lado_coberto_forte` (Dupla chance). A `sem_rodizio` não entra: ela exige
 * liga de pontos corridos, e as quatro ficam fora dessa lista.
 *
 * Foi decisão de PARIDADE do analytics-engineering, em 01/10/2026, não
 * descuido: é o que já acontece em Libertadores, Sudamericana, Champions e
 * Nations League, onde o rank é de grupo ou de fase. A diferença — e é a parte
 * que vale guardar — é que LÁ são fases de um campeonato só, e AQUI são dois
 * campeonatos inteiros empilhados. Mesmo erro, tamanho maior.
 *
 * O que fecha: derivar o torneio a partir do `round`, proposta na ADR 0018 do
 * dbt. Enquanto ela não existir, não há conserto possível deste lado — o
 * número chega somado, e inventar a separação aqui seria o front discordando do
 * modelo por conta própria.
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

/**
 * As duas leituras do Ambos marcam, e por que elas são DUAS funções e não sete.
 *
 * O mercado tem sete premissas, e elas se repetem aos pares: o lado "Sim" e o
 * lado "Não" leem O MESMO insumo com o corte invertido. `ambos_marcam` acende
 * com os dois passando em branco POUCO e `ataque_trava` com um deles passando
 * MUITO — o número é `fts_pct` nos dois. Idem `defesas_vazaveis` e
 * `defesa_forte`, que leem `cs_pct`.
 *
 * A frase não diz o corte (ela é apresentação, não critério), então o par
 * inteiro cabe numa função só. Escrever quatro seria manter quatro cópias da
 * mesma frase para divergirem uma de cada vez.
 *
 * ⚠️ `destaque: 'nenhum'` nas duas, e aqui o motivo é mais forte que nos outros
 * mercados: no Ambos marcam NENHUM dos dois times é o lado apostado. A aposta é
 * no jogo. Pintar de verde a barra maior diria que um dos times é o lado bom, e
 * não existe lado bom para apontar.
 */
function formaDoPercentualDosDois(
  casa: number | undefined,
  fora: number | undefined,
  n: NomesDoConfronto,
  oQueAconteceu: string,
): Evidencia | null {
  if (casa == null || fora == null) return null;
  const mandante = n.mandante ?? 'O mandante';
  const visitante = n.visitante ?? 'o visitante';
  return {
    texto: `${mandante} ${oQueAconteceu} em ${percentual(casa)} dos jogos e ${visitante} em ${percentual(fora)}`,
    comparacao: {
      esqLabel: n.mandante ?? 'Mandante',
      esqValor: casa,
      dirLabel: n.visitante ?? 'Visitante',
      dirValor: fora,
      destaque: 'nenhum',
    },
  };
}

/**
 * O histórico de cinco jogos do Ambos marcam, nos dois sentidos.
 *
 * `historico_btts` conta em quantos dos últimos cinco os dois marcaram e
 * `historico_seco` conta o complemento — mesma janela, mesma contagem, leitura
 * espelhada. Os dois cortes são "pelo menos 3", e a frase não os cita.
 *
 * Sem barra: o gráfico destas duas desenha os cinco jogos um a um, e a barra
 * comparativa repetiria a contagem que já está lá, com menos informação.
 *
 * A frase carrega o "de cada um" porque são DUAS janelas de cinco, uma por
 * time, e não cinco jogos compartilhados. "3 e 4 dos últimos 5" sem isso soaria
 * como sete jogos de um conjunto de cinco.
 */
function formaDaContagemDeCinco(
  casa: number | undefined,
  fora: number | undefined,
  n: NomesDoConfronto,
  oQueAconteceu: string,
): Evidencia | null {
  if (casa == null || fora == null) return null;
  return {
    texto:
      `Nos últimos 5 de cada um, ${oQueAconteceu} em ${numero(casa)} do ` +
      `${n.mandante ?? 'mandante'} e ${numero(fora)} do ${n.visitante ?? 'visitante'}`,
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
  // O gráfico (`SPECS['match_winner:forma']`) desenha os 5 jogos por resultado, e esta frase
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

  // ── Ambos marcam (AE#208) ───────────────────────────────────────────────────
  // AS SETE, e não um subconjunto como nos dois mercados anteriores. Lá a regra
  // da #361 — premissa só lê o valor medido se o gráfico souber desenhar a
  // grandeza do critério — deixou quatro de fora em cada. Aqui ela não excluiu
  // nenhuma, porque o gráfico foi CONSERTADO no mesmo commit: as métricas que
  // faltavam já existiam (`sem_sofrer`, `sem_marcar` e `ambos`, do mercado de
  // Gols), e o que havia era o mapa `SPECS` apontando para as erradas.
  //
  // Foi o que pôs a França com dois jogos de oito na tela de 25/09: a
  // `defesa_forte` desenhava média de gols sofridos RECORTADA POR MANDO, e o
  // critério dela é percentual de jogos sem sofrer, sem recorte de mando nenhum.
  //
  // ⚠️ Nenhuma destas sete recebe `lado`. No Ambos marcam a aposta não tem lado
  // de confronto: ela é no jogo, e o mart mede os dois times por isso
  // (`home_*`/`away_*`). Usar `n.time`/`n.adversario` aqui chamaria de "o time"
  // um dos dois escolhido por acaso.

  // `home_fts_pct < 30 AND away_fts_pct < 30` — os dois passam em branco pouco.
  'btts:ambos_marcam': (v, n) =>
    formaDoPercentualDosDois(v.home_fts_pct, v.away_fts_pct, n, 'passa em branco'),

  // `home_fts_pct >= 35 OR away_fts_pct >= 35` — basta UM travar. O espelho da
  // de cima, e é por isso que as duas dizem a mesma frase: o número é o mesmo, e
  // quem separa as duas é o corte, que a frase não afirma.
  'btts:ataque_trava': (v, n) =>
    formaDoPercentualDosDois(v.home_fts_pct, v.away_fts_pct, n, 'passa em branco'),

  // `home_cs_pct < 35 AND away_cs_pct < 35` — os dois seguram o zero pouco.
  'btts:defesas_vazaveis': (v, n) =>
    formaDoPercentualDosDois(v.home_cs_pct, v.away_cs_pct, n, 'não sofre gol'),

  // `home_cs_pct >= 45 OR away_cs_pct >= 45` — basta UMA defesa segurar.
  'btts:defesa_forte': (v, n) =>
    formaDoPercentualDosDois(v.home_cs_pct, v.away_cs_pct, n, 'não sofre gol'),

  // `home_btts_cnt >= 3 AND away_btts_cnt >= 3`, sobre os últimos 5 de cada.
  'btts:historico_btts': (v, n) =>
    formaDaContagemDeCinco(v.home_btts_cnt, v.away_btts_cnt, n, 'os dois marcaram'),

  // `home_no_btts_cnt >= 3 OR away_no_btts_cnt >= 3`, o complemento da de cima.
  'btts:historico_seco': (v, n) =>
    formaDaContagemDeCinco(v.home_no_btts_cnt, v.away_no_btts_cnt, n, 'faltou gol de um dos lados'),

  // `home_gf >= 1.2 AND away_gf >= 1.2`, e é a ÚNICA das sete recortada por
  // mando — `goals_for_avg_home` do mandante e `goals_for_avg_away` do
  // visitante. O recorte é fixo (cada um no mando que tem NESTE jogo), então ele
  // não vem do `lado`: vem de qual das duas colunas o mart publicou.
  //
  // Sem `ondeCadaUmJoga`, que traduz o lado APOSTADO — aqui não há lado apostado,
  // e o mandante joga em casa por definição.
  'btts:ataque_dos_dois': (v, n) => {
    if (v.home_gf == null || v.away_gf == null) return null;
    const mandante = n.mandante ?? 'O mandante';
    const visitante = n.visitante ?? 'o visitante';
    return {
      texto: `${mandante} marca ${numero(v.home_gf)} em casa e ${visitante} ${numero(v.away_gf)} fora`,
      comparacao: {
        esqLabel: `${n.mandante ?? 'Mandante'} em casa`,
        esqValor: v.home_gf,
        dirLabel: `${n.visitante ?? 'Visitante'} fora`,
        dirValor: v.away_gf,
        destaque: 'nenhum',
      },
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
  /**
   * A saída do mart, como ele a grava: `Home`, `Away`, `1X`, `X2`, `Yes`, `No`.
   *
   * ⚠️ Era o `lado` do confronto, e as duas coisas só coincidiam por acidente —
   * nos dois mercados que já liam o mart a saída se chama pelo lado. O lado
   * continua existindo, mas agora é DERIVADO daqui, pela mesma `ladoDaSaida` que
   * o resto da tela usa: recebendo os dois, um chamador poderia passar um par
   * que não combina, e a frase falaria de um time enquanto o número é do outro.
   */
  saida: string | null,
  insumos: InsumoMedido[] | undefined,
  nomes: NomesDoConfronto = {},
): Evidencia | null {
  const achados = insumosDaPremissa(mercado, slug, saida, insumos);
  if (!achados.length) return null;

  const porNome: Record<string, number> = {};
  for (const i of achados) porNome[i.insumo] = i.valor as number;

  // Nulo em Ambos marcam, e é o certo: lá a aposta é no jogo, e nenhum dos dois
  // times é o lado apostado. As formas de lá não recebem lado nenhum.
  const lado = saida ? ladoDaSaida(mercado, saida) : null;
  return FORMAS[`${mercado}:${slug}`]?.(porNome, nomes, lado) ?? null;
}
