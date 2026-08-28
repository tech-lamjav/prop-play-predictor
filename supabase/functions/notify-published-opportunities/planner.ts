export interface PublicationBoardRow {
  fixture_id: number;
  market: string;
  outcome: string;
  line_value: number | null;
  kickoff_utc: string;
  score: number;
}

// O painel só publica oportunidades a partir da faixa Média. O detector deve
// receber exatamente o mesmo conjunto, nunca candidatas de score inferior.
export const MIN_PUBLICATION_SCORE = 40;

function kickoffDate(kickoffUtc: string): Date {
  return new Date(
    kickoffUtc.includes("T") ? kickoffUtc : `${kickoffUtc.replace(" ", "T")}Z`,
  );
}

function normalizedLine(line: number | null): string {
  return line == null ? "none" : String(line);
}

export function opportunityKey(
  row: Pick<
    PublicationBoardRow,
    "fixture_id" | "market" | "outcome" | "line_value"
  >,
): string {
  return `${row.fixture_id}:${row.market}:${row.outcome}:${
    normalizedLine(row.line_value)
  }`;
}

export function planPublicationBatch<T extends PublicationBoardRow>({
  now,
  alreadyAlerted,
  board,
}: {
  now: Date;
  alreadyAlerted: ReadonlySet<string>;
  board: T[];
}): {
  newOpportunities: Array<T & { key: string }>;
  detailedOpportunities: Array<T & { key: string }>;
} {
  const newOpportunities = board
    .filter((row) =>
      row.score >= MIN_PUBLICATION_SCORE &&
      kickoffDate(row.kickoff_utc).getTime() > now.getTime()
    )
    .map((row) => ({ ...row, key: opportunityKey(row) }))
    .filter((row) => !alreadyAlerted.has(row.key));

  const detailedOpportunities = [...newOpportunities]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return { newOpportunities, detailedOpportunities };
}
