/**
 * FIFA World Ranking — snapshot abril/2026 (mockado pra MVP).
 * Usado pelos algoritmos de Quick Pick pra inferir favoritos.
 *
 * Quanto MENOR o rank, MELHOR a seleção.
 *
 * Fonte: ranking aproximado FIFA. Como ranking real muda pouco em 2 meses
 * até a Copa, manter estático é OK. Se necessário, atualizar manualmente.
 *
 * Códigos seguem o formato FIFA (3 letras maiúsculas), idêntico ao usado
 * em wc_matches.home_team_code / away_team_code e em TeamFlag.
 */

export const FIFA_RANKINGS: Record<string, number> = {
  // Top 10
  ARG: 1,
  FRA: 2,
  ESP: 3,
  ENG: 4,
  BRA: 5,
  POR: 6,
  NED: 7,
  BEL: 8,
  ITA: 9,
  CRO: 10,

  // 11-20
  GER: 11,
  COL: 12,
  MAR: 13,
  URU: 14,
  USA: 15,
  MEX: 16,
  JPN: 17,
  SUI: 18,
  DEN: 19,
  SEN: 20,

  // 21-32
  KOR: 21,
  IRN: 22,
  AUS: 23,
  EGY: 24,
  ECU: 25,
  AUT: 26,
  NOR: 27,
  PAR: 28,
  POL: 29,
  CAN: 30,
  TUR: 31,
  WAL: 32,

  // 33-48 (resto da Copa, includes underdogs)
  TUN: 33,
  GHA: 34,
  CIV: 35,
  ALG: 36,
  CRC: 37,
  PAN: 38,
  BIH: 39,
  RSA: 40,
  CZE: 41,
  SCO: 42,
  SWE: 30,
  KSA: 43,
  IRQ: 44,
  JOR: 45,
  QAT: 45,
  UZB: 46,
  COD: 47,
  CPV: 48,

  // Outros possíveis classificados via repescagem ou wildcards
  CUW: 50,
  HAI: 52,
  NZL: 55,
};

/**
 * Lookup helper. Retorna 99 (rank baixo, time fraco) se código não está
 * mapeado — assume underdog pra ser conservador.
 */
export function getFifaRank(code: string): number {
  return FIFA_RANKINGS[code?.toUpperCase()] ?? 99;
}

/** Considera "favorito claro" quando a diferença de rank é > 8 posições. */
export const CLEAR_FAVORITE_RANK_DIFF = 8;
