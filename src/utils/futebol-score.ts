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
 * cima: 25 é Média, 55 é Alta.
 *
 * Elas existem aqui para a LEGENDA declarar o número certo, e para mais nada.
 * Quem classifica é o backend: a faixa chega pronta na resposta, e o front que
 * recalcula é o front que discorda da metodologia sem saber.
 */
export const FAIXA_MEDIA_MIN = 25;
export const FAIXA_ALTA_MIN = 55;

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
 * A versão que a tela deve assumir para um conjunto de linhas. Basta uma linha
 * no contrato novo para a leitura já ser a nova: o histórico continua trazendo
 * linhas legacy para sempre, e elas não podem prender a legenda no passado.
 */
export function versaoPredominante(
  linhas: readonly { score_versao?: FutebolScoreVersion }[],
): FutebolScoreVersion {
  return linhas.some((l) => l.score_versao === 'contexto_v1') ? 'contexto_v1' : 'legacy';
}

/** As três faixas, na ordem em que a legenda as apresenta. */
export function opcoesDeFaixa(
  versao: FutebolScoreVersion,
): { tone: Faixa; rotulo: string; selo: string }[] {
  const { media, alta } = fronteirasDoScore(versao);
  return [
    { tone: 'alta', rotulo: 'Alta', selo: `${alta}+` },
    { tone: 'media', rotulo: 'Média', selo: `${media}+` },
    { tone: 'baixa', rotulo: 'Baixa', selo: `<${media}` },
  ];
}

/**
 * O filtro de faixa do painel. `destaque` é o padrão e mostra Alta e Média;
 * Baixa e Todas continuam a um toque de distância.
 */
export type FaixaFilter = 'destaque' | 'alta' | 'media' | 'baixa' | 'all';

export const FAIXA_FILTRO_PADRAO: FaixaFilter = 'destaque';

export function passaNoFiltroDeFaixa(filtro: FaixaFilter, faixa: string | null | undefined): boolean {
  if (filtro === 'all') return true;
  // Sem faixa guardada é a oportunidade REGISTRADA de antes da migration 091:
  // ela foi enviada no daily, ou seja, estava acima do corte no dia. Esconder do
  // padrão apagaria da lista uma oportunidade que existiu de verdade, então ela
  // conta como destaque. O que não dá é afirmar QUAL faixa era, e por isso ela
  // fica fora dos filtros específicos.
  if (faixa == null) return filtro === 'destaque';
  const tone = faixaTone(faixa);
  if (filtro === 'destaque') return tone !== 'baixa';
  return tone === filtro;
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
