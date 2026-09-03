import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import { storyDaPremissa, type Story } from '@/utils/futebol-historico';

// A premissa prestando contas do modelo (spec #349, issue #353).
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
 * As outras famílias entram com as suas fatias (#355, #356), e cada uma nomeia o
 * que o card precisa desenhar — não o que a premissa quer dizer.
 */
export type FormaDeCard = 'media_combinada';

/** De que lado do corte o insumo tem de estar para a premissa acender. */
export type Sentido = 'acima' | 'abaixo';

/** O que entrou na conta, por time. É a base de jogos que o card declara. */
export interface BaseDeJogos {
  teamId: number;
  teamName: string;
  /** Jogos que alimentaram a média. */
  jogos: number;
  /** Jogos que a janela tinha antes do recorte de mando. Igual a `jogos` sem recorte. */
  daJanela: number;
}

export interface Prestacao {
  mercado: string;
  slug: string;
  forma: FormaDeCard;
  /** O número que o modelo comparou. */
  insumo: number;
  /** O limiar contra o qual ele foi comparado. Não é a linha quando há margem. */
  corte: number;
  /** A linha da saída, para a tela poder dizer de onde o corte saiu. */
  linha: number;
  /** A margem entre a linha e o corte. Zero onde a premissa compara contra a linha crua. */
  margem: number;
  sentido: Sentido;
  /** O insumo cruzou o corte? É a nossa conta, não a do mart. */
  cruzou: boolean;
  /** As parcelas do insumo, na ordem casa/fora. Uma soma sem as parcelas não se confere. */
  parcelas: { teamName: string; valor: number }[];
  base: BaseDeJogos[];
  /** "gols sofridos por jogo, somados" — o que o número É, em palavras. */
  unidade: string;
}

/**
 * Um critério do modelo, transcrito.
 *
 * O `corte` é função da linha porque na família de média ele é a linha mais uma
 * margem — e a margem varia por premissa, incluindo uma que é zero. Guardar o
 * número pronto obrigaria a recalcular a cada régua arrastada.
 */
interface Criterio {
  forma: FormaDeCard;
  /** Somado à linha para chegar ao corte. Negativo aperta, positivo afrouxa. */
  margem: number;
  sentido: Sentido;
  unidade: string;
  /**
   * Quantas parcelas o insumo tem. Na família de média combinada são duas — o
   * mandante e o visitante.
   *
   * Declarado, e não inferido do que veio: com um lado só, a soma seria um número
   * que o modelo nunca comparou, e ele seria BAIXO — ou seja, a ausência de dado
   * acenderia a premissa. Contar é o que separa "faltou um lado" de "os dois
   * vieram".
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
 * modelo — a metodologia nova, já sem as premissas de preço (#103, ADR 0012):
 *
 *     (outcome = 'Under') AND ga_comb <= line_value - 0.3   AS defesas_firmes
 */
const CRITERIOS: Record<string, Criterio> = {
  'goals_over_under:defesas_firmes': {
    forma: 'media_combinada',
    margem: -0.3,
    sentido: 'abaixo',
    unidade: 'gols sofridos por jogo, somados',
    parcelas: 2,
  },
};

/** Arredonda para duas casas: soma de médias em ponto flutuante rende 2,9500000000000004. */
const duasCasas = (v: number) => Math.round(v * 100) / 100;

/**
 * A premissa prestando contas: insumo, corte, veredito e base de jogos.
 *
 * `null` quando não há o que prestar — premissa sem critério transcrito, saída sem
 * linha, ou histórico que não produz média. **Sem dado é `null`, nunca zero**: uma
 * defesa sem jogos não "sofre 0 gols por jogo", e mostrar o zero seria a tela
 * inventando a premissa mais forte possível a partir da ausência.
 */
export function prestacaoDaPremissa(
  mercado: string,
  slug: string,
  hist: FutebolFixtureHistorico[] | undefined,
  lado: 'home' | 'away' | null,
  linha: number | null,
): Prestacao | null {
  const criterio = CRITERIOS[`${mercado}:${slug}`];
  if (!criterio || linha == null) return null;

  const story = storyDaPremissa(slug, hist, lado, linha);
  if (!story) return null;

  return prestacaoDoStory(mercado, slug, criterio, story, linha);
}

function prestacaoDoStory(
  mercado: string,
  slug: string,
  criterio: Criterio,
  story: Story,
  linha: number,
): Prestacao | null {
  const parcelas: { teamName: string; valor: number }[] = [];
  const base: BaseDeJogos[] = [];
  // Soma em precisão cheia, como o modelo faz. Arredondar cada parcela ANTES de
  // somar move o total em até meio centésimo por parcela, e no corte isso vira
  // veredito trocado: 1,475 + 1,475 é 2,95, mas 1,48 + 1,48 é 2,96.
  let cru = 0;
  for (const s of story.series) {
    // Uma série sem média derruba a prestação inteira: o insumo é a SOMA dos dois
    // times, e somar um lado só daria um número que o modelo nunca comparou.
    if (s.media == null) return null;
    cru += s.media;
    parcelas.push({ teamName: s.teamName, valor: duasCasas(s.media) });
    base.push({ teamId: s.teamId, teamName: s.teamName, jogos: s.jogos.length, daJanela: s.daJanela });
  }
  // Faltou um lado: `storyDaPremissa` pula a série do time sem jogos no recorte, e
  // aí a soma seria de um só — um número baixo, que ACENDERIA a premissa a partir
  // da ausência de dado.
  if (parcelas.length !== criterio.parcelas) return null;

  const insumo = duasCasas(cru);
  const corte = duasCasas(linha + criterio.margem);
  return {
    mercado,
    slug,
    forma: criterio.forma,
    insumo,
    corte,
    linha,
    margem: criterio.margem,
    sentido: criterio.sentido,
    // `<=` e `>=`, como no modelo. O valor exatamente no corte ACENDE, e o erro de
    // um passo aqui é justamente a faixa que o defeito da spec produzia.
    cruzou: criterio.sentido === 'acima' ? insumo >= corte : insumo <= corte,
    parcelas,
    base,
    unidade: criterio.unidade,
  };
}

/** A premissa tem critério transcrito neste módulo? */
export function temCriterio(mercado: string, slug: string): boolean {
  return CRITERIOS[`${mercado}:${slug}`] != null;
}

const umaCasa = (v: number) => v.toFixed(1).replace('.', ',');
/** O corte sai como é: 2,95 é 2,95, e arredondar para 3,0 desfaria o ponto dele. */
const exato = (v: number) => String(v).replace('.', ',');

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
  return `${umaCasa(p.insumo)} ${p.unidade} · o corte é ${lado} ${exato(p.corte)}`;
}

export interface Divergencia {
  mercado: string;
  slug: string;
  linha: number;
  insumo: number;
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
