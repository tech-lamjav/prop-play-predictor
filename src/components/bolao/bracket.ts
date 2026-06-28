// ============================================================
// bracket — resolve o chaveamento do mata-mata da Copa 2026
// ============================================================
// A estrutura do bracket está no wc_matches (home_team/away_team dos jogos de
// mata-mata): 16 avos = "1º Grupo E" / "3º Grupo ABCDF"; fases seguintes =
// "Vencedor J74" / "Perdedor J101". Este motor:
//   1. parseia os slots;
//   2. popula os 16 avos a partir da projeção de grupos (1º/2º/3º);
//   3. emparelha os 8 terceiros classificados aos 8 slots "3º Grupo XXXXX";
//   4. resolve cada fase usando os palpites especiais (quem avança = quem está
//      na fase seguinte: round_of_16 → quarter → semi → final → champion).
// Função PURA (sem React). Ver docs/bolao-projecao-grupos-plano.md.
// ============================================================
import type { WcMatch } from '@/services/bolao.service';
import type { ProjectionResult } from '@/components/bolao/group-projection';

export type SlotRef =
  | { kind: 'group_pos'; pos: 1 | 2; group: string }
  | { kind: 'third'; groups: string[] }
  | { kind: 'winner'; match: number }
  | { kind: 'loser'; match: number }
  | { kind: 'unknown'; raw: string };

export interface ResolvedSlot {
  code: string | null;  // código do time, ou null se ainda não dá pra resolver
  label: string;        // rótulo curto pra exibir quando não resolvido (ex: "1º E", "Vto J74")
}

export interface ResolvedMatch {
  match_number: number;
  stage: string;
  home: ResolvedSlot;
  away: ResolvedSlot;
  /** Time que o usuário mandou avançar (deduzido dos palpites especiais). */
  winner: string | null;
}

export interface BracketPicks {
  round_of_16: string[];
  quarterfinalist: string[];
  semifinalist: string[];
  finalist: string[];
  champion: string | null;
}

const GROUP_POS = /^([12])º\s+Grupo\s+([A-Z])$/i;
const THIRD = /^3º\s+Grupo\s+([A-Z]+)$/i;
const WINNER = /^Vencedor\s+J(\d+)$/i;
const LOSER = /^Perdedor\s+J(\d+)$/i;

export function parseSlot(raw: string): SlotRef {
  const s = (raw ?? '').trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(GROUP_POS))) return { kind: 'group_pos', pos: Number(m[1]) as 1 | 2, group: m[2].toUpperCase() };
  if ((m = s.match(THIRD))) return { kind: 'third', groups: m[1].toUpperCase().split('') };
  if ((m = s.match(WINNER))) return { kind: 'winner', match: Number(m[1]) };
  if ((m = s.match(LOSER))) return { kind: 'loser', match: Number(m[1]) };
  return { kind: 'unknown', raw: s };
}

function shortLabel(ref: SlotRef): string {
  switch (ref.kind) {
    case 'group_pos': return `${ref.pos}º ${ref.group}`;
    case 'third': return `3º (${ref.groups.join('')})`;
    case 'winner': return `Vto J${ref.match}`;
    case 'loser': return `Perd. J${ref.match}`;
    default: return ref.raw;
  }
}

/**
 * Emparelha os 8 terceiros classificados (cada um de um grupo) aos 8 slots
 * "3º Grupo XXXXX", respeitando os grupos permitidos de cada slot. Backtracking
 * exato (8×8). Retorna match_number do slot → código do terceiro, ou null se não
 * houver atribuição válida (não deveria acontecer com 8 terceiros válidos).
 */
export function matchThirds(
  slots: { matchNumber: number; groups: string[] }[],
  thirds: { code: string; group: string }[]
): Map<number, string> | null {
  const result = new Map<number, string>();
  const usedThird = new Set<number>();
  // ordena slots pelos mais restritos primeiro (menos terceiros elegíveis) ajuda o backtracking
  const order = [...slots].sort((a, b) => {
    const ea = thirds.filter((t) => a.groups.includes(t.group)).length;
    const eb = thirds.filter((t) => b.groups.includes(t.group)).length;
    return ea - eb;
  });

  const solve = (i: number): boolean => {
    if (i === order.length) return true;
    const slot = order[i];
    for (let j = 0; j < thirds.length; j++) {
      if (usedThird.has(j)) continue;
      if (!slot.groups.includes(thirds[j].group)) continue;
      usedThird.add(j);
      result.set(slot.matchNumber, thirds[j].code);
      if (solve(i + 1)) return true;
      usedThird.delete(j);
      result.delete(slot.matchNumber);
    }
    return false;
  };

  return solve(0) ? result : null;
}

/** Fase cujos picks definem o vencedor dos jogos de cada stage. */
const ADVANCERS: Record<string, keyof Omit<BracketPicks, 'champion'> | 'champion'> = {
  round_of_32: 'round_of_16',
  round_of_16: 'quarterfinalist',
  quarter: 'semifinalist',
  semi: 'finalist',
  final: 'champion',
};

/** Fase de palpite que o vencedor de um jogo desta stage preenche (ou null). */
export function nextStageOf(stage: string): string | null {
  return ADVANCERS[stage] ?? null;
}

/**
 * Resolve o bracket inteiro: participantes de cada jogo + o vencedor deduzido
 * dos palpites especiais. Processa por match_number (feeders referenciam jogos
 * anteriores). Requer projeção completa pros 16 avos.
 */
export function resolveBracket(
  matches: WcMatch[],
  projection: ProjectionResult | null,
  picks: BracketPicks,
  opts?: { preferRealCodes?: boolean }
): ResolvedMatch[] {
  const ko = matches
    .filter((m) => m.stage !== 'group')
    .sort((a, b) => a.match_number - b.match_number);

  // Modo "chaveamento real": os 16 avos vêm dos times REAIS já gravados no
  // wc_matches (home_team_code/away_team_code != 'TBD'), não da projeção. As
  // fases seguintes seguem o caminho que o usuário prevê (via picks).
  const preferReal = opts?.preferRealCodes ?? false;
  const realCode = (c: string | null | undefined): string | null =>
    c && c !== 'TBD' ? c : null;

  // projeção: grupo → standings ordenadas (pode ser null no modo real)
  const groupStandings = new Map((projection?.groups ?? []).map((g) => [g.group, g.standings]));

  // emparelhamento dos terceiros
  const thirdSlots = ko
    .filter((m) => m.stage === 'round_of_32')
    .map((m) => ({ m, ref: parseSlot(m.away_team) }))
    .filter((x) => x.ref.kind === 'third')
    .map((x) => ({ matchNumber: x.m.match_number, groups: (x.ref as { groups: string[] }).groups }));
  const qualifyingThirds = (projection?.thirdsRanked ?? [])
    .filter((t) => t.in)
    .map((t) => ({ code: t.code, group: t.group }));
  const thirdByMatch =
    thirdSlots.length === qualifyingThirds.length && qualifyingThirds.length > 0
      ? matchThirds(thirdSlots, qualifyingThirds)
      : null;

  const sets = {
    round_of_16: new Set(picks.round_of_16),
    quarterfinalist: new Set(picks.quarterfinalist),
    semifinalist: new Set(picks.semifinalist),
    finalist: new Set(picks.finalist),
  };

  const byNumber = new Map<number, ResolvedMatch>();

  const resolveRef = (ref: SlotRef): string | null => {
    switch (ref.kind) {
      case 'group_pos': {
        const st = groupStandings.get(ref.group);
        return st && st[ref.pos - 1] ? st[ref.pos - 1].code : null;
      }
      case 'third':
        // achado pelo emparelhamento (via match_number do slot — resolvido fora)
        return null;
      case 'winner':
        return byNumber.get(ref.match)?.winner ?? null;
      case 'loser': {
        const prev = byNumber.get(ref.match);
        if (!prev || !prev.winner) return null;
        const a = prev.home.code, b = prev.away.code;
        return prev.winner === a ? b : prev.winner === b ? a : null;
      }
      default:
        return null;
    }
  };

  for (const m of ko) {
    const homeRef = parseSlot(m.home_team);
    const awayRef = parseSlot(m.away_team);

    // Round de ENTRADA (16 avos). No modo real preferimos o código real já gravado
    // no jogo — independente do texto do slot, que pode ter sido sobrescrito pelo
    // nome real do time (ex: "Brasil") e não casar mais com o descritor. As fases
    // seguintes ("Vencedor Jxx") continuam resolvendo pelo caminho previsto nos picks.
    const isEntryRound = m.stage === 'round_of_32';

    const homeCode =
      preferReal && isEntryRound && realCode(m.home_team_code)
        ? realCode(m.home_team_code)
        : homeRef.kind === 'third'
          ? thirdByMatch?.get(m.match_number) ?? null
          : resolveRef(homeRef);
    const awayCode =
      preferReal && isEntryRound && realCode(m.away_team_code)
        ? realCode(m.away_team_code)
        : awayRef.kind === 'third'
          ? thirdByMatch?.get(m.match_number) ?? null
          : resolveRef(awayRef);

    // vencedor = participante presente na fase seguinte (ou campeão)
    let winner: string | null = null;
    const adv = ADVANCERS[m.stage];
    if (adv === 'champion') {
      winner = picks.champion && (picks.champion === homeCode || picks.champion === awayCode) ? picks.champion : null;
    } else if (adv) {
      const set = sets[adv];
      const inHome = homeCode ? set.has(homeCode) : false;
      const inAway = awayCode ? set.has(awayCode) : false;
      if (inHome && !inAway) winner = homeCode;
      else if (inAway && !inHome) winner = awayCode;
      // ambos ou nenhum → indefinido (null)
    }

    byNumber.set(m.match_number, {
      match_number: m.match_number,
      stage: m.stage,
      home: { code: homeCode, label: homeCode ?? shortLabel(homeRef) },
      away: { code: awayCode, label: awayCode ?? shortLabel(awayRef) },
      winner,
    });
  }

  return ko.map((m) => byNumber.get(m.match_number)!);
}
