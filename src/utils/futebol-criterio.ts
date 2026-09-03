import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import { storyDaPremissa, type Story } from '@/utils/futebol-historico';

// A premissa prestando contas do modelo (spec #349, issues #353, #354, #355).
//
// O que este módulo responde, para uma premissa: qual **insumo** o modelo
// comparou, contra que **corte**, se cruzou, e sobre que base de jogos. É o
// vocabulário do CONTEXT.md, e é ele que a tela passa a exibir no lugar de "fica
// abaixo da linha".
//
// ── Por que ele existe ──────────────────────────────────────────────────────
//
// O card de "defesas firmes" dizia "2,4 gols sofridos por jogo" com o subtítulo
// dizendo 2,3 — dois números para a mesma afirmação, de duas fontes: o card lia o
// perfil de temporada (RPC 094) e o subtítulo lia o histórico jogo a jogo (095).
// E explicava com "fica abaixo da linha de 3,25", quando o corte real é 2,95: a
// premissa NÃO acende com 3,10, que fica abaixo da linha. Havia uma faixa inteira
// em que a tela afirmava uma coisa e o modelo fazia outra.
//
// E "os dois passam muitos jogos sem sofrer gol" vinha ilustrado com "2,4 gols
// sofridos por jogo, somando os dois" — um número verdadeiro que não é o insumo
// daquela premissa, e que dizia o contrário do que a frase acima dele afirmava.
//
// ── A decisão de desenho ────────────────────────────────────────────────────
//
// O insumo sai do MESMO `storyDaPremissa` que desenha as barras. Não é
// conveniência: é o que impede card e gráfico de voltarem a divergir. Duas
// derivações do mesmo número divergem — foi o que produziu o 2,4 contra 2,3, e
// depois, dentro do próprio conserto da #350, o número do xG ficando para trás do
// gráfico. Uma origem só é a única forma que não depende de vigilância.
//
// ⚠️ Derivar o veredito aqui cria uma SEGUNDA implementação do critério, ao lado
// da do modelo. É deliberado — sem ela a tela não tem como mostrar o número —,
// e vem com detector: `divergenciaDaPrestacao` compara a nossa conta com o
// booleano do mart e acusa quando discordam. Não silencie o detector; ele é o
// preço da derivação.

/**
 * O jeito de desenhar o card, que é consequência da FAMÍLIA do critério.
 *
 * `media_combinada`: os dois times somam uma média e o total vai contra o corte.
 * `percentual_por_time`: cada time tem o seu percentual e o seu veredito, sem
 * soma — somar percentuais de times diferentes não significa nada.
 *
 * A família de contagem entra na #356.
 */
export type FormaDeCard = 'media_combinada' | 'percentual_por_time';

/**
 * Como as parcelas viram um veredito só.
 *
 * `soma`: as parcelas somam e o total vai contra o corte.
 * `e`: cada parcela vai contra o corte, e as duas precisam cruzar.
 * `ou`: cada parcela vai contra o corte, e basta uma cruzar.
 *
 * A distinção entre `e` e `ou` PRECISA chegar à tela: sem ela o assinante vê um
 * time abaixo do corte e não entende por que a premissa acendeu.
 */
export type Combinacao = 'soma' | 'e' | 'ou';

/** De que lado do corte o valor tem de estar para contar a favor. */
export type Sentido = 'acima' | 'abaixo';

/** Como o número se escreve: 2,4 gols ou 40%. */
export type Escala = 'gols' | 'percentual';

/** A conta de um time. É ela que o card desenha e que a base de jogos declara. */
export interface Parcela {
  teamId: number;
  teamName: string;
  valor: number;
  /**
   * Esta parcela sozinha cruzou o corte?
   *
   * `null` quando a combinação é `soma`: ali o corte é do total, e afirmar que um
   * time "cruzou" seria comparar contra um limiar que não é dele.
   */
  cruzou: boolean | null;
  /** Jogos que alimentaram o número. */
  jogos: number;
  /** Jogos que a janela tinha antes do recorte de mando. Igual a `jogos` sem recorte. */
  daJanela: number;
}

export interface Prestacao {
  mercado: string;
  slug: string;
  forma: FormaDeCard;
  combinacao: Combinacao;
  sentido: Sentido;
  escala: Escala;
  /**
   * A soma das parcelas, quando a combinação é `soma`. `null` nas outras.
   *
   * Nulo e não zero: numa premissa de percentual por time não existe um número
   * único, e inventar um (a soma, a média) seria a tela publicando uma conta que
   * o modelo não faz.
   */
  insumo: number | null;
  /** O limiar contra o qual o insumo é comparado. */
  corte: number;
  /** A linha da saída, quando o corte sai dela. `null` quando o corte é fixo. */
  linha: number | null;
  /** A margem entre a linha e o corte. `null` quando o corte é fixo, zero onde a premissa compara contra a linha crua. */
  margem: number | null;
  /** O veredito, já combinado. É a nossa conta, não a do mart. */
  cruzou: boolean;
  parcelas: Parcela[];
  /** "gols sofridos por jogo, somados" — o que o número É, em palavras. */
  unidade: string;
}

/**
 * Um critério do modelo, transcrito.
 *
 * O corte é `da_linha` na família de média, porque ali ele é a linha mais uma
 * margem que varia por premissa (incluindo uma que é zero). É `fixo` na família
 * de percentual: 40% é 40% em qualquer linha.
 */
interface Criterio {
  forma: FormaDeCard;
  combinacao: Combinacao;
  sentido: Sentido;
  escala: Escala;
  unidade: string;
  corte: { de: 'linha'; margem: number } | { de: 'fixo'; valor: number };
  /**
   * Quantas parcelas o insumo tem.
   *
   * Declarado, e não inferido do que veio: com um lado só, a soma seria um número
   * que o modelo nunca comparou, e ele seria BAIXO — ou seja, a ausência de dado
   * acenderia a premissa. Contar é o que separa "faltou um lado" de "os dois
   * vieram". Vale para `e` e `ou` também: um `ou` com um lado faltando pode
   * acender por sorte de quem sobrou.
   */
  parcelas: number;
}

/**
 * Os critérios, por mercado e slug.
 *
 * ⚠️ A chave é `mercado:slug`, e não o slug sozinho. `defesas_vazaveis` existe no
 * mercado de gols (média de gols sofridos contra a linha) e no de ambos marcam
 * (percentual de clean sheet de cada time) — critérios de famílias diferentes com
 * o mesmo nome. O mapa de gráficos ainda é indexado só por slug e por isso serve o
 * gráfico errado ao BTTS; ver a #361. Aqui a chave já nasce certa.
 *
 * Transcritos de `int_futebol_premissas_ou`, CTE `flags`, no estado atual do
 * modelo — a metodologia nova, já sem as premissas de preço (#103, ADR 0012).
 */
const CRITERIOS: Record<string, Criterio> = {
  // ── Família de média combinada (#353, #354) ──
  // Os dois times somam uma média e o total vai contra a linha com uma margem.
  //
  //     (Under) ga_comb <= line_value - 0.3   AS defesas_firmes
  'goals_over_under:defesas_firmes': {
    forma: 'media_combinada',
    combinacao: 'soma',
    sentido: 'abaixo',
    escala: 'gols',
    unidade: 'gols sofridos por jogo, somados',
    corte: { de: 'linha', margem: -0.3 },
    parcelas: 2,
  },
  // ⚠️ MARGEM ZERO, e não é esquecimento: `ga_comb >= line_value`, sem margem
  // nenhuma. É a única das cinco assim, e por isso é a única em que "fica acima
  // da linha" é uma frase verdadeira. A tela não desenha a marca da linha nela,
  // porque corte e linha são o mesmo traço.
  'goals_over_under:defesas_vazaveis': {
    forma: 'media_combinada',
    combinacao: 'soma',
    sentido: 'acima',
    escala: 'gols',
    unidade: 'gols sofridos por jogo, somados',
    corte: { de: 'linha', margem: 0 },
    parcelas: 2,
  },
  // A margem mais larga das cinco: meio gol acima da linha.
  'goals_over_under:ataque_combinado': {
    forma: 'media_combinada',
    combinacao: 'soma',
    sentido: 'acima',
    escala: 'gols',
    unidade: 'gols marcados por jogo, somados',
    corte: { de: 'linha', margem: 0.5 },
    parcelas: 2,
  },
  'goals_over_under:xg_combinado_alto': {
    forma: 'media_combinada',
    combinacao: 'soma',
    sentido: 'acima',
    escala: 'gols',
    unidade: 'gols esperados por jogo, somados',
    corte: { de: 'linha', margem: 0.3 },
    parcelas: 2,
  },
  'goals_over_under:xg_baixo_combinado': {
    forma: 'media_combinada',
    combinacao: 'soma',
    sentido: 'abaixo',
    escala: 'gols',
    unidade: 'gols esperados por jogo, somados',
    corte: { de: 'linha', margem: -0.3 },
    parcelas: 2,
  },

  // ── Família de percentual por time (#355) ──
  // O critério olha o percentual de CADA time separadamente contra um corte fixo.
  // Não soma nada, e o corte não tem relação com a linha.
  //
  //     (Under) home_cs_pct  >= 40 AND away_cs_pct  >= 40  AS clean_sheets_altos
  //     (Over)  home_cs_pct  <  35 AND away_cs_pct  <  35  AS ambos_vazam
  //     (Under) home_fts_pct >= 35 OR  away_fts_pct >= 35  AS ataques_fracos
  'goals_over_under:clean_sheets_altos': {
    forma: 'percentual_por_time',
    combinacao: 'e',
    sentido: 'acima',
    escala: 'percentual',
    unidade: 'dos jogos sem sofrer gol',
    corte: { de: 'fixo', valor: 40 },
    parcelas: 2,
  },
  // ⚠️ O sentido é ABAIXO e o corte é `<`, não `<=`: `home_cs_pct < 35`. Exatamente
  // 35% NÃO acende. É o único da família com comparação estrita, e por isso ele
  // tem `estrito` embaixo — ver `cruzouParcela`.
  'goals_over_under:ambos_vazam': {
    forma: 'percentual_por_time',
    combinacao: 'e',
    sentido: 'abaixo',
    escala: 'percentual',
    unidade: 'dos jogos sem sofrer gol',
    corte: { de: 'fixo', valor: 35 },
    parcelas: 2,
  },
  // O único `OU` do mercado de gols: basta UM time passar do corte. A tela precisa
  // dizer isso, senão o assinante vê um time abaixo e não entende o veredito.
  'goals_over_under:ataques_fracos': {
    forma: 'percentual_por_time',
    combinacao: 'ou',
    sentido: 'acima',
    escala: 'percentual',
    unidade: 'dos jogos sem marcar',
    corte: { de: 'fixo', valor: 35 },
    parcelas: 2,
  },
};

/**
 * A comparação de `ambos_vazam` é ESTRITA (`< 35`), e a das outras é inclusiva
 * (`>= 40`, `<= linha - 0.3`).
 *
 * Mora numa lista, e não num campo do critério, porque é uma exceção de UMA
 * premissa: um campo `estrito: false` em oito entradas seria ruído em oito lugares
 * para marcar um caso. Errar isto por um passo erra a premissa numa faixa
 * estreita, que é o tipo de defeito que ninguém vê na tela.
 */
const COMPARACAO_ESTRITA = new Set(['goals_over_under:ambos_vazam']);

/** Arredonda para duas casas: soma de médias em ponto flutuante rende 2,9500000000000004. */
const duasCasas = (v: number) => Math.round(v * 100) / 100;

const cruzouCorte = (valor: number, corte: number, sentido: Sentido, estrito: boolean): boolean => {
  if (sentido === 'acima') return estrito ? valor > corte : valor >= corte;
  return estrito ? valor < corte : valor <= corte;
};

/**
 * A premissa prestando contas: insumo, corte, veredito e base de jogos.
 *
 * `null` quando não há o que prestar — premissa sem critério transcrito, saída sem
 * linha onde o corte vem dela, ou histórico que não produz o número. **Sem dado é
 * `null`, nunca zero**: uma defesa sem jogos não "sofre 0 gols por jogo", e
 * mostrar o zero seria a tela inventando a premissa mais forte possível a partir
 * da ausência.
 */
export function prestacaoDaPremissa(
  mercado: string,
  slug: string,
  hist: FutebolFixtureHistorico[] | undefined,
  lado: 'home' | 'away' | null,
  linha: number | null,
): Prestacao | null {
  const criterio = CRITERIOS[`${mercado}:${slug}`];
  if (!criterio) return null;
  if (criterio.corte.de === 'linha' && linha == null) return null;

  const story = storyDaPremissa(slug, hist, lado, linha);
  if (!story) return null;

  return prestacaoDoStory(mercado, slug, criterio, story, linha);
}

function prestacaoDoStory(
  mercado: string,
  slug: string,
  criterio: Criterio,
  story: Story,
  linha: number | null,
): Prestacao | null {
  const corte =
    criterio.corte.de === 'fixo' ? criterio.corte.valor : duasCasas(linha! + criterio.corte.margem);
  const estrito = COMPARACAO_ESTRITA.has(`${mercado}:${slug}`);
  // O percentual sai da fração que a série mede: a métrica é binária, então a
  // média das barras já é "quantos dos jogos", e o ×100 é só a escala.
  const emEscala = (v: number) => (criterio.escala === 'percentual' ? v * 100 : v);

  const parcelas: Parcela[] = [];
  // Soma em precisão cheia, como o modelo faz. Arredondar cada parcela ANTES de
  // somar move o total em até meio centésimo por parcela, e no corte isso vira
  // veredito trocado: 1,475 + 1,475 é 2,95, mas 1,48 + 1,48 é 2,96.
  let cru = 0;
  for (const s of story.series) {
    // Uma série sem média derruba a prestação inteira.
    if (s.media == null) return null;
    const valor = emEscala(s.media);
    cru += valor;
    parcelas.push({
      teamId: s.teamId,
      teamName: s.teamName,
      valor: duasCasas(valor),
      cruzou:
        criterio.combinacao === 'soma'
          ? null
          : cruzouCorte(duasCasas(valor), corte, criterio.sentido, estrito),
      jogos: s.jogos.length,
      daJanela: s.daJanela,
    });
  }
  // Faltou um lado: `storyDaPremissa` pula a série do time sem jogos no recorte.
  if (parcelas.length !== criterio.parcelas) return null;

  const insumo = criterio.combinacao === 'soma' ? duasCasas(cru) : null;
  const cruzou =
    criterio.combinacao === 'soma'
      ? cruzouCorte(insumo!, corte, criterio.sentido, estrito)
      : criterio.combinacao === 'e'
        ? parcelas.every((p) => p.cruzou)
        : parcelas.some((p) => p.cruzou);

  return {
    mercado,
    slug,
    forma: criterio.forma,
    combinacao: criterio.combinacao,
    sentido: criterio.sentido,
    escala: criterio.escala,
    insumo,
    corte,
    linha: criterio.corte.de === 'linha' ? linha : null,
    margem: criterio.corte.de === 'linha' ? criterio.corte.margem : null,
    cruzou,
    parcelas,
    unidade: criterio.unidade,
  };
}

/** A premissa tem critério transcrito neste módulo? */
export function temCriterio(mercado: string, slug: string): boolean {
  return CRITERIOS[`${mercado}:${slug}`] != null;
}

/** O número como a escala dele pede: 2,4 gols ou 40%. */
export function numeroDaPrestacao(p: Prestacao, valor: number): string {
  return p.escala === 'percentual'
    ? `${Math.round(valor)}%`
    : valor.toFixed(1).replace('.', ',');
}

/** O corte sai como é: 2,95 é 2,95, e arredondar para 3,0 desfaria o ponto dele. */
export function corteDaPrestacao(p: Prestacao): string {
  return p.escala === 'percentual' ? `${p.corte}%` : String(p.corte).replace('.', ',');
}

/**
 * A frase de uma linha que acompanha a premissa na lista.
 *
 * Sai da MESMA prestação que o card abre, e é isso que resolve a outra metade do
 * "2,4 no card com o subtítulo dizendo 2,3": os dois números eram de fontes
 * diferentes — o card lia o perfil de temporada (RPC 094) e a frase lia o
 * histórico jogo a jogo (095). Agora é um número só, com uma origem só.
 */
export function fraseDaPrestacao(p: Prestacao): string {
  const lado = p.sentido === 'abaixo' ? 'no máximo' : 'pelo menos';
  if (p.insumo != null) {
    return `${numeroDaPrestacao(p, p.insumo)} ${p.unidade} · o corte é ${lado} ${corteDaPrestacao(p)}`;
  }
  const quem = p.combinacao === 'e' ? 'os dois precisam de' : 'basta um com';
  return `${p.parcelas.map((x) => `${x.teamName} ${numeroDaPrestacao(p, x.valor)}`).join(' · ')} ${p.unidade} · ${quem} ${lado} ${corteDaPrestacao(p)}`;
}

export interface Divergencia {
  mercado: string;
  slug: string;
  linha: number | null;
  insumo: number | null;
  corte: number;
  /** O que a nossa derivação concluiu. */
  nossa: boolean;
  /** O que o mart publicou. */
  doMart: boolean;
}

/**
 * A guarda de divergência: a nossa conta discordou do booleano do mart?
 *
 * Existe porque derivar o veredito no front é uma segunda implementação do
 * critério. Ela pode envelhecer sozinha — o modelo muda uma margem e a tela
 * continua com a antiga —, e o sintoma é silencioso: um número correto embaixo de
 * um veredito que não é o dele.
 *
 * ⚠️ NÃO tratar a divergência escondendo o número. Foi o que as guardas
 * `desmenteAlta`/`desmenteBaixa` faziam (#358), e um silenciador ao lado de um
 * detector anula o detector. Quando os dois discordam, quem está errado é a
 * derivação daqui, e é ela que tem de ser corrigida.
 *
 * Pura de propósito: quem emite o evento é o chamador. Assim o caso "discordaram"
 * se testa sem PostHog, sem React e sem rede.
 */
export function divergenciaDaPrestacao(p: Prestacao, acesaNoMart: boolean): Divergencia | null {
  if (p.cruzou === acesaNoMart) return null;
  return {
    mercado: p.mercado,
    slug: p.slug,
    linha: p.linha,
    insumo: p.insumo,
    corte: p.corte,
    nossa: p.cruzou,
    doMart: acesaNoMart,
  };
}

/**
 * As divergências de uma saída inteira, para o chamador emitir de uma vez.
 *
 * Só olha premissas com critério transcrito: para as outras não existe conta
 * nossa, então não existe discordância a acusar.
 */
export function divergenciasDaSaida(
  mercado: string,
  acesas: readonly string[],
  hist: FutebolFixtureHistorico[] | undefined,
  lado: 'home' | 'away' | null,
  linha: number | null,
  slugs: readonly string[],
): Divergencia[] {
  const acesasSet = new Set(acesas);
  const fora: Divergencia[] = [];
  for (const slug of slugs) {
    const p = prestacaoDaPremissa(mercado, slug, hist, lado, linha);
    // Sem prestação não há conta nossa — e "não sabemos" não é discordar.
    if (!p) continue;
    const d = divergenciaDaPrestacao(p, acesasSet.has(slug));
    if (d) fora.push(d);
  }
  return fora;
}
