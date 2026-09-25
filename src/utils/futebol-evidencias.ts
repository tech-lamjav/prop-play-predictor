import type { FutebolFixtureNumeros } from '@/services/futebol-data.service';

// O número que embasa cada premissa.
//
// Existe porque check + peso não é análise: "em boa fase, vem ganhando" sem número é
// adjetivo, e premissa apagada sem número não deixa ver se faltou pouco ou muito.
// Aqui cada premissa vira uma frase com o dado real, e quando faz sentido, uma
// comparação lado a lado dos dois times.
//
// Regra dura deste arquivo: NUNCA inventar número. Premissa sem métrica agregada no
// mart devolve null, e a tela mostra isso como "sem número para mostrar" em vez de
// encher linguiça. Hoje ficam sem número as de xG (não há agregado de temporada),
// as de histórico over/under, as de movimento de linha e as de rodízio/descanso.

export interface Comparacao {
  esqLabel: string;
  esqValor: number;
  dirLabel: string;
  dirValor: number;
  /**
   * Qual lado destacar. `nenhum` é o caso importante: em "ataque forte contra defesa
   * frágil" os dois números são de coisas diferentes (gol marcado × gol sofrido) e os
   * dois altos favorecem a aposta, então pintar o maior de verde mentiria, sugerindo
   * que a defesa vazada do adversário é o lado "bom" da comparação.
   */
  destaque?: 'esq' | 'dir' | 'nenhum';
}

/** Concordância de número: "1 vitória" e não "1 vitórias". */
export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export interface Evidencia {
  /** Frase curta com o dado. */
  texto: string;
  /**
   * A comparação dos dois lados, quando o número é de dois lados. O desenho dela
   * vive nas abas de motivos: o resumo mostra só a frase, por decisão de produto
   * ("já que é um resumo, não precisa da barra ali").
   */
  comparacao?: Comparacao;
}

const n1 = (v: number | null | undefined): string =>
  v == null ? '—' : v.toFixed(1).replace('.', ',');

const n2 = (v: number | null | undefined): string =>
  v == null ? '—' : v.toFixed(2).replace('.', ',');

/**
 * `form` da API usa D para Draw (empate) e L para Loss. Traduzir direto quebraria,
 * porque D vira empate em inglês e derrota em português. Esta versão devolve o par
 * certo já contado.
 */
export function contaForma(form: string | null | undefined, n = 5): { v: number; e: number; d: number } {
  const ult = (form ?? '').slice(-n).split('');
  return {
    v: ult.filter((c) => c === 'W').length,
    e: ult.filter((c) => c === 'D').length,
    d: ult.filter((c) => c === 'L').length,
  };
}

interface Ctx {
  /** Time da casa. */
  casa: FutebolFixtureNumeros | undefined;
  /** Time visitante. */
  fora: FutebolFixtureNumeros | undefined;
  /** Lado a que a aposta se refere, quando o mercado tem lado. */
  lado: 'home' | 'away' | null;
  /**
   * A premissa está acesa? Importa para os builders de soma: o limiar exato do mart
   * é o T5 e a gente não tem, então o nosso número de temporada pode DESMENTIR uma
   * premissa acesa (caso real: Copa do Brasil com 2 jogos de amostra acendeu
   * "defesas frágeis" com soma sofrida de 1,0 gol). Nesses casos o builder devolve
   * null: melhor sem número do que com um número que contradiz o título. Para
   * premissa APAGADA o mesmo número é mostrado, porque aí ele explica o porquê.
   */
  acesa: boolean;
  /**
   * A linha escolhida, quando existe. A guarda de contradição olha para ela primeiro:
   * "defesas firmes" com 2,7 gols somados contradiz a premissa numa linha de 2,5 e
   * apoia numa de 3,5. Com limiar fixo, a tela dizia "sem número para conferir" no
   * mesmo lugar onde o consolidado mostrava o 2,7 e explicava que ele sustenta.
   */
  linha: number | null;
}

// ⚠️ AQUI VIVIAM `desmenteAlta` e `desmenteBaixa`, e elas saíram (#358).
//
// Elas escondiam o número quando ele contradizia a premissa acesa: "somam muitos
// gols" com soma abaixo da linha devolvia `null`, e o card ficava mudo. É por
// isso que o defeito da spec #349 só aparecia em alguns cards e não em todos —
// alguém já sabia que os números podiam contradizer a premissa e resolveu
// escondendo, não corrigindo a origem.
//
// A origem era esta: o número contradizia porque NÃO ERA O INSUMO. A soma vinha
// do perfil de temporada (RPC 094), e o critério mede outra coisa, na janela da
// premissa. Com as dez premissas de gols prestando contas (#353 a #356), o número
// embaixo de cada uma passa a ser o que o modelo comparou, e não há o que
// esconder.
//
// ⚠️ NÃO REINTRODUZIR ao ver um card estranho. Se o número contradiz o veredito,
// isso agora é SINAL de que a derivação está errada, e é exatamente o que a
// guarda de divergência da #353 existe para acusar. Um silenciador junto de um
// detector anula o detector: a contradição sumiria da tela e o evento continuaria
// sendo emitido para ninguém.
//
// Os limiares eram 2,2 e 2,6, escolhidos a olho — o próprio comentário deles
// admitia que "o limiar real é do mart e a gente não tem".

/** O time da aposta e o adversário, quando o mercado tem lado. */
function porLado(ctx: Ctx): { time?: FutebolFixtureNumeros; adv?: FutebolFixtureNumeros; emCasa: boolean } {
  if (ctx.lado === 'away') return { time: ctx.fora, adv: ctx.casa, emCasa: false };
  return { time: ctx.casa, adv: ctx.fora, emCasa: true };
}

type Builder = (ctx: Ctx) => Evidencia | null;

/**
 * A frase do PERFIL DE TEMPORADA, por mercado e slug.
 *
 * ⚠️ A chave é o par, e não o slug — pelo mesmo motivo do mapa de gráficos em
 * `futebol-historico.ts`, e este mapa é o segundo seam que a #361 pede.
 *
 * O primeiro conserto mexeu só no gráfico, e ficaria pela metade: aqui mora a
 * MESMA colisão. `defesas_vazaveis` existe em Gols e em Ambos marcam, e a do
 * Ambos marcam cai nesta frase quando a rota do histórico não tem o que dizer.
 *
 * Hoje ela quase nunca cai, porque a premissa ainda tem gráfico e o gráfico vem
 * antes. Mas é a transcrição dos critérios que vai apagar esse gráfico — e no
 * dia em que apagar, esta rota assume. Fosse depois, a colisão entraria embutida
 * no conserto: é exatamente o que a #361 chama de pré-requisito.
 */
export const BUILDERS: Record<string, Builder> = {
  // ── Resultado ──────────────────────────────────────────────
  'match_winner:forma': (ctx) => {
    const { time } = porLado(ctx);
    if (!time?.forma) return null;
    const c = contaForma(time.forma, 5);
    return {
      texto: `${time.team_name} nos últimos 5: ${plural(c.v, 'vitória', 'vitórias')}, ${plural(c.e, 'empate', 'empates')} e ${plural(c.d, 'derrota', 'derrotas')}`,
    };
  },

  'match_winner:mando': (ctx) => {
    const { time, emCasa } = porLado(ctx);
    if (!time) return null;
    const j = emCasa ? time.jogos_casa : time.jogos_fora;
    const v = emCasa ? time.v_casa : time.v_fora;
    const e = emCasa ? time.e_casa : time.e_fora;
    const d = emCasa ? time.d_casa : time.d_fora;
    if (j == null) return null;
    const onde = emCasa ? 'em casa' : 'fora';
    return {
      texto: `${plural(v ?? 0, 'vitória', 'vitórias')}, ${plural(e ?? 0, 'empate', 'empates')} e ${plural(d ?? 0, 'derrota', 'derrotas')} em ${j} jogos ${onde}`,
      comparacao: {
        esqLabel: `Marca ${onde}`,
        esqValor: (emCasa ? time.gf_casa : time.gf_fora) ?? 0,
        dirLabel: `Sofre ${onde}`,
        dirValor: (emCasa ? time.ga_casa : time.ga_fora) ?? 0,
        // Marcar muito é bom, sofrer pouco é bom: destacar o ataque é o que o
        // usuário deve ler primeiro nesta premissa.
        destaque: 'esq',
      },
    };
  },

  'match_winner:superioridade_tabela': (ctx) => {
    const { time, adv } = porLado(ctx);
    if (!time?.posicao || !adv?.posicao) return null;
    const dif = Math.abs((time.pontos ?? 0) - (adv.pontos ?? 0));
    return {
      // Com o NOME dos times. Sem eles a frase era "6º com 41 pontos contra 12º
      // com 36", e quem lia tinha de deduzir quem era o 6º — a barra de
      // comparação logo abaixo já trazia os nomes, então a frase era a única
      // parte do card que falava de posição sem dizer de quem.
      texto: `${time.team_name} em ${time.posicao}º com ${time.pontos} pontos contra ${adv.team_name} em ${adv.posicao}º com ${adv.pontos}. ${dif} pontos de diferença`,
      comparacao: {
        esqLabel: `${time.team_name}, ${time.posicao}º`,
        esqValor: time.pontos ?? 0,
        dirLabel: `${adv.team_name}, ${adv.posicao}º`,
        dirValor: adv.pontos ?? 0,
        destaque: 'esq',
      },
    };
  },

  'match_winner:forca_mismatch': (ctx) => {
    const { time, adv, emCasa } = porLado(ctx);
    if (!time || !adv) return null;
    const ataque = emCasa ? time.gf_casa : time.gf_fora;
    const defesa = emCasa ? adv.ga_fora : adv.ga_casa;
    if (ataque == null || defesa == null) return null;
    return {
      texto: `${time.team_name} marca ${n1(ataque)} ${emCasa ? 'em casa' : 'fora'} e ${adv.team_name} sofre ${n1(defesa)} ${emCasa ? 'fora' : 'em casa'}`,
      comparacao: {
        esqLabel: `${time.team_name} marca`,
        esqValor: ataque,
        dirLabel: `${adv.team_name} sofre`,
        dirValor: defesa,
        // Neutro: os dois números altos favorecem a aposta, então não existe lado
        // "melhor" aqui.
        destaque: 'nenhum',
      },
    };
  },

  'match_winner:h2h_favoravel': (ctx) => {
    const { time, adv } = porLado(ctx);
    if (!time?.h2h_jogos) return null;
    const v = time.h2h_vitorias ?? 0;
    const e = time.h2h_empates ?? 0;
    const d = time.h2h_jogos - v - e;
    return {
      texto: `Nos últimos ${time.h2h_jogos} confrontos: ${plural(v, 'vitória', 'vitórias')} do ${time.team_name}, ${plural(e, 'empate', 'empates')} e ${plural(d, 'vitória', 'vitórias')} do ${adv?.team_name ?? 'adversário'}`,
      comparacao: {
        esqLabel: time.team_name,
        esqValor: v,
        dirLabel: adv?.team_name ?? 'Adversário',
        dirValor: d,
        destaque: 'nenhum',
      },
    };
  },

  'double_chance:invicto_recente': (ctx) => BUILDERS['match_winner:forma'](ctx),

  // ── Gols ───────────────────────────────────────────────────
  'goals_over_under:ataque_combinado': (ctx) => {
    if (!ctx.casa || !ctx.fora) return null;
    const a = ctx.casa.gf_casa ?? ctx.casa.gf_total;
    const b = ctx.fora.gf_fora ?? ctx.fora.gf_total;
    if (a == null || b == null) return null;
    return {
      texto: `Somados, marcam ${n1(a + b)} gols por jogo`,
      comparacao: {
        esqLabel: `${ctx.casa.team_name} em casa`,
        esqValor: a,
        dirLabel: `${ctx.fora.team_name} fora`,
        dirValor: b,
        destaque: 'nenhum',
      },
    };
  },

  'goals_over_under:ataques_fracos': (ctx) => {
    if (!ctx.casa || !ctx.fora) return null;
    const a = ctx.casa.gf_casa ?? ctx.casa.gf_total;
    const b = ctx.fora.gf_fora ?? ctx.fora.gf_total;
    if (a == null || b == null) return null;
    return BUILDERS['goals_over_under:ataque_combinado']({ ...ctx, acesa: false });
  },

  'goals_over_under:defesas_vazaveis': (ctx) => {
    if (!ctx.casa || !ctx.fora) return null;
    const a = ctx.casa.ga_casa ?? ctx.casa.ga_total;
    const b = ctx.fora.ga_fora ?? ctx.fora.ga_total;
    if (a == null || b == null) return null;
    return {
      texto: `Somados, sofrem ${n1(a + b)} gols por jogo`,
      comparacao: {
        esqLabel: `${ctx.casa.team_name} sofre em casa`,
        esqValor: a,
        dirLabel: `${ctx.fora.team_name} sofre fora`,
        dirValor: b,
        destaque: 'nenhum',
      },
    };
  },

  'goals_over_under:defesas_firmes': (ctx) => {
    if (!ctx.casa || !ctx.fora) return null;
    const a = ctx.casa.ga_casa ?? ctx.casa.ga_total;
    const b = ctx.fora.ga_fora ?? ctx.fora.ga_total;
    if (a == null || b == null) return null;
    return BUILDERS['goals_over_under:defesas_vazaveis']({ ...ctx, acesa: false });
  },

  'goals_over_under:clean_sheets_altos': (ctx) => {
    if (!ctx.casa || !ctx.fora) return null;
    if (ctx.casa.clean_sheets == null || ctx.fora.clean_sheets == null) return null;
    return {
      texto: `Jogos sem sofrer gol: ${ctx.casa.clean_sheets} de ${ctx.casa.jogos ?? '—'} e ${ctx.fora.clean_sheets} de ${ctx.fora.jogos ?? '—'}`,
      comparacao: {
        esqLabel: ctx.casa.team_name,
        esqValor: ctx.casa.clean_sheets,
        dirLabel: ctx.fora.team_name,
        dirValor: ctx.fora.clean_sheets,
        destaque: 'nenhum',
      },
    };
  },

  // ── Handicap ───────────────────────────────────────────────
  'asian_handicap:supremacia': (ctx) => BUILDERS['match_winner:superioridade_tabela'](ctx),
  'asian_handicap:mando_forte': (ctx) => BUILDERS['match_winner:mando'](ctx),

  // O adversário joga no mando OPOSTO ao do time apostado. Com `ga_fora` fixo, a
  // aposta no visitante mostrava a defesa do mandante FORA de casa, num jogo em que
  // ele joga em casa.
  'asian_handicap:adversario_fragil_fora': (ctx) => {
    const { adv, emCasa } = porLado(ctx);
    if (!adv) return null;
    const ga = emCasa ? adv.ga_fora : adv.ga_casa;
    const jogos = emCasa ? adv.jogos_fora : adv.jogos_casa;
    if (ga == null) return null;
    return {
      texto: `${adv.team_name} sofre ${n1(ga)} gol por jogo ${emCasa ? 'fora de casa' : 'em casa'}, em ${jogos ?? '—'} jogos`,
    };
  },

  // Mesma correção do outro lado: o azarão pode ser o mandante, e aí a defesa que
  // importa é a de casa.
  'asian_handicap:defesa_fora_solida': (ctx) => {
    const { time, emCasa } = porLado(ctx);
    if (!time) return null;
    const ga = emCasa ? time.ga_casa : time.ga_fora;
    const jogos = emCasa ? time.jogos_casa : time.jogos_fora;
    if (ga == null) return null;
    return {
      texto: `${time.team_name} sofre ${n1(ga)} gol por jogo ${emCasa ? 'em casa' : 'fora'}, em ${jogos ?? '—'} jogos`,
    };
  },

  'asian_handicap:tende_golear': (ctx) => {
    const { time, adv, emCasa } = porLado(ctx);
    if (!time || !adv) return null;
    const ataque = emCasa ? time.gf_casa : time.gf_fora;
    const defesa = emCasa ? adv.ga_fora : adv.ga_casa;
    if (ataque == null || defesa == null) return null;
    return {
      texto: `Marca ${n1(ataque)} por jogo contra quem sofre ${n1(defesa)}`,
      comparacao: {
        esqLabel: `${time.team_name} marca`,
        esqValor: ataque,
        dirLabel: `${adv.team_name} sofre`,
        dirValor: defesa,
        destaque: 'nenhum',
      },
    };
  },

  // ── Ambos marcam ───────────────────────────────────────────
  'btts:ambos_marcam': (ctx) => {
    if (!ctx.casa || !ctx.fora) return null;
    if (ctx.casa.sem_marcar == null || ctx.fora.sem_marcar == null) return null;
    return {
      texto: `Passaram em branco em ${ctx.casa.sem_marcar} e ${ctx.fora.sem_marcar} jogos de ${ctx.casa.jogos ?? '—'}`,
      comparacao: {
        esqLabel: `${ctx.casa.team_name} marca`,
        esqValor: ctx.casa.gf_total ?? 0,
        dirLabel: `${ctx.fora.team_name} marca`,
        dirValor: ctx.fora.gf_total ?? 0,
        destaque: 'nenhum',
      },
    };
  },

  'btts:ataque_dos_dois': (ctx) => BUILDERS['goals_over_under:ataque_combinado'](ctx),
  'btts:defesa_forte': (ctx) => BUILDERS['goals_over_under:defesas_vazaveis'](ctx),
  // ⚠️ A colisão, agora escrita. Antes ela era servida pela chave de Gols só
  // porque o nome coincide; a linha existe para o comportamento não mudar neste
  // commit, e para a entrada errada ter onde ser apagada no conserto.
  //
  // O que ela desenha: "Somados, sofrem X gols por jogo". O que o critério
  // compara: `home_cs_pct < 35 AND away_cs_pct < 35`, o percentual de jogos sem
  // sofrer gol de CADA time. Duas perguntas diferentes.
  'btts:defesas_vazaveis': (ctx) => BUILDERS['goals_over_under:defesas_vazaveis'](ctx),

  // ── Dupla chance ───────────────────────────────────────────
  'double_chance:lado_coberto_forte': (ctx) => BUILDERS['match_winner:superioridade_tabela'](ctx),
  'double_chance:adversario_limitado': (ctx) => {
    const { adv } = porLado(ctx);
    if (!adv || adv.gf_total == null) return null;
    // Sem posição a frase PARA no aproveitamento, em vez de escrever "está em
    // —º". Em mata-mata — Copa do Brasil, Libertadores na fase eliminatória —
    // não existe tabela, então a colocação não é um dado que faltou: é uma
    // pergunta que não se faz naquela competição. O traço fazia a tela parecer
    // quebrada num caso em que ela está certa.
    const tabela = adv.posicao != null ? ` e está em ${adv.posicao}º` : '';
    return { texto: `${adv.team_name} marca ${n1(adv.gf_total)} gol por jogo${tabela}` };
  },
};

/**
 * A evidência de uma premissa, ou null quando não existe métrica agregada no mart
 * para embasá-la. Null é resposta legítima: melhor a tela dizer que não tem número
 * do que inventar um.
 */
export function evidenciaDe(
  mercado: string,
  slug: string,
  numeros: FutebolFixtureNumeros[] | undefined,
  lado: 'home' | 'away' | null,
  acesa = true,
  linha: number | null = null,
): Evidencia | null {
  if (!numeros?.length) return null;
  const ctx: Ctx = {
    casa: numeros.find((x) => x.side === 'home'),
    fora: numeros.find((x) => x.side === 'away'),
    lado,
    acesa,
    linha,
  };
  const b = BUILDERS[`${mercado}:${slug}`];
  if (!b) return null;
  try {
    return b(ctx);
  } catch {
    return null;
  }
}

/** O lado do confronto a que a saída se refere, quando existe. */
export function ladoDaSaida(market: string, outcome: string): 'home' | 'away' | null {
  if (market === 'match_winner' || market === 'asian_handicap') {
    if (outcome === 'Home') return 'home';
    if (outcome === 'Away') return 'away';
    return null;
  }
  if (market === 'double_chance') {
    if (outcome === '1X') return 'home';
    if (outcome === 'X2') return 'away';
    return null;
  }
  return null;
}

/**
 * Um número-manchete do confronto.
 *
 * Forma escolhida pela skill de dataviz: "um punhado de números-manchete" pede uma
 * KPI row de stat tiles, e explicitamente NÃO um gráfico de barras agrupadas. A
 * versão anterior desta tela desenhava duas barrinhas por premissa, que é o item da
 * coluna "não" daquela tabela. O contrato do tile também vem de lá: label em frase,
 * sem dois-pontos, valor semibold, sub opcional.
 */
export interface Tile {
  label: string;
  valor: string;
  sub?: string;
  /** Destaca em forest. Um por linha no máximo, senão nada destaca nada. */
  forte?: boolean;
}

/**
 * Os 3 ou 4 números que importam naquele mercado. Escolhidos por mercado porque
 * "gols somados" não diz nada num 1X2 e "campanha em casa" não diz nada num over.
 */
export function tilesDe(
  market: string,
  numeros: FutebolFixtureNumeros[] | undefined,
  lado: 'home' | 'away' | null,
): Tile[] {
  if (!numeros?.length) return [];
  const casa = numeros.find((x) => x.side === 'home');
  const fora = numeros.find((x) => x.side === 'away');
  if (!casa || !fora) return [];
  // acesa: false — tiles são "números do confronto", dado neutro; as guardas de
  // contradição só valem para número colado numa premissa acesa.
  const { time, adv, emCasa } = porLado({ casa, fora, lado, acesa: false, linha: null });

  if (market === 'goals_over_under' || market === 'btts') {
    const gfCasa = casa.gf_casa ?? casa.gf_total;
    const gfFora = fora.gf_fora ?? fora.gf_total;
    const gaCasa = casa.ga_casa ?? casa.ga_total;
    const gaFora = fora.ga_fora ?? fora.ga_total;
    const tiles: Tile[] = [];
    if (gfCasa != null && gfFora != null) {
      tiles.push({
        label: 'Gols somados por jogo',
        valor: n1(gfCasa + gfFora),
        sub: `${casa.team_name} ${n1(gfCasa)} em casa · ${fora.team_name} ${n1(gfFora)} fora`,
        forte: true,
      });
    }
    if (gaCasa != null) tiles.push({ label: `${casa.team_name} sofre em casa`, valor: n1(gaCasa), sub: 'gol por jogo' });
    if (gaFora != null) tiles.push({ label: `${fora.team_name} sofre fora`, valor: n1(gaFora), sub: 'gol por jogo' });
    if (casa.clean_sheets != null && fora.clean_sheets != null) {
      tiles.push({
        label: 'Jogos sem sofrer gol',
        valor: `${casa.clean_sheets} e ${fora.clean_sheets}`,
        sub: `de ${casa.jogos ?? '—'} jogos`,
      });
    }
    return tiles.slice(0, 4);
  }

  // Mercados com lado: 1X2, handicap, dupla chance.
  if (!time || !adv) return [];
  const tiles: Tile[] = [];
  const j = emCasa ? time.jogos_casa : time.jogos_fora;
  const v = emCasa ? time.v_casa : time.v_fora;
  const e = emCasa ? time.e_casa : time.e_fora;
  const d = emCasa ? time.d_casa : time.d_fora;
  if (j != null) {
    tiles.push({
      label: `Campanha ${emCasa ? 'em casa' : 'fora'}`,
      valor: `${v ?? 0}V ${e ?? 0}E ${d ?? 0}D`,
      sub: `em ${j} jogos`,
      forte: true,
    });
  }
  const ataque = emCasa ? time.gf_casa : time.gf_fora;
  if (ataque != null) {
    tiles.push({ label: `${time.team_name} marca`, valor: n1(ataque), sub: `${emCasa ? 'em casa' : 'fora'}, por jogo` });
  }
  const defesaAdv = emCasa ? adv.ga_fora : adv.ga_casa;
  if (defesaAdv != null) {
    tiles.push({
      label: `${adv.team_name} sofre`,
      valor: n1(defesaAdv),
      sub: `${emCasa ? 'fora' : 'em casa'}, por jogo`,
    });
  }
  if (time.posicao != null && adv.posicao != null) {
    tiles.push({
      label: 'Na tabela',
      valor: `${time.posicao}º e ${adv.posicao}º`,
      sub: `${Math.abs((time.pontos ?? 0) - (adv.pontos ?? 0))} pontos de diferença`,
    });
  }
  return tiles.slice(0, 4);
}

export { n1, n2 };
