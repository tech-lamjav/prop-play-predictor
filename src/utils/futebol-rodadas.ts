// ============================================================
// futebol-rodadas.ts — o nome da rodada em português
// ============================================================
// O mart guarda o texto da API-Football, em inglês e em três formatos diferentes:
// "Regular Season - 22" nas ligas, "Group Stage - 3" na fase de grupos e
// "Round of 16" / "Quarter-finals" / "1/128-finals" no mata-mata. A tela precisa
// de duas versões: a CURTA, que cabe num chip da régua, e a LONGA, que vira
// título. Antes existia só um `prettyRound` que cuidava do "Regular Season" e
// deixava o resto em inglês na tela.
// ============================================================

/** Número da rodada quando a competição é de pontos corridos, senão null. */
export function numeroDaRodada(round: string | null | undefined): number | null {
  const m = (round ?? '').match(/Regular Season\s*-\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** true quando a lista de rodadas é de liga (pontos corridos), não de mata-mata. */
export function ehCampeonatoDePontos(rounds: string[]): boolean {
  return rounds.some((r) => numeroDaRodada(r) != null);
}

const FASES: Array<[RegExp, string, string]> = [
  // [padrão, curto (chip), longo (título)]
  [/^final$/i, 'Final', 'Final'],
  [/semi[- ]?finals?/i, 'Semi', 'Semifinal'],
  [/quarter[- ]?finals?/i, 'Quartas', 'Quartas de final'],
  [/round of 16|1\/8[- ]?finals?/i, 'Oitavas', 'Oitavas de final'],
  [/round of 32|1\/16[- ]?finals?/i, '16 avos', '16 avos de final'],
  [/round of 64|1\/32[- ]?finals?/i, '32 avos', '32 avos de final'],
  [/round of 128|1\/64[- ]?finals?/i, '64 avos', '64 avos de final'],
  [/1\/128[- ]?finals?/i, '1ª fase', 'Primeira fase'],
  [/1\/256[- ]?finals?/i, 'Pré', 'Fase preliminar'],
  [/play[- ]?offs?/i, 'Playoff', 'Playoff'],
  [/3rd qualifying/i, '3ª pré', 'Terceira fase preliminar'],
  [/2nd qualifying/i, '2ª pré', 'Segunda fase preliminar'],
  [/1st qualifying/i, '1ª pré', 'Primeira fase preliminar'],
];

/** true quando a rodada é de mata-mata (nem pontos corridos, nem fase de grupos). */
export function ehMataMata(round: string | null | undefined): boolean {
  const r = (round ?? '').trim();
  if (!r || numeroDaRodada(r) != null) return false;
  return !/group stage/i.test(r);
}

/** Rótulo de chip: curto o suficiente pra caber na régua. */
export function rodadaCurta(round: string | null | undefined): string {
  const n = numeroDaRodada(round);
  if (n != null) return String(n);
  const r = (round ?? '').trim();
  if (!r) return '—';

  const grupo = r.match(/group stage\s*-\s*(\d+)/i);
  if (grupo) return `Grupos ${grupo[1]}`;
  const qual = r.match(/qualification round\s*(\d+)/i);
  if (qual) return `Pré ${qual[1]}`;

  for (const [re, curto] of FASES) if (re.test(r)) return curto;
  return r;
}

/** Rótulo de título: a rodada por extenso. */
export function rodadaLonga(round: string | null | undefined): string {
  const n = numeroDaRodada(round);
  if (n != null) return `Rodada ${n}`;
  const r = (round ?? '').trim();
  if (!r) return 'Rodada';

  const grupo = r.match(/group stage\s*-\s*(\d+)/i);
  if (grupo) return `Fase de grupos, ${grupo[1]}ª rodada`;
  const qual = r.match(/qualification round\s*(\d+)/i);
  if (qual) return `${qual[1]}ª fase preliminar`;
  if (/group stage/i.test(r)) return 'Fase de grupos';

  for (const [re, , longo] of FASES) if (re.test(r)) return longo;
  return r;
}
