import type {
  FutebolFixtureValueRow,
  FutebolOddsRow,
} from '@/services/futebol-data.service';

export type LeituraCotacao =
  | { estado: 'oportunidade'; odd: number; oportunidade: FutebolFixtureValueRow }
  | { estado: 'cotada'; odd: number }
  | { estado: 'sem_cotacao'; odd: null };

const ODDS_MARKET: Record<string, FutebolOddsRow['market_key']> = {
  match_winner: 'match_winner',
  goals_over_under: 'over_under',
  btts: 'btts',
  double_chance: 'double_chance',
  asian_handicap: 'asian_handicap',
};

function mesmaLinha(a: number | null, b: number | null): boolean {
  return a == null && b == null || a != null && b != null && Math.abs(a - b) < 0.001;
}

function outcomeDaOdd(row: FutebolOddsRow): string {
  if (row.market_key === 'over_under') return row.outcome_label.split(' ')[0];
  if (row.market_key === 'asian_handicap') return row.outcome_label.split(' ')[0];
  return row.outcome_label;
}

export function leituraDaCotacao(
  market: string,
  outcome: string,
  line: number | null,
  oportunidades: FutebolFixtureValueRow[] | null | undefined,
  odds: FutebolOddsRow[] | null | undefined,
): LeituraCotacao {
  const oportunidade = (oportunidades ?? []).find(
    (row) => row.market === market && row.outcome === outcome && mesmaLinha(row.line_value, line),
  );
  if (oportunidade) {
    return { estado: 'oportunidade', odd: oportunidade.best_odd, oportunidade };
  }

  const marketKey = ODDS_MARKET[market];
  const cotacao = (odds ?? []).find(
    (row) => row.market_key === marketKey && outcomeDaOdd(row) === outcome && mesmaLinha(row.line, line),
  );
  if (cotacao?.reference_odd != null) {
    return { estado: 'cotada', odd: cotacao.reference_odd };
  }

  return { estado: 'sem_cotacao', odd: null };
}
