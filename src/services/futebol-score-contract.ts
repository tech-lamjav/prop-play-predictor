import type {
  FutebolFixtureValueRow,
  FutebolValueBoardRow,
} from './futebol-data.service';

export type FutebolScoreVersion = 'legacy' | 'contexto_v1';

type RawBoardRow = Omit<Partial<FutebolValueBoardRow>, 'score_versao'> & {
  score_versao?: unknown;
  [key: string]: unknown;
};

type RawFixtureRow = Omit<Partial<FutebolFixtureValueRow>, 'score_versao'> & {
  score_versao?: unknown;
  [key: string]: unknown;
};

type RawScoreRow = {
  score_versao?: unknown;
  pts_valor?: unknown;
  pts_corroboracao?: unknown;
};

function scoreVersion(row: RawScoreRow): FutebolScoreVersion {
  const temFormaLegacy =
    typeof row.pts_valor === 'number' &&
    typeof row.pts_corroboracao === 'number';
  if (row.score_versao == null) {
    if (temFormaLegacy) return 'legacy';
    throw new Error('O contrato novo do Score exige score_versao: contexto_v1');
  }
  if (row.score_versao === 'legacy') {
    if (!temFormaLegacy) {
      throw new Error('O contrato legacy exige pts_valor e pts_corroboracao');
    }
    return 'legacy';
  }
  if (row.score_versao === 'contexto_v1') return 'contexto_v1';
  throw new Error(`Versão do Score desconhecida: ${String(row.score_versao)}`);
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function normalizeCommonScoreFields(row: RawScoreRow) {
  return {
    score_versao: scoreVersion(row),
    pts_valor: numberOrZero(row.pts_valor),
    pts_corroboracao: numberOrZero(row.pts_corroboracao),
  };
}

/**
 * Costura temporária de expansão do contrato.
 *
 * A interface pública continua completa para os consumidores legacy enquanto
 * as RPCs passam a omitir os componentes de preço no contexto_v1. A contração
 * remove estes defaults depois da virada coordenada.
 */
export function normalizeFutebolValueBoardRows(
  rows: readonly RawBoardRow[],
): FutebolValueBoardRow[] {
  return rows.map((row) => ({
    ...row,
    ...normalizeCommonScoreFields(row),
  })) as FutebolValueBoardRow[];
}

/** Mesma expansão para a RPC de detalhe, que também perde a penalidade global. */
export function normalizeFutebolFixtureValueRows(
  rows: readonly RawFixtureRow[],
): FutebolFixtureValueRow[] {
  return rows.map((row) => ({
    ...row,
    ...normalizeCommonScoreFields(row),
    penalidades_globais_pts: numberOrZero(row.penalidades_globais_pts),
  })) as FutebolFixtureValueRow[];
}
