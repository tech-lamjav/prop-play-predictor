// ============================================================
// futebol-score.ts — apresentação do Score (motor é backend)
// ============================================================
import { linhaDaSaida, type Saida } from '@/utils/futebol-saida';
// O Score, edge, premissas, evidências e avisos vêm prontos da
// fact_value_opportunities (pipeline dbt no BigQuery). Aqui só ROTULAMOS
// (mercado, pick com linha) e ajudamos a ranquear/agrupar. Nada de cálculo.
// Mercados: Resultado (1X2), Gols (Over/Under), Handicap asiático, Ambos marcam e Dupla chance.
// ============================================================
import type { FutebolFixtureValueRow, FutebolValueBoardRow } from '@/services/futebol-data.service';
import type { FutebolScoreVersion } from '@/services/futebol-score-contract';

export type Faixa = 'alta' | 'media' | 'baixa';

/** Normaliza a faixa do backend ('Alta'|'Média'|'Baixa') para tom de UI. */
export function faixaTone(faixa: string): Faixa {
  const f = (faixa || '').toLowerCase();
  if (f.startsWith('alta')) return 'alta';
  if (f.startsWith('m')) return 'media';
  return 'baixa';
}

/** Palavra da faixa em PT (normalizada). */
export function faixaWord(faixa: string): string {
  const t = faixaTone(faixa);
  return t === 'alta' ? 'Alta' : t === 'media' ? 'Média' : 'Baixa';
}

/** Classes do selo de Score por faixa: Alta=forest preenchido · Média=âmbar tint · Baixa=cinza. */
export function faixaBadgeCls(faixa: string): string {
  switch (faixaTone(faixa)) {
    case 'alta': return 'bg-forest text-canvas';
    case 'media': return 'bg-amber/15 text-amber-2 border border-amber/40';
    default: return 'bg-canvas-2 text-ink-3 border border-line';
  }
}

/** Cor da borda-esquerda (color-spine) da linha/card por faixa. */
export function faixaSpineCls(faixa: string): string {
  switch (faixaTone(faixa)) {
    case 'alta': return 'border-l-forest';
    case 'media': return 'border-l-amber';
    default: return 'border-l-line-2';
  }
}

/** 1ª evidência (o "por quê" curto) pra mostrar na lista; vazio se não houver. */
export function topEvidencia(evidencias: string[] | null | undefined): string | null {
  return evidencias && evidencias.length ? evidencias[0] : null;
}

/** Nome do mercado em PT. */
export function marketLabel(market: string): string {
  if (market === 'match_winner') return 'Vencedor (1X2)';
  if (market === 'goals_over_under') return 'Gols (Over/Under)';
  if (market === 'asian_handicap') return 'Handicap asiático';
  if (market === 'btts') return 'Ambos marcam';
  if (market === 'double_chance') return 'Dupla chance';
  return market;
}

/**
 * Nome curto do mercado, para etiqueta em caixa alta na lista e no painel da
 * agenda. "Gols (Over/Under)" em 9px com letter-spacing vira uma tira de ruído.
 */
export function marketShort(market: string): string {
  if (market === 'match_winner') return 'Resultado';
  if (market === 'goals_over_under') return 'Gols';
  if (market === 'asian_handicap') return 'Handicap';
  if (market === 'btts') return 'Ambos marcam';
  if (market === 'double_chance') return 'Dupla chance';
  return market;
}

/** Linha do handicap com sinal e vírgula decimal (ex.: -1,5 / +1,5). */
function fmtHandicapLine(line: number): string {
  const sign = line > 0 ? '+' : line < 0 ? '−' : '';
  return `${sign}${String(Math.abs(line)).replace('.', ',')}`;
}

/** Outcome do 1X2 em PT. */
export function outcomePt(outcome: string, homeName: string, awayName: string): string {
  switch (outcome) {
    case 'Home': return homeName;
    case 'Away': return awayName;
    case 'Draw': return 'Empate';
    default: return outcome;
  }
}

/** Rótulo da aposta (pick), por mercado — inclui a linha no Over/Under. */
export function pickLabel(s: Saida, homeName: string, awayName: string): string {
  const { market, outcome, line_value: line } = s;
  if (market === 'goals_over_under') {
    const n = line != null ? String(line).replace('.', ',') : '';
    return outcome === 'Over' ? `Mais de ${n} gols` : `Menos de ${n} gols`;
  }
  if (market === 'asian_handicap') {
    const team = outcome === 'Home' ? homeName : awayName;
    const sideLine = linhaDaSaida(s);
    return sideLine != null ? `${team} ${fmtHandicapLine(sideLine)}` : team;
  }
  if (market === 'btts') {
    return outcome === 'Yes' ? 'Sim' : 'Não';
  }
  if (market === 'double_chance') {
    // 1X = mandante ou empate · X2 = empate ou visitante (aposta de proteção)
    return outcome === '1X' ? `${homeName} ou empate` : `Empate ou ${awayName}`;
  }
  return outcomePt(outcome, homeName, awayName);
}

/** Palavra do veredito a partir do tamanho do edge (não do Score). */
export function valorVerdict(edge: number): string {
  const e = edge * 100;
  if (e >= 4) return 'Valor forte';
  if (e >= 2) return 'Valor';
  return 'Valor leve';
}

/** Frequência mastigada: "se paga em ~X de 10". */
export function freqEmDez(odd: number): number {
  return Math.max(1, Math.round(10 / odd));
}

export const fmtPctScore = (p: number) => `${Math.round(p * 100)}%`;
export const fmtEdgeScore = (e: number) => `${e >= 0 ? '+' : ''}${(e * 100).toFixed(1)}%`;

/** "Chance" (%) a partir da prob justa devigada (0..1). null se ausente. */
export function chancePct(prob: number | null | undefined): number | null {
  return typeof prob === 'number' && isFinite(prob) && prob > 0 ? Math.round(prob * 100) : null;
}

/** Melhor outcome do jogo (maior Score). */
export function bestOf(rows: FutebolFixtureValueRow[]): FutebolFixtureValueRow | null {
  return rows.reduce<FutebolFixtureValueRow | null>((b, r) => (b == null || r.score > b.score ? r : b), null);
}

/**
 * Fronteiras do Score de contexto (spec #301). As duas pertencem à faixa de
 * cima: 30 é Média, 60 é Alta.
 *
 * Elas existem aqui para a LEGENDA declarar o número certo, e para mais nada.
 * Quem classifica é o backend: a faixa chega pronta na resposta, e o front que
 * recalcula é o front que discorda da metodologia sem saber. Por isso estes
 * números têm de ser os MESMOS do `CASE` das faixas no mart — se divergirem, a
 * legenda mente em cima de um rótulo correto.
 *
 * ⚠️ Eram 25 e 55, medidos pela #107. Viraram 30 e 60 por DECISÃO DE PRODUTO em
 * 01/09/2026, registrada na `analytics-engineering#109`, e não por leitura de
 * evidência: a #107 concluiu que nenhum par da grade discrimina — os oito
 * passam nas restrições de forma e nenhum separa Alta de Baixa além de um
 * erro-padrão. O 30/60 está na mesma grade medida, então não é número novo.
 *
 * O que ele compra, contra o 25/55: a faixa Alta deixa de ser a segunda melhor
 * e passa a ser a melhor (ROI −3,6 contra −4,6), e o board padrão encolhe de
 * 63,5% para 52,8% do total. O que ele não conserta: a Média segue sendo o
 * fundo, igual ao 25/55 — faixa é rótulo, não porta.
 */
export const FAIXA_MEDIA_MIN = 30;
export const FAIXA_ALTA_MIN = 60;

/**
 * As fronteiras da escala em que a nota foi calculada.
 *
 * Durante a janela da virada o board ainda chega em `legacy`, e anunciar 55+ ao
 * lado de uma nota legacy de 57 classificaria errado na cara do usuário: ela é
 * Média naquela escala. A versão não aparece na tela, mas decide o número que
 * a legenda mostra.
 */
export function fronteirasDoScore(versao: FutebolScoreVersion): { media: number; alta: number } {
  return versao === 'contexto_v1'
    ? { media: FAIXA_MEDIA_MIN, alta: FAIXA_ALTA_MIN }
    : { media: 40, alta: 60 };
}

/**
 * A escala de uma janela da tela.
 *
 * `indefinida` cobre os dois casos em que não dá para afirmar um corte: a janela
 * mistura as duas escalas (acontece no dia da virada, quando a foto do apito
 * ainda é legacy e o board já é contexto_v1), ou não há linha nenhuma que
 * declare a sua escala.
 */
export type VersaoDaJanela = FutebolScoreVersion | 'indefinida';

/**
 * Só vota quem declara a escala. Linha sem o campo — a oportunidade registrada,
 * que vem de uma tabela que nunca guardou versão — se abstém, em vez de contar
 * como legacy: contando, quase todo dia teria uma e a legenda ficaria sem
 * números para sempre, não só na virada.
 */
export function versaoDaJanela(
  linhas: readonly { score_versao?: FutebolScoreVersion }[],
): VersaoDaJanela {
  let temLegacy = false;
  let temContexto = false;
  for (const l of linhas) {
    if (l.score_versao === 'contexto_v1') temContexto = true;
    else if (l.score_versao === 'legacy') temLegacy = true;
  }
  if (temContexto && !temLegacy) return 'contexto_v1';
  if (temLegacy && !temContexto) return 'legacy';
  return 'indefinida';
}

/**
 * As três faixas, na ordem em que a legenda as apresenta.
 *
 * Numa janela indefinida o selo sai: ou as duas escalas convivem e um número
 * descreveria errado metade da lista, ou não há linha nenhuma declarando escala
 * e o número seria chute. As três faixas seguem explicadas em palavras, que
 * valem nos dois casos.
 */
export type OpcaoDeFaixa = { tone: Faixa; rotulo: string; selo: string | null };

export function opcoesDeFaixa(
  versao: VersaoDaJanela,
): OpcaoDeFaixa[] {
  if (versao === 'indefinida') {
    return [
      { tone: 'alta', rotulo: 'Alta', selo: null },
      { tone: 'media', rotulo: 'Média', selo: null },
      { tone: 'baixa', rotulo: 'Baixa', selo: null },
    ];
  }
  const { media, alta } = fronteirasDoScore(versao);
  return [
    { tone: 'alta', rotulo: 'Alta', selo: `${alta}+` },
    { tone: 'media', rotulo: 'Média', selo: `${media}+` },
    { tone: 'baixa', rotulo: 'Baixa', selo: `<${media}` },
  ];
}

/** Seleção múltipla da tela de oportunidades: começa nas faixas publicáveis. */
export const FAIXAS_FILTRO_PADRAO: readonly Faixa[] = ['alta', 'media'];

/**
 * O filtro de faixa do painel, em seleção múltipla.
 *
 * Sem faixa guardada é a oportunidade REGISTRADA de antes da migration 091:
 * ela foi enviada no daily, ou seja, estava acima do corte no dia. Esconder do
 * padrão apagaria da lista uma oportunidade que existiu de verdade, então ela
 * entra sempre que Alta E Média estão as duas selecionadas — aí a lista não
 * afirma qual das duas ela era. Basta uma delas ficar de fora e a seleção passa
 * a afirmar uma faixa: com só Alta marcada, mostrá-la seria dizer que era Alta,
 * e isso o dado não sustenta. Por isso ela some de qualquer seleção que aponte
 * uma faixa só.
 */
export function passaNoFiltroDeFaixas(
  selecionadas: readonly Faixa[],
  faixa: string | null | undefined,
): boolean {
  if (faixa == null) return selecionadas.includes('alta') && selecionadas.includes('media');
  return selecionadas.includes(faixaTone(faixa));
}

/**
 * Cor da diferença para o preço justo. Positivo em verde; zero ou negativo em
 * cor neutra, nunca em vermelho: a diferença é informação, e um preço abaixo do
 * justo não é erro da leitura nem desvantagem a ser anunciada.
 */
export function edgeToneCls(edge: number | null | undefined): string {
  return typeof edge === 'number' && edge > 0 ? 'text-forest' : 'text-ink-2';
}

/**
 * A faixa em palavras, para o selo do Score. Existia em três cópias, cada uma
 * comparando o número contra 60 e 40 por conta própria — e era esse trio que
 * classificaria errado assim que a escala mudasse.
 */
export function rotuloDaFaixa(faixa: string | null | undefined): string {
  if (faixa == null) return 'sem faixa';
  switch (faixaTone(faixa)) {
    case 'alta': return 'faixa alta';
    case 'media': return 'faixa média';
    default: return 'faixa baixa';
  }
}

/** A linha está na faixa de destaque do painel (Alta ou Média). */
export function ehDestaque(faixa: string | null | undefined): boolean {
  return faixa != null && faixaTone(faixa) !== 'baixa';
}

/** A linha está na faixa Alta. */
export function ehFaixaAlta(faixa: string | null | undefined): boolean {
  return faixa != null && faixaTone(faixa) === 'alta';
}

// Board: melhor oportunidade por fixture.
export interface BoardFixture {
  fixtureId: number;
  best: FutebolValueBoardRow;
  all: FutebolValueBoardRow[];
}

export function groupBoardByFixture(rows: FutebolValueBoardRow[]): BoardFixture[] {
  const m = new Map<number, FutebolValueBoardRow[]>();
  for (const r of rows) {
    const arr = m.get(r.fixture_id);
    if (arr) arr.push(r); else m.set(r.fixture_id, [r]);
  }
  const out: BoardFixture[] = [];
  for (const [fixtureId, all] of m) {
    const best = all.reduce((b, r) => (r.score > b.score ? r : b), all[0]);
    out.push({ fixtureId, best, all });
  }
  return out.sort((a, b) => b.best.score - a.best.score);
}


/**
 * Ordem da faixa para ranquear a lista. Sem faixa vai para o fim: não dá para
 * colocar numa banda a linha que não declara nenhuma.
 */
export function ordemDaFaixa(faixa: string | null | undefined): number {
  if (faixa == null) return 3;
  switch (faixaTone(faixa)) {
    case 'alta': return 0;
    case 'media': return 1;
    default: return 2;
  }
}

/**
 * Ranqueia por FAIXA e só depois por Score.
 *
 * A ordenação era só pelo Score, e isso vira comparação entre escalas no dia da
 * virada: um 46 legacy ao lado de um 46 de contexto não medem a mesma coisa. A
 * faixa é comparável, porque cada escala tem a sua fronteira e as duas produzem
 * as mesmas três palavras. Dentro da faixa o Score continua desempatando.
 */
export function compararOportunidades(
  a: { faixa: string | null; score: number | null },
  b: { faixa: string | null; score: number | null },
): number {
  // Sem Score vem primeiro: é a oportunidade registrada de antes da migration
  // 091, que foi enviada no daily e portanto estava entre as melhores do dia —
  // o número daquele instante é que não foi guardado. A promoção olha o Score, e
  // não a faixa, para não empurrar ao topo uma linha que tem nota mas não tem
  // banda declarada.
  const aSemNota = a.score == null;
  const bSemNota = b.score == null;
  if (aSemNota !== bSemNota) return aSemNota ? -1 : 1;
  if (aSemNota && bSemNota) return 0;

  const porFaixa = ordemDaFaixa(a.faixa) - ordemDaFaixa(b.faixa);
  if (porFaixa !== 0) return porFaixa;
  return (b.score as number) - (a.score as number);
}
