// Tipos + helpers do cross-sell Futebol → Betinho (separado do componente
// pra manter o Fast Refresh feliz: o .tsx exporta só componentes).
import type { FutebolValueBoardRow } from '@/services/futebol-data.service';

interface FutebolBetDraftBase {
  homeName: string;
  awayName: string;
  competition: string;
  kickoffUtc: string | null;
  market: string;
  outcome: string;
  lineValue: number | null;
}

/** A origem da odd determina se o formulário começa preenchido. */
export type FutebolBetDraft = FutebolBetDraftBase & (
  | { bestOdd: number; oddKind: 'melhor' | 'referencia' }
  | { bestOdd: null; oddKind: 'sem_cotacao' }
);

export interface AtalhoDeUnidade {
  unidades: 0.5 | 1;
  valor: number;
}

/** Atalhos só existem quando a unidade efetiva do Betinho é válida. */
export function atalhosDaUnidade(unitValue: number | null | undefined): AtalhoDeUnidade[] {
  if (unitValue == null || !Number.isFinite(unitValue) || unitValue <= 0) return [];
  return [
    { unidades: 1, valor: unitValue },
    { unidades: 0.5, valor: unitValue / 2 },
  ];
}

/**
 * Monta o draft a partir de uma linha do board de oportunidades. Aceita
 * qualquer linha que tenha estes campos (o histórico monta linha de
 * oportunidade registrada, sem Score/faixa/edge — ver FutebolOportunidades).
 */
type DraftSource = Pick<
  FutebolValueBoardRow,
  'home_team_name' | 'away_team_name' | 'competition' | 'kickoff_utc' | 'market' | 'outcome' | 'line_value' | 'best_odd'
>;

export function draftFromBoardRow(o: DraftSource): FutebolBetDraft {
  return {
    homeName: o.home_team_name,
    awayName: o.away_team_name,
    competition: o.competition,
    kickoffUtc: o.kickoff_utc,
    market: o.market,
    outcome: o.outcome,
    lineValue: o.line_value,
    bestOdd: o.best_odd,
    oddKind: 'melhor',
  };
}
