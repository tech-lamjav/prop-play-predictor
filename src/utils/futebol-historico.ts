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
// Regra que sustenta a auditoria: o recorte aqui é o MESMO da média (competição,
// temporada e mando). Medido no dev: Palmeiras em casa, 10 jogos, 0,80 gol sofrido,
// idêntico ao ga_casa da 094. Se o recorte fosse outro, o gráfico desmentiria o
// número que ele deveria explicar.

export type Metrica = 'ga' | 'gf' | 'xg' | 'total' | 'resultado';

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
   * Recorta os últimos N jogos. Existe para o gráfico não desmentir a frase: a
   * premissa de forma fala dos ÚLTIMOS 5, então mostrar 21 jogos ali seria outro
   * número. Sem isto, entram todos os jogos do recorte.
   */
  ultimos?: number;
}

/**
 * Que gráfico prova cada premissa. Slug fora do mapa não ganha gráfico: melhor a aba
 * dizer que não tem como conferir do que desenhar um número que não é o da premissa.
 */
const SPECS: Record<string, SerieSpec[]> = {
  // ── Gols ──
  defesas_vazaveis: [{ quem: 'ambos', metrica: 'ga', mando: 'proprio', direcao: 'maior' }],
  defesas_firmes: [{ quem: 'ambos', metrica: 'ga', mando: 'proprio', direcao: 'menor' }],
  ataque_combinado: [{ quem: 'ambos', metrica: 'gf', mando: 'proprio', direcao: 'maior' }],
  ataques_fracos: [{ quem: 'ambos', metrica: 'gf', mando: 'proprio', direcao: 'menor' }],
  clean_sheets_altos: [{ quem: 'ambos', metrica: 'ga', mando: 'todos', direcao: 'menor' }],
  ambos_vazam: [{ quem: 'ambos', metrica: 'ga', mando: 'todos', direcao: 'maior' }],
  xg_combinado_alto: [{ quem: 'ambos', metrica: 'xg', mando: 'proprio', direcao: 'maior' }],
  xg_baixo_combinado: [{ quem: 'ambos', metrica: 'xg', mando: 'proprio', direcao: 'menor' }],
  historico_over: [{ quem: 'ambos', metrica: 'total', mando: 'todos', direcao: 'maior' }],
  historico_under: [{ quem: 'ambos', metrica: 'total', mando: 'todos', direcao: 'menor' }],

  // ── Resultado ──
  forma: [{ quem: 'time', metrica: 'resultado', mando: 'todos', direcao: 'maior', ultimos: 5 }],
  invicto_recente: [{ quem: 'time', metrica: 'resultado', mando: 'todos', direcao: 'maior', ultimos: 5 }],
  mando: [{ quem: 'time', metrica: 'resultado', mando: 'proprio', direcao: 'maior' }],
  mando_forte: [{ quem: 'time', metrica: 'resultado', mando: 'proprio', direcao: 'maior' }],
  superioridade_xg: [{ quem: 'ambos', metrica: 'xg', mando: 'todos', direcao: 'maior' }],
  forca_mismatch: [
    { quem: 'time', metrica: 'gf', mando: 'proprio', direcao: 'maior' },
    { quem: 'adversario', metrica: 'ga', mando: 'proprio', direcao: 'maior' },
  ],

  // ── Handicap ──
  tende_golear: [
    { quem: 'time', metrica: 'gf', mando: 'proprio', direcao: 'maior' },
    { quem: 'adversario', metrica: 'ga', mando: 'proprio', direcao: 'maior' },
  ],
  adversario_fragil_fora: [{ quem: 'adversario', metrica: 'ga', mando: 'proprio', direcao: 'maior' }],
  defesa_fora_solida: [{ quem: 'time', metrica: 'ga', mando: 'proprio', direcao: 'menor' }],
  raramente_perde_por_2: [{ quem: 'time', metrica: 'resultado', mando: 'todos', direcao: 'maior' }],

  // ── Ambos marcam / dupla chance ──
  ambos_marcam: [{ quem: 'ambos', metrica: 'gf', mando: 'todos', direcao: 'maior' }],
  ataque_dos_dois: [{ quem: 'ambos', metrica: 'gf', mando: 'proprio', direcao: 'maior' }],
  defesa_forte: [{ quem: 'ambos', metrica: 'ga', mando: 'proprio', direcao: 'menor' }],
  adversario_limitado: [{ quem: 'adversario', metrica: 'gf', mando: 'todos', direcao: 'menor' }],
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
  /** "Fortaleza em casa" ou "Fortaleza, todos os jogos". */
  titulo: string;
  /** "4 jogos" ou "4 jogos, 1 sem dado de gol esperado". */
  sub: string;
  metrica: Metrica;
  direcao: Direcao;
  /** A média das barras, que é o número que a premissa usa. */
  media: number | null;
  jogos: JogoBarra[];
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
  return r.gols_pro - r.gols_contra;
}

const SUFIXO_MANDO = (mando: FiltroMando, emCasa: boolean) =>
  mando === 'todos' ? ', todos os jogos' : emCasa ? ' em casa' : ' fora';

const COMO_LER: Record<Metrica, string> = {
  ga: 'Cada barra é um jogo: quanto mais alta, mais gols o time sofreu naquele jogo. A linha é a média, que é o número que a premissa usa.',
  gf: 'Cada barra é um jogo: quanto mais alta, mais gols o time marcou. A linha é a média, que é o número que a premissa usa.',
  xg: 'Cada barra é o gol esperado do time no jogo, ou seja, o tanto de chance que ele criou. A linha é a média.',
  total: 'Cada barra é o total de gols do jogo, somando os dois times. A linha tracejada é a linha que você escolheu.',
  resultado: 'Cada quadrado é um jogo, com o placar e o adversário. Verde é vitória, cinza empate, vermelho derrota.',
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
      const noMando = spec.mando === 'todos' ? doLado : doLado.filter((r) => r.em_casa === emCasa);
      const filtrados = spec.ultimos ? noMando.slice(-spec.ultimos) : noMando;
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
        titulo: spec.ultimos
          ? `${filtrados[0].team_name}, últimos ${filtrados.length} jogos`
          : `${filtrados[0].team_name}${SUFIXO_MANDO(spec.mando, emCasa)}`,
        sub:
          semDado > 0
            ? `${jogos.length} ${jogos.length === 1 ? 'jogo' : 'jogos'}, ${semDado} sem o dado`
            : spec.ultimos && noMando.length > filtrados.length
              ? `de ${noMando.length} na competição`
              : `${jogos.length} ${jogos.length === 1 ? 'jogo' : 'jogos'}`,
        metrica: spec.metrica,
        direcao: spec.direcao,
        media,
        jogos,
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
  const doLado = (s: 'home' | 'away', proprio: boolean) => {
    const rows = hist.filter((r) => r.side === s);
    return proprio ? rows.filter((r) => r.em_casa === (s === 'home')) : rows;
  };
  const media = (rows: FutebolFixtureHistorico[], f: (r: FutebolFixtureHistorico) => number | null) => {
    const vs = rows.map(f).filter((v): v is number => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  const nome = (s: 'home' | 'away') => hist.find((r) => r.side === s)?.team_name ?? '';

  if (slug === 'xg_combinado_alto' || slug === 'xg_baixo_combinado') {
    const casa = doLado('home', true);
    const fora = doLado('away', true);
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

  return null;
}
