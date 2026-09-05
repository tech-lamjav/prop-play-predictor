import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import type { Evidencia } from '@/utils/futebol-evidencias';
import { n1 } from '@/utils/futebol-evidencias';

// Os jogos que produzem a média de cada premissa (RPC 095).
//
// Por que existe: a média sozinha ainda pede fé. "Somados, sofrem 3,0 gols por jogo"
// pode ser dois times que sofrem sempre, ou um vazadouro e uma defesa sólida, ou uma
// goleada isolada puxando tudo. O gráfico jogo a jogo, com a linha da média e o
// filtro de mando declarado, deixa o usuário conferir em vez de acreditar.
//
// Regra que sustenta a auditoria: o recorte aqui é o MESMO que o modelo usa para
// acender a premissa — a JANELA DA PREMISSA, os últimos jogos do time em qualquer
// competição. Se o recorte fosse outro, o gráfico desmentiria o número que ele
// deveria explicar.
//
// ⚠️ Essa regra já esteve ancorada no lugar errado (#350). Ela dizia "o recorte é o
// mesmo da média (competição, temporada e mando)", casando o gráfico com o perfil
// de temporada — que nunca foi insumo de premissa nenhuma. O gráfico ficava
// coerente com um número que não era o que decidia, e daí saía o "Flamengo em
// casa, 11 jogos" embaixo de um critério que soma dez jogos.
//
// ⚠️ E o conserto passou do ponto: ele tirou o recorte de mando das DEZ premissas
// de gols, quando o modelo o mantém em três delas. `int_futebol_premissas_ou`, na
// CTE `metrics`:
//
//     -- ataque combinado (mandante em casa + visitante fora) e defesas vazáveis
//     h.goals_for_avg_home     + a.goals_for_avg_away      AS gf_comb,
//     h.goals_against_avg_home + a.goals_against_avg_away  AS ga_comb,
//
// `ataque_combinado`, `defesas_firmes` e `defesas_vazaveis` medem o mandante EM
// CASA e o visitante FORA. As outras sete não: percentual e contagem saem dos
// totais (`clean_sheet_total / played_total`, `last5_totals`), e o xG sai do spine
// sem recorte nenhum. Cada premissa declara o seu, e o padrão não serve para
// nenhuma delas — é por isso que os dez `mando` abaixo estão escritos um a um.
//
// A ORDEM das duas coisas também é do modelo: a janela é de JOGOS, e o mando
// recorta DENTRO dela. O `pit` sob `ultimos_10` pega as dez partidas mais recentes
// e só então conta as de casa. Filtrar mando primeiro daria "os dez últimos jogos
// EM CASA", que pode atravessar meia temporada a mais.

/**
 * A janela das premissas do mercado de gols: os últimos 10 jogos do time, em
 * qualquer competição.
 *
 * Mora numa constante porque o gráfico e o número precisam usar a MESMA. Foi
 * exatamente divergirem que produziu a #350 — e, dentro dela, o segundo defeito:
 * o gráfico mudou de janela e o número do xG ficou para trás, então card e barras
 * mostravam médias diferentes da mesma coisa, lado a lado.
 */
/**
 * O recorte que o MODELO usa, e por isso o que a tela desenha.
 *
 * Desde a analytics-engineering#91 (ADR 0010), fechada em 25/08/2026, os
 * defaults dos modelos de premissa são `todas` as competições e os `ultimos_10`
 * jogos — e produção usa o default. Antes disso eram "só a competição do jogo"
 * e "a temporada", que é o que estas especificações descreviam.
 *
 * O modelo mudou embaixo delas e nada quebrou, porque nada obriga as duas
 * pontas a concordarem. O resultado media-se assim, no Goiás × Fortaleza de
 * 05/09: o critério acendeu com 1,5 contra 1,0 (últimos 10, todas), a frase da
 * tela dizia 1,2 contra 1,2 (o histórico inteiro) e o gráfico desenhava 1,3
 * contra 1,1 (só a Série B). Três leituras do mesmo número, e a que decide não
 * aparecia em lugar nenhum.
 */
const JANELA_DO_MODELO = 10;

const JANELA_DE_GOLS = JANELA_DO_MODELO;
const ULTIMOS_DE_GOLS = <T>(rows: T[]): T[] => rows.slice(-JANELA_DE_GOLS);

/**
 * A janela das premissas de CONTAGEM: os últimos 5, e não os 10 das outras.
 *
 * `last5_totals` no modelo. Duas janelas no mesmo mercado é o tipo de coisa que
 * some num literal repetido, e o gráfico passa a contar dez jogos embaixo de uma
 * frase que fala de cinco.
 */
const JANELA_DE_CONTAGEM = 5;

/**
 * O que cada barra do gráfico mede.
 *
 * `sem_sofrer` e `sem_marcar` são BINÁRIAS: 1 quando o jogo teve a coisa, 0
 * quando não. A média delas é a FRAÇÃO de jogos, e é ela que vira o percentual
 * que o modelo compara — `clean_sheet_total / played_total` e
 * `failed_to_score_total / played_total` (#355).
 */
export type Metrica = 'ga' | 'gf' | 'xg' | 'total' | 'resultado' | 'sem_sofrer' | 'sem_marcar';

/** Métrica binária: a média dela é uma fração de jogos, não uma média de gols. */
export const EH_BINARIA = (m: Metrica) => m === 'sem_sofrer' || m === 'sem_marcar';

/** `proprio` = o mando que o time tem NESTE jogo (mandante em casa, visitante fora). */
export type FiltroMando = 'proprio' | 'todos';

export type Quem = 'time' | 'adversario' | 'ambos';

/**
 * Para que lado a premissa quer o número. `maior` = jogo com valor acima da régua
 * joga a favor dela; `menor` = abaixo joga a favor. É o que permite pintar a barra
 * pelo que ela significa PARA A SAÍDA ESCOLHIDA, e não só "acima ou abaixo da média".
 */
export type Direcao = 'maior' | 'menor';

interface SerieSpec {
  quem: Quem;
  metrica: Metrica;
  mando: FiltroMando;
  direcao: Direcao;
  /**
   * Recorta os últimos N JOGOS do time, antes do recorte de mando. Existe para o
   * gráfico não desmentir a frase: a premissa de forma fala dos ÚLTIMOS 5, então
   * mostrar 21 jogos ali seria outro número. Sem isto, entram todos os jogos.
   *
   * A ordem importa e é a do modelo: janela primeiro, mando depois. "Os últimos
   * 10 jogos, dos quais 4 em casa" não é "os últimos 10 jogos em casa".
   */
  ultimos?: number;
  /**
   * De onde vêm os jogos.
   *
   * `qualquer` é a **janela da premissa**: todas as competições, que é o que o
   * modelo mede nas premissas de gols. `mesma_competicao` mantém o recorte antigo
   * — uma competição só — para as premissas cujo critério ninguém conferiu ainda.
   *
   * Existe porque a consulta parou de filtrar por competição (#350) e isso valia
   * para TODOS os consumidores: as premissas de resultado e handicap passaram a
   * desenhar jogos de outros campeonatos enquanto a frase acima delas continuava
   * saindo do perfil de uma competição só. O gráfico e o texto discordavam em
   * mercados que esta issue nem tocava. A janela agora é declarada por premissa,
   * e o padrão é o conservador; a #352 diz quais podem mudar.
   */
  competicoes?: 'qualquer' | 'mesma_competicao';
  /**
   * A linha da média entra no gráfico?
   *
   * Padrão sim. Sai nas premissas de CONTAGEM (#356), onde a média não é o insumo
   * e pode estar de um lado da linha enquanto a contagem diz o contrário —
   * desenhá-la ali é oferecer ao assinante o número errado, com destaque.
   */
  mostraMedia?: boolean;
}

/**
 * Que gráfico prova cada premissa. Slug fora do mapa não ganha gráfico: melhor a aba
 * dizer que não tem como conferir do que desenhar um número que não é o da premissa.
 */
export const SPECS: Record<string, SerieSpec[]> = {
  // ── Gols ──
  // ⚠️ `ultimos: 10` e `competicoes: 'qualquer'` nas dez, e o `mando` UM A UM.
  //
  // A janela é a mesma para todas (#350): os últimos 10 jogos do time em qualquer
  // competição. O `ultimos` é EXPLÍCITO de propósito — deixar a janela nascer do
  // tamanho da busca amarra o significado ao `p_max` da consulta, e aí mudar
  // quantos jogos se busca mudaria calado o que a premissa afirma.
  //
  // O mando NÃO é o mesmo, e escrever `todos` nas dez foi o excesso da #350. As
  // três primeiras somam o mandante EM CASA com o visitante FORA (`gf_comb` e
  // `ga_comb` no modelo); as sete seguintes saem de totais, sem recorte nenhum.
  //
  // As premissas de OUTROS mercados: a #352 levantou os critérios e o resultado
  // está na #361. Elas seguem em `mesma_competicao` até serem consertadas.
  defesas_vazaveis: [{ quem: 'ambos', metrica: 'ga', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  defesas_firmes: [{ quem: 'ambos', metrica: 'ga', mando: 'proprio', direcao: 'menor', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  ataque_combinado: [{ quem: 'ambos', metrica: 'gf', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  // A família de PERCENTUAL (#355). O critério destas três não é média de gol
  // nenhuma: é o percentual de jogos de CADA time em que a coisa aconteceu,
  // contra um corte fixo. Enquanto elas desenhavam `ga`/`gf`, "os dois passam
  // muitos jogos sem sofrer gol" vinha ilustrado com "2,4 gols sofridos por
  // jogo" — um número verdadeiro que não é o insumo, e que dizia o contrário.
  //
  // A métrica binária resolve os dois lados de uma vez: a barra passa a ser o
  // jogo (teve ou não teve) e a média das barras É a fração que vira percentual.
  ataques_fracos: [{ quem: 'ambos', metrica: 'sem_marcar', mando: 'todos', direcao: 'maior', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  clean_sheets_altos: [{ quem: 'ambos', metrica: 'sem_sofrer', mando: 'todos', direcao: 'maior', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  ambos_vazam: [{ quem: 'ambos', metrica: 'sem_sofrer', mando: 'todos', direcao: 'menor', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  xg_combinado_alto: [{ quem: 'ambos', metrica: 'xg', mando: 'todos', direcao: 'maior', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  xg_baixo_combinado: [{ quem: 'ambos', metrica: 'xg', mando: 'todos', direcao: 'menor', ultimos: JANELA_DE_GOLS, competicoes: 'qualquer' }],
  // A família de CONTAGEM (#356). O critério conta quantos dos ÚLTIMOS CINCO
  // jogos de cada time ficaram de um lado da linha, e exige um mínimo em cada —
  // `home_over_cnt >= 3 AND away_over_cnt >= 3`, sobre `last5_totals`.
  //
  // A janela é 5, e não os 10 do resto do mercado: escrever `JANELA_DE_GOLS` aqui
  // seria o gráfico contando dez jogos embaixo de uma frase que fala de cinco.
  //
  // `mostraMedia: false` porque a média não é o insumo delas, e uma média pode
  // estar de um lado da linha enquanto a contagem diz o contrário. O gráfico
  // continua sendo o do total de gols com a linha tracejada, que é justamente o
  // que deixa contar as barras que passaram.
  historico_over: [{ quem: 'ambos', metrica: 'total', mando: 'todos', direcao: 'maior', ultimos: JANELA_DE_CONTAGEM, competicoes: 'qualquer', mostraMedia: false }],
  historico_under: [{ quem: 'ambos', metrica: 'total', mando: 'todos', direcao: 'menor', ultimos: JANELA_DE_CONTAGEM, competicoes: 'qualquer', mostraMedia: false }],

  // ── Resultado ──
  forma: [{ quem: 'time', metrica: 'resultado', mando: 'todos', direcao: 'maior', ultimos: 5, competicoes: 'qualquer' }],
  invicto_recente: [{ quem: 'time', metrica: 'resultado', mando: 'todos', direcao: 'maior', ultimos: 5, competicoes: 'qualquer' }],
  mando: [{ quem: 'time', metrica: 'resultado', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  mando_forte: [{ quem: 'time', metrica: 'resultado', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  superioridade_xg: [{ quem: 'ambos', metrica: 'xg', mando: 'todos', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  forca_mismatch: [
    { quem: 'time', metrica: 'gf', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' },
    { quem: 'adversario', metrica: 'ga', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' },
  ],

  // ── Handicap ──
  tende_golear: [
    { quem: 'time', metrica: 'gf', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' },
    { quem: 'adversario', metrica: 'ga', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' },
  ],
  adversario_fragil_fora: [{ quem: 'adversario', metrica: 'ga', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  defesa_fora_solida: [{ quem: 'time', metrica: 'ga', mando: 'proprio', direcao: 'menor', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  raramente_perde_por_2: [{ quem: 'time', metrica: 'resultado', mando: 'todos', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],

  // ── Ambos marcam / dupla chance ──
  ambos_marcam: [{ quem: 'ambos', metrica: 'gf', mando: 'todos', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  ataque_dos_dois: [{ quem: 'ambos', metrica: 'gf', mando: 'proprio', direcao: 'maior', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  defesa_forte: [{ quem: 'ambos', metrica: 'ga', mando: 'proprio', direcao: 'menor', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
  adversario_limitado: [{ quem: 'adversario', metrica: 'gf', mando: 'todos', direcao: 'menor', ultimos: JANELA_DO_MODELO, competicoes: 'qualquer' }],
};

export interface JogoBarra {
  ordem: number;
  data: string;
  adversario: string;
  adversarioId: number;
  emCasa: boolean;
  /** Valor da métrica no jogo. Null = sem dado (xG que a API não entregou). */
  valor: number | null;
  /** Placar do jogo, na ótica do time da série. */
  placar: string;
  resultado: 'V' | 'E' | 'D';
  /**
   * Este jogo puxa para o lado da saída escolhida? É o que a cor da barra diz: num
   * "mais de 2,5", jogo com muito gol joga a favor; num "menos de 2,5", o contrário.
   */
  favorece: boolean;
}

export interface SerieHistorico {
  chave: string;
  /** Para o escudo em cima do próprio gráfico, e não só na legenda longe dele. */
  teamId: number;
  teamName: string;
  /** "Fortaleza, últimos jogos" ou, onde o mando é parte do critério, "Fortaleza em casa". */
  titulo: string;
  /** "4 jogos" ou "4 jogos, 1 sem dado de gol esperado". */
  sub: string;
  metrica: Metrica;
  direcao: Direcao;
  /** A média das barras, que é o número que a premissa usa — onde ela É o insumo. */
  media: number | null;
  /**
   * A média entra no gráfico? Falsa nas premissas de contagem, onde ela não é o
   * insumo e desenhá-la oferece o número errado com destaque (#356).
   */
  mostraMedia: boolean;
  jogos: JogoBarra[];
  /**
   * Quantos jogos a JANELA tinha antes do recorte de mando. Igual a `jogos.length`
   * onde não há recorte.
   *
   * Estrutural, e não só dentro do `sub`: quem presta contas do critério (#353)
   * precisa declarar a base de jogos, e ler isso de volta de uma frase seria a
   * segunda fonte do mesmo número.
   */
  daJanela: number;
}

/**
 * O fechamento da premissa: o número dos dois times somado, comparado com a linha
 * escolhida. É o que responde "por que essa premissa joga a favor DESTA saída", que
 * o gráfico de cada time separado não responde sozinho.
 */
export interface Consolidado {
  valor: number;
  linha: number;
  direcao: Direcao;
  favorece: boolean;
  /** "gols sofridos por jogo, somados" */
  unidade: string;
}

export interface Story {
  series: SerieHistorico[];
  /** Como ler o gráfico. Uma frase, por métrica. */
  comoLer: string;
  /** Referência tracejada, quando a métrica é o total de gols da partida. */
  referencia?: { valor: number; label: string };
  consolidado?: Consolidado;
}

const LADO_OPOSTO = (l: 'home' | 'away') => (l === 'home' ? 'away' : 'home');

/** O lado do confronto de cada papel. Sem lado definido, "time" é o mandante. */
function papeis(lado: 'home' | 'away' | null): { time: 'home' | 'away'; adversario: 'home' | 'away' } {
  const t = lado ?? 'home';
  return { time: t, adversario: LADO_OPOSTO(t) };
}

function valorDe(r: FutebolFixtureHistorico, m: Metrica): number | null {
  if (m === 'ga') return r.gols_contra;
  if (m === 'gf') return r.gols_pro;
  if (m === 'total') return r.total_gols;
  if (m === 'xg') return r.xg;
  if (m === 'sem_sofrer') return r.sem_sofrer ? 1 : 0;
  if (m === 'sem_marcar') return r.sem_marcar ? 1 : 0;
  return r.gols_pro - r.gols_contra;
}

/**
 * O mando no cabeçalho da série, para quem recorta por mando.
 *
 * Quem não recorta não passa por aqui: o título dele anuncia a JANELA ("últimos 10
 * jogos"), porque é ela que define o recorte. Antes o sufixo tinha um terceiro
 * caso, "todos os jogos", e ele mentia duas vezes — sugeria a temporada de uma
 * competição só, quando o gráfico mistura campeonatos de propósito (#350).
 */
const SUFIXO_MANDO = (emCasa: boolean) => (emCasa ? ' em casa' : ' fora');

const COMO_LER: Record<Metrica, string> = {
  ga: 'Cada barra é um jogo: quanto mais alta, mais gols o time sofreu naquele jogo. A linha é a média, que é o número que a premissa usa.',
  gf: 'Cada barra é um jogo: quanto mais alta, mais gols o time marcou. A linha é a média, que é o número que a premissa usa.',
  xg: 'Cada barra é o gol esperado do time no jogo, ou seja, o tanto de chance que ele criou. A linha é a média.',
  total: 'Cada barra é o total de gols do jogo, somando os dois times. A linha tracejada é a linha que você escolheu.',
  resultado: 'Cada quadrado é um jogo, com o placar e o adversário. Verde é vitória, cinza empate, vermelho derrota.',
  sem_sofrer: 'Cada barra é um jogo: cheia quando o time não sofreu gol, vazia quando sofreu. O que a premissa usa é o percentual de jogos cheios.',
  sem_marcar: 'Cada barra é um jogo: cheia quando o time não marcou, vazia quando marcou. O que a premissa usa é o percentual de jogos cheios.',
};

/**
 * O gráfico que prova (ou derruba) a premissa, com o mesmo recorte da média.
 * Devolve null quando não existe jogo suficiente ou quando a premissa não tem como
 * ser auditada com o que o mart entrega.
 */
export function storyDaPremissa(
  slug: string,
  hist: FutebolFixtureHistorico[] | undefined,
  lado: 'home' | 'away' | null,
  linha: number | null,
): Story | null {
  const specs = SPECS[slug];
  if (!specs?.length || !hist?.length) return null;
  const p = papeis(lado);

  const series: SerieHistorico[] = [];
  for (const spec of specs) {
    const lados: ('home' | 'away')[] =
      spec.quem === 'ambos' ? ['home', 'away'] : spec.quem === 'time' ? [p.time] : [p.adversario];
    for (const side of lados) {
      const doLado = hist.filter((r) => r.side === side);
      if (!doLado.length) continue;
      const emCasa = side === 'home';
      // A consulta devolve jogos de qualquer competição (#350). Quem declarou a
      // janela larga fica com todos; o resto volta a ver só a competição do
      // confronto, que é onde o critério deles ainda mora.
      const naCompeticao =
        spec.competicoes === 'qualquer' ? doLado : doLado.filter((r) => r.mesma_competicao !== false);
      if (!naCompeticao.length) continue;
      // Janela primeiro, mando depois — a ordem é a do modelo. O `pit` sob
      // `ultimos_10` pega as dez partidas mais recentes e SÓ ENTÃO conta as de
      // casa. Invertido, "os últimos 10" viraria "os últimos 10 em casa", que
      // pode atravessar meia temporada a mais e dar outra média.
      const naJanela = spec.ultimos ? naCompeticao.slice(-spec.ultimos) : naCompeticao;
      const filtrados =
        spec.mando === 'todos' ? naJanela : naJanela.filter((r) => r.em_casa === emCasa);
      if (!filtrados.length) continue;
      const brutos = filtrados.map((r) => ({
        ordem: r.ordem,
        data: r.data,
        adversario: r.adversario,
        adversarioId: r.adversario_id,
        emCasa: r.em_casa,
        valor: valorDe(r, spec.metrica),
        placar: `${r.gols_pro} a ${r.gols_contra}`,
        resultado: r.resultado,
      }));
      const comValor = brutos.map((j) => j.valor).filter((v): v is number => v != null);
      const semDado = brutos.length - comValor.length;
      const media = comValor.length ? comValor.reduce((s, v) => s + v, 0) / comValor.length : null;
      // A régua de cada jogo: no total de gols é a LINHA escolhida (é ela que decide
      // a aposta); nas outras métricas é a média, que é o número da premissa.
      const regua = spec.metrica === 'total' && linha != null ? linha : media;
      const jogos: JogoBarra[] = brutos.map((j) => ({
        ...j,
        favorece:
          j.valor == null || regua == null
            ? false
            : spec.direcao === 'maior'
              ? j.valor > regua
              : j.valor < regua,
        resultado: j.resultado as 'V' | 'E' | 'D',
      }));
      series.push({
        chave: `${slug}-${side}-${spec.metrica}-${spec.mando}`,
        teamId: filtrados[0].team_id,
        teamName: filtrados[0].team_name,
        // O título nomeia o RECORTE, e o sub declara a BASE. Juntos eles dizem o
        // que o modelo mediu: "Flamengo em casa · 4 dos últimos 10 jogos" é a
        // frase inteira do critério de `ga_comb`. O título sozinho mentia dos dois
        // jeitos já: "em casa" sem a janela sugeria a temporada, e "últimos 10
        // jogos" sem o mando sugeria que os dez entraram.
        titulo:
          spec.mando === 'proprio'
            ? `${filtrados[0].team_name}${SUFIXO_MANDO(emCasa)}`
            : spec.ultimos
              ? `${filtrados[0].team_name}, últimos ${filtrados.length} jogos`
              : filtrados[0].team_name,
        // O subtítulo só existe quando ACRESCENTA. Três casos, nesta ordem:
        //
        //   · faltou dado em alguns jogos -> a média não é sobre todos, e isso
        //     precisa estar escrito;
        //   · a premissa olha só um mando -> o título diz "Fortaleza EC fora" e
        //     não carrega contagem nenhuma, então ela vem aqui;
        //   · nos demais o título já diz "últimos N jogos", e repetir o N seria
        //     dizer duas vezes.
        //
        // Saiu daqui o "5 de 40 disponíveis". O 40 era quantas linhas a consulta
        // trouxe — parâmetro nosso, não conceito de produto — e desde que a
        // janela passou a ser a do modelo ele só levantava a pergunta errada:
        // "por que não 40?". Porque o modelo nunca olhou 40.
        sub:
          semDado > 0
            ? `${jogos.length} ${jogos.length === 1 ? 'jogo' : 'jogos'}, ${semDado} sem o dado`
            : spec.mando === 'proprio'
              ? `${jogos.length} dos últimos ${naJanela.length} jogos`
              : '',
        metrica: spec.metrica,
        direcao: spec.direcao,
        media,
        mostraMedia: spec.mostraMedia !== false,
        jogos,
        daJanela: naJanela.length,
      });
    }
  }
  if (!series.length) return null;

  const metrica = series[0].metrica;
  const spec0 = specs[0];
  return {
    series,
    comoLer: COMO_LER[metrica],
    referencia: metrica === 'total' && linha != null ? { valor: linha, label: `linha ${String(linha).replace('.', ',')}` } : undefined,
    consolidado: consolidadoDe(series, spec0, linha),
  };
}

const UNIDADE: Partial<Record<Metrica, string>> = {
  ga: 'gols sofridos por jogo, somando os dois',
  gf: 'gols marcados por jogo, somando os dois',
  xg: 'gols esperados por jogo, somando os dois',
  total: 'gols por jogo na média dos dois',
};

/**
 * O número dos dois times contra a linha. Só existe onde a comparação é honesta: os
 * dois lados na mesma métrica de gol e uma linha de gols para comparar. Handicap e
 * 1X2 não entram, porque ali a linha não é total de gol.
 */
function consolidadoDe(series: SerieHistorico[], spec: SerieSpec, linha: number | null): Consolidado | null {
  if (linha == null || spec.quem !== 'ambos') return null;
  const unidade = UNIDADE[spec.metrica];
  if (!unidade) return null;
  const medias = series.map((s) => s.media).filter((v): v is number => v != null);
  if (medias.length !== series.length || !medias.length) return null;
  // No total de gols cada jogo já soma os dois times, então o consolidado é a média
  // das médias, não a soma (senão contaria os gols duas vezes).
  const valor =
    spec.metrica === 'total' ? medias.reduce((a, b) => a + b, 0) / medias.length : medias.reduce((a, b) => a + b, 0);
  return {
    valor,
    linha,
    direcao: spec.direcao,
    favorece: spec.direcao === 'maior' ? valor > linha : valor < linha,
    unidade,
  };
}

/**
 * A frase de embasamento das premissas que a 094 não cobre, calculada dos MESMOS
 * jogos do gráfico. Fecha os buracos de "sem número para conferir" que sobraram:
 * chance de gol (xG), histórico de muitos/poucos gols e derrota por dois ou mais.
 */
export function evidenciaDoHistorico(
  slug: string,
  hist: FutebolFixtureHistorico[] | undefined,
  lado: 'home' | 'away' | null,
  linha: number | null,
): Evidencia | null {
  if (!hist?.length) return null;
  const p = papeis(lado);
  /**
   * A MESMA amostra que o gráfico desenha, e pelo mesmo motivo que ele.
   *
   * Esta função varria o histórico inteiro — sem recorte de jogos e sem filtro
   * de competição — enquanto o gráfico logo abaixo aplicava os dois. As duas
   * descreviam o mesmo número e discordavam: no Goiás × Fortaleza de 05/09 a
   * frase dizia "1,2 contra 1,2" e o gráfico desenhava 1,3 e 1,1.
   *
   * Ninguém veria por leitura de código, porque são duas funções que calculam
   * a mesma coisa por caminhos diferentes. Agora as duas leem a especificação,
   * então divergir de novo exige mexer nela — que é onde a decisão mora.
   */
  const spec = SPECS[slug]?.[0];
  const recortar = (rows: FutebolFixtureHistorico[]) => {
    const naCompeticao =
      spec?.competicoes === 'qualquer' ? rows : rows.filter((r) => r.mesma_competicao !== false);
    return spec?.ultimos ? naCompeticao.slice(-spec.ultimos) : naCompeticao;
  };
  const doLado = (s: 'home' | 'away', proprio: boolean) => {
    // Competição e recorte primeiro, mando depois — a ordem é a do modelo, e a
    // mesma que `storyDaPremissa` usa. Invertida, "os últimos 10" viraria "os
    // últimos 10 em casa", que pode atravessar meia temporada a mais.
    const rows = recortar(hist.filter((r) => r.side === s));
    return proprio ? rows.filter((r) => r.em_casa === (s === 'home')) : rows;
  };
  const media = (rows: FutebolFixtureHistorico[], f: (r: FutebolFixtureHistorico) => number | null) => {
    const vs = rows.map(f).filter((v): v is number => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  const nome = (s: 'home' | 'away') => hist.find((r) => r.side === s)?.team_name ?? '';

  if (slug === 'xg_combinado_alto' || slug === 'xg_baixo_combinado') {
    // Sem recorte de mando e nos últimos 10, a MESMA janela que o gráfico destas
    // premissas usa (#350). Enquanto o gráfico mudou e este número não, o card e
    // as barras embaixo dele mostravam médias diferentes da mesma coisa — o
    // defeito da spec, agora dentro da mesma caixa.
    const casa = ULTIMOS_DE_GOLS(doLado('home', false));
    const fora = ULTIMOS_DE_GOLS(doLado('away', false));
    const a = media(casa, (r) => r.xg);
    const b = media(fora, (r) => r.xg);
    if (a == null || b == null) return null;
    // Mesma guarda de contradição do futebol-evidencias: gol esperado somado ACIMA
    // da linha desmente "criam pouca chance", e abaixo dela desmente "criam muita".
    // Sem isso a tela escrevia "criam pouca chance de gol · somados, criam 3,5".
    if (linha != null) {
      const soma = a + b;
      if (slug === 'xg_baixo_combinado' && soma > linha) return null;
      if (slug === 'xg_combinado_alto' && soma < linha) return null;
    }
    return {
      texto: `Somados, criam ${n1(a + b)} gols esperados por jogo`,
      comparacao: {
        esqLabel: `${nome('home')} em casa`,
        esqValor: a,
        dirLabel: `${nome('away')} fora`,
        dirValor: b,
        destaque: 'nenhum',
      },
    };
  }

  if (slug === 'superioridade_xg') {
    const a = media(doLado(p.time, false), (r) => r.xg);
    const b = media(doLado(p.adversario, false), (r) => r.xg);
    if (a == null || b == null) return null;
    return {
      texto: `${nome(p.time)} cria ${n1(a)} gols esperados por jogo contra ${n1(b)} do adversário`,
      comparacao: {
        esqLabel: nome(p.time),
        esqValor: a,
        dirLabel: nome(p.adversario),
        dirValor: b,
        destaque: 'esq',
      },
    };
  }

  if (slug === 'historico_over' || slug === 'historico_under') {
    if (linha == null) return null;
    const todos = hist;
    const acima = todos.filter((r) => r.total_gols > linha).length;
    const alvo = slug === 'historico_over' ? acima : todos.length - acima;
    const comp = slug === 'historico_over' ? 'passaram de' : 'ficaram abaixo de';
    return {
      texto: `${alvo} dos ${todos.length} jogos dos dois times ${comp} ${String(linha).replace('.', ',')} gols`,
    };
  }

  if (slug === 'raramente_perde_por_2') {
    const rows = doLado(p.time, false);
    if (!rows.length) return null;
    const k = rows.filter((r) => r.gols_contra - r.gols_pro >= 2).length;
    return {
      texto: `${nome(p.time)} perdeu por dois ou mais em ${k} dos ${rows.length} jogos`,
    };
  }

  return fraseDoGrafico(slug, hist, lado, linha);
}

/**
 * A frase montada do PRÓPRIO gráfico, para qualquer premissa que tenha um.
 *
 * Existe para tapar o buraco medido em 05/09: das 48 premissas, só 10 têm o
 * critério transcrito — e as dez são do mercado de Gols. Nas outras quatro
 * famílias a frase saía do perfil de temporada, que mede outra coisa:
 *
 *   Goiás, gols sofridos por jogo
 *     perfil de temporada (25 jogos, foto de 31/08)   1,20
 *     últimos 10, que é o que o modelo usa            0,90
 *
 * Trinta e três por cento de diferença, e o perfil ainda por cima é um snapshot
 * com data — para um jogo de hoje ele está cinco dias parado, enquanto o modelo
 * é point-in-time por partida.
 *
 * ⚠️ Isto NÃO é o número do modelo: é a mesma AMOSTRA que ele usa, medida por
 * nós. A diferença importa e some quando o critério da premissa for transcrito
 * — aí a prestação de contas assume, com o corte junto, e esta função deixa de
 * ser chamada para aquela premissa. Enquanto isso, o card ao menos para de se
 * contradizer entre a frase e o gráfico logo abaixo dela.
 */
function fraseDoGrafico(
  slug: string,
  hist: FutebolFixtureHistorico[] | undefined,
  lado: 'home' | 'away' | null,
  linha: number | null,
): Evidencia | null {
  const story = storyDaPremissa(slug, hist, lado, linha);
  if (!story) return null;

  // Premissa de RESULTADO não tem média: a barra é vitória, empate ou derrota.
  // A frase honesta ali é a contagem, na mesma janela — é a mesma forma que o
  // perfil de temporada usava ("6 vitórias, 2 empates e 4 derrotas"), com o
  // recorte trocado.
  const deResultado = story.series.filter((x) => x.metrica === 'resultado');
  if (deResultado.length) {
    const partes = deResultado.map((x) => {
      const conta = (r: 'V' | 'E' | 'D') => x.jogos.filter((j) => j.resultado === r).length;
      const [v, e, d] = [conta('V'), conta('E'), conta('D')];
      const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;
      return `${x.teamName}: ${plural(v, 'vitória', 'vitórias')}, ${plural(e, 'empate', 'empates')} e ${plural(d, 'derrota', 'derrotas')} em ${x.jogos.length}`;
    });
    return { texto: partes.join(' · ') };
  }

  const series = story.series.filter((x) => x.media != null);
  if (!series.length) return null;

  // Numa métrica binária a média é a FRAÇÃO de jogos, e escrevê-la como "0,4"
  // embaixo de uma premissa que compara 40% seria o card falando outra língua
  // que o gráfico. Mesma régua do rótulo da média.
  const comoEscrever = (v: number, m: Metrica) =>
    EH_BINARIA(m) ? `${Math.round(v * 100)}%` : n1(v);

  const partes = series.map((x) => `${x.teamName} ${comoEscrever(x.media!, x.metrica)}`);
  const unidade = UNIDADE_CURTA[series[0].metrica];
  return { texto: unidade ? `${partes.join(' · ')} ${unidade}` : partes.join(' · ') };
}

/**
 * A unidade sem o "somando os dois" do `UNIDADE`: aqui cada time aparece com o
 * seu número, então somar seria dizer o contrário do que está escrito.
 */
const UNIDADE_CURTA: Partial<Record<Metrica, string>> = {
  ga: 'gols sofridos por jogo',
  gf: 'gols marcados por jogo',
  xg: 'gols esperados por jogo',
  total: 'gols por jogo',
  sem_sofrer: 'dos jogos sem sofrer gol',
  sem_marcar: 'dos jogos sem marcar',
};

/**
 * O "Como chegam" na JANELA DA PREMISSA.
 *
 * Antes este bloco vinha do perfil de temporada (`get_futebol_fixture_numeros`):
 * média total no campeonato, sem recorte de mando. O resultado é que a tela
 * exibia, uma embaixo da outra, duas medidas diferentes do mesmo confronto —
 * Criciúma × Cuiabá de 04/09 anunciava "2,4 gols marcados, somados" na premissa
 * e 1,0 e 0,9 aqui. Os dois números estavam certos e a soma não fechava; para
 * quem lê, um dos dois mente, e a legenda explicando a diferença não devolve a
 * credibilidade que a contradição tira.
 *
 * Agora sai da MESMA fonte das premissas, e por reuso e não por cópia: cada
 * linha chama `storyDaPremissa` com o slug cujo critério já declara aquele
 * recorte. Se a janela do modelo mudar, muda nos dois lugares de uma vez.
 *
 * - gols marcados e sofridos: últimos 10, mandante EM CASA e visitante FORA,
 *   que é o que `gf_comb`/`ga_comb` somam;
 * - sem sofrer gol: percentual dos últimos 10 SEM recorte de mando, que é o que
 *   `clean_sheets_altos` compara.
 *
 * O mando difere entre as linhas porque difere no modelo. É por isso que a
 * legenda do bloco diz qual recorte vale em qual linha, em vez de afirmar um só.
 *
 * `null` quando não há histórico — sem dado o bloco não aparece, em vez de cair
 * de volta no perfil de temporada e recriar as duas verdades em silêncio.
 */
export interface PerfilDaJanela {
  /** Média de gols marcados no recorte de mando, por time. */
  gf: { home: number | null; away: number | null };
  /** Média de gols sofridos no mesmo recorte. */
  ga: { home: number | null; away: number | null };
  /** Fração de jogos sem sofrer gol (0 a 1), na janela inteira. */
  semSofrer: { home: number | null; away: number | null };
  /** Quantos jogos entraram no recorte de mando, por time. */
  jogosDoMando: { home: number; away: number };
  /** O tamanho da janela antes do recorte de mando. */
  janela: number;
}

export function perfilDaJanela(hist: FutebolFixtureHistorico[] | undefined): PerfilDaJanela | null {
  const gf = storyDaPremissa('ataque_combinado', hist, null, null);
  const ga = storyDaPremissa('defesas_firmes', hist, null, null);
  const cs = storyDaPremissa('clean_sheets_altos', hist, null, null);
  if (!gf || !ga || !cs) return null;

  // A série carrega o lado na própria chave, então o lado sai dela e não da
  // POSIÇÃO no array: uma série pode faltar (time sem jogo no recorte), e aí o
  // índice 1 passaria a ser o mandante calado.
  const doLado = (s: Story, side: 'home' | 'away') =>
    s.series.find((x) => x.chave.split('-')[1] === side) ?? null;

  return {
    gf: { home: doLado(gf, 'home')?.media ?? null, away: doLado(gf, 'away')?.media ?? null },
    ga: { home: doLado(ga, 'home')?.media ?? null, away: doLado(ga, 'away')?.media ?? null },
    semSofrer: { home: doLado(cs, 'home')?.media ?? null, away: doLado(cs, 'away')?.media ?? null },
    jogosDoMando: { home: doLado(gf, 'home')?.jogos.length ?? 0, away: doLado(gf, 'away')?.jogos.length ?? 0 },
    janela: doLado(gf, 'home')?.daJanela ?? JANELA_DE_GOLS,
  };
}
