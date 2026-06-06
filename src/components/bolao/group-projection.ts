// ============================================================
// group-projection — projeta a classificação dos grupos da Copa 2026
// a partir dos palpites de placar do usuário.
// ============================================================
// Regras oficiais 2026 (ver docs/bolao-projecao-grupos-plano.md):
//   - Avançam: 12 1ºs + 12 2ºs + 8 melhores 3ºs = 32 (16 avos).
//   - Desempate no grupo: pontos → confronto direto (pts/saldo/gols entre os
//     empatados) → saldo geral → gols geral → [fair play: PULADO] → ranking FIFA.
//   - Melhores 3ºs (entre grupos): pontos → saldo → gols → ranking FIFA.
// Fair play não entra (cartões não são palpitados). Função PURA (sem React).
// ============================================================
import type { WcMatch } from '@/services/bolao.service';
import { getFifaRank } from '@/data/fifa-rankings';

export interface PredictedScore { home: number; away: number }
/** match_id → placar palpitado pelo usuário. */
export type PredictionMap = Record<number, PredictedScore>;

export type QualifyStatus = 'direct' | 'third_in' | 'third_out' | 'out';

export interface ProjectedStanding {
  code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  position: number;        // 1..4 dentro do grupo
  status: QualifyStatus;    // direct (1º/2º), third_in/third_out (3º), out (4º)
}

export interface GroupProjection {
  group: string;
  standings: ProjectedStanding[]; // ordenado 1..4
  complete: boolean;              // todos os jogos do grupo palpitados
}

export interface ProjectionResult {
  groups: GroupProjection[];
  /** Códigos dos 32 classificados — só preenchido quando `complete`. */
  qualifiers: string[];
  /** Os 12 terceiros, já rankeados entre si (in = entre os 8 melhores). */
  thirdsRanked: { code: string; group: string; in: boolean }[];
  /** Todos os 72 jogos de grupo palpitados. */
  complete: boolean;
}

interface Stat {
  code: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; pts: number;
}

function emptyStat(code: string): Stat {
  return { code, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 };
}

function applyResult(s: Stat, gf: number, ga: number) {
  s.played++; s.gf += gf; s.ga += ga;
  if (gf > ga) { s.won++; s.pts += 3; }
  else if (gf < ga) { s.lost++; }
  else { s.drawn++; s.pts++; }
}

const gd = (s: Stat) => s.gf - s.ga;

/**
 * Constrói a tabela de pontos de um conjunto de times considerando APENAS os
 * jogos entre eles que foram palpitados. Usado tanto pro grupo inteiro quanto
 * pra mini-tabela de confronto direto entre empatados.
 */
function buildTable(codes: string[], matches: WcMatch[], pred: PredictionMap): Map<string, Stat> {
  const set = new Set(codes);
  const table = new Map<string, Stat>();
  codes.forEach((c) => table.set(c, emptyStat(c)));
  for (const m of matches) {
    if (!set.has(m.home_team_code) || !set.has(m.away_team_code)) continue;
    const p = pred[m.id];
    if (!p) continue;
    applyResult(table.get(m.home_team_code)!, p.home, p.away);
    applyResult(table.get(m.away_team_code)!, p.away, p.home);
  }
  return table;
}

/**
 * Ordena os times de um grupo aplicando a ordem oficial de desempate.
 * Recebe os stats GERAIS (todos os jogos do grupo) e os jogos do grupo (pra
 * calcular confronto direto entre empatados).
 */
function rankGroup(overall: Stat[], groupMatches: WcMatch[], pred: PredictionMap): Stat[] {
  // 1) bloco por pontos
  const byPts = [...overall].sort((a, b) => b.pts - a.pts);
  const result: Stat[] = [];
  let i = 0;
  while (i < byPts.length) {
    let j = i;
    while (j + 1 < byPts.length && byPts[j + 1].pts === byPts[i].pts) j++;
    const block = byPts.slice(i, j + 1);
    if (block.length === 1) {
      result.push(block[0]);
    } else {
      // 2) confronto direto entre os empatados (mini-tabela)
      const h2h = buildTable(block.map((s) => s.code), groupMatches, pred);
      const overallByCode = new Map(overall.map((s) => [s.code, s]));
      block.sort((a, b) => {
        const ha = h2h.get(a.code)!, hb = h2h.get(b.code)!;
        if (hb.pts !== ha.pts) return hb.pts - ha.pts;          // h2h pontos
        if (gd(hb) !== gd(ha)) return gd(hb) - gd(ha);          // h2h saldo
        if (hb.gf !== ha.gf) return hb.gf - ha.gf;              // h2h gols
        const oa = overallByCode.get(a.code)!, ob = overallByCode.get(b.code)!;
        if (gd(ob) !== gd(oa)) return gd(ob) - gd(oa);          // saldo geral
        if (ob.gf !== oa.gf) return ob.gf - oa.gf;              // gols geral
        // fair play: pulado (não palpitável)
        return getFifaRank(a.code) - getFifaRank(b.code);       // ranking FIFA (menor = melhor)
      });
      result.push(...block);
    }
    i = j + 1;
  }
  return result;
}

function toStanding(s: Stat, position: number, status: QualifyStatus): ProjectedStanding {
  return {
    code: s.code, played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
    gf: s.gf, ga: s.ga, gd: gd(s), pts: s.pts, position, status,
  };
}

/**
 * Projeta todos os grupos + define os 32 classificados (12 1ºs + 12 2ºs + 8
 * melhores 3ºs). `qualifiers` só vem preenchido quando TODOS os 72 jogos de
 * grupo estão palpitados (`complete`).
 */
export function computeGroupProjection(matches: WcMatch[], pred: PredictionMap): ProjectionResult {
  // jogos de grupo válidos (sem TBD), agrupados
  const groupMap = new Map<string, WcMatch[]>();
  for (const m of matches) {
    if (m.stage !== 'group' || !m.group_name) continue;
    if (m.home_team_code === 'TBD' || m.away_team_code === 'TBD') continue;
    if (!groupMap.has(m.group_name)) groupMap.set(m.group_name, []);
    groupMap.get(m.group_name)!.push(m);
  }

  const groups: GroupProjection[] = [];
  const thirds: { stat: Stat; group: string }[] = [];

  for (const [group, gms] of [...groupMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const codes = Array.from(
      new Set(gms.flatMap((m) => [m.home_team_code, m.away_team_code]))
    );
    const table = buildTable(codes, gms, pred);
    const ranked = rankGroup(Array.from(table.values()), gms, pred);
    const complete = gms.every((m) => !!pred[m.id]);

    const standings = ranked.map((s, idx) => {
      const position = idx + 1;
      const status: QualifyStatus =
        position <= 2 ? 'direct' : position === 3 ? 'third_out' : 'out';
      return toStanding(s, position, status);
    });
    groups.push({ group, standings, complete });

    const third = ranked[2];
    if (third) thirds.push({ stat: third, group });
  }

  // ranking dos 12 terceiros (entre grupos, sem confronto direto)
  const thirdsSorted = [...thirds].sort((a, b) => {
    const sa = a.stat, sb = b.stat;
    if (sb.pts !== sa.pts) return sb.pts - sa.pts;
    if (gd(sb) !== gd(sa)) return gd(sb) - gd(sa);
    if (sb.gf !== sa.gf) return sb.gf - sa.gf;
    return getFifaRank(sa.code) - getFifaRank(sb.code);
  });
  const thirdsIn = new Set(thirdsSorted.slice(0, 8).map((t) => t.stat.code));
  const thirdsRanked = thirdsSorted.map((t) => ({
    code: t.stat.code, group: t.group, in: thirdsIn.has(t.stat.code),
  }));

  // marca third_in/third_out nas standings
  for (const g of groups) {
    for (const st of g.standings) {
      if (st.position === 3) st.status = thirdsIn.has(st.code) ? 'third_in' : 'third_out';
    }
  }

  const complete = groups.length === 12 && groups.every((g) => g.complete);
  const qualifiers = complete
    ? [
        ...groups.flatMap((g) => g.standings.filter((s) => s.position <= 2).map((s) => s.code)),
        ...thirdsSorted.slice(0, 8).map((t) => t.stat.code),
      ]
    : [];

  return { groups, qualifiers, thirdsRanked, complete };
}
