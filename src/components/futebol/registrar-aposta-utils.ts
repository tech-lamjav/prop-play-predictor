// Tipos + helpers do cross-sell Futebol → Betinho (separado do componente
// pra manter o Fast Refresh feliz: o .tsx exporta só componentes).
import type { FutebolValueBoardRow } from '@/services/futebol-data.service';

export interface FutebolBetDraft {
  homeName: string;
  awayName: string;
  competition: string;
  kickoffUtc: string | null;
  market: string;
  outcome: string;
  lineValue: number | null;
  bestOdd: number;
}

/** Monta o draft a partir de uma linha do board de oportunidades. */
export function draftFromBoardRow(o: FutebolValueBoardRow): FutebolBetDraft {
  return {
    homeName: o.home_team_name,
    awayName: o.away_team_name,
    competition: o.competition,
    kickoffUtc: o.kickoff_utc,
    market: o.market,
    outcome: o.outcome,
    lineValue: o.line_value,
    bestOdd: o.best_odd,
  };
}
