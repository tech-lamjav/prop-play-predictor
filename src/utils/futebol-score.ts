// ============================================================
// futebol-score.ts — apresentação do Score (motor é backend)
// ============================================================
// O Score, edge, premissas, evidências e avisos vêm prontos da
// fact_value_opportunities (pipeline dbt no BigQuery). Aqui só ROTULAMOS
// (mercado, pick com linha) e ajudamos a ranquear/agrupar. Nada de cálculo.
// Mercados: Resultado (1X2), Gols (Over/Under) e Handicap asiático.
// ============================================================
import type { FutebolFixtureValueRow, FutebolValueBoardRow } from '@/services/futebol-data.service';

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
export function pickLabel(market: string, outcome: string, line: number | null, homeName: string, awayName: string): string {
  if (market === 'goals_over_under') {
    const n = line != null ? String(line).replace('.', ',') : '';
    return outcome === 'Over' ? `Mais de ${n} gols` : `Menos de ${n} gols`;
  }
  if (market === 'asian_handicap') {
    const team = outcome === 'Home' ? homeName : awayName;
    // line_value vem na ótica do mandante; pro visitante o handicap do próprio time é o oposto.
    const sideLine = line != null ? (outcome === 'Away' ? -line : line) : null;
    return sideLine != null ? `${team} ${fmtHandicapLine(sideLine)}` : team;
  }
  if (market === 'btts') {
    return outcome === 'Yes' ? 'Sim' : 'Não';
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

/** Limiares de faixa (espelham o backend). */
export const SCORE_ALTA = 60;
export const SCORE_MEDIA = 40;

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
