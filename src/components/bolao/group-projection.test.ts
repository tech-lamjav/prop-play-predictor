import { describe, it, expect } from 'vitest';
import { computeGroupProjection, type PredictionMap } from './group-projection';
import type { WcMatch } from '@/services/bolao.service';

// ── Helpers ────────────────────────────────────────────────────────
let idCounter = 1;
const pred: PredictionMap = {};

function reset() {
  idCounter = 1;
  for (const k of Object.keys(pred)) delete pred[Number(k)];
}

/** Cria um jogo de grupo e registra o placar palpitado. */
function match(group: string, home: string, away: string, hs: number, as: number): WcMatch {
  const id = idCounter++;
  pred[id] = { home: hs, away: as };
  return {
    id, stage: 'group', group_name: group,
    home_team_code: home, away_team_code: away,
    home_team: home, away_team: away,
  } as unknown as WcMatch;
}

/** Os 6 jogos de um grupo de 4 times, com placares explícitos (mapa "A-B": [x,y]). */
function group(name: string, teams: [string, string, string, string], scores: Record<string, [number, number]>): WcMatch[] {
  const [a, b, c, d] = teams;
  const pairs: [string, string][] = [[a, b], [a, c], [a, d], [b, c], [b, d], [c, d]];
  return pairs.map(([h, aw]) => {
    const [hs, as] = scores[`${h}-${aw}`];
    return match(name, h, aw, hs, as);
  });
}

// ── Testes ─────────────────────────────────────────────────────────
describe('computeGroupProjection', () => {
  it('ordena por pontos quando não há empate', () => {
    reset();
    // ARG vence todos, BRA 2, ESP 1, GER 0
    const ms = group('A', ['ARG', 'BRA', 'ESP', 'GER'], {
      'ARG-BRA': [1, 0], 'ARG-ESP': [1, 0], 'ARG-GER': [1, 0],
      'BRA-ESP': [1, 0], 'BRA-GER': [1, 0], 'ESP-GER': [1, 0],
    });
    const r = computeGroupProjection(ms, pred);
    const g = r.groups[0];
    expect(g.standings.map((s) => s.code)).toEqual(['ARG', 'BRA', 'ESP', 'GER']);
    expect(g.complete).toBe(true);
    expect(g.standings[0].status).toBe('direct');
    expect(g.standings[1].status).toBe('direct');
    expect(g.standings[3].status).toBe('out');
  });

  it('aplica confronto direto ANTES do saldo geral', () => {
    reset();
    // ARG e BRA terminam com 6 pts. ARG venceu o confronto direto (1-0),
    // mas BRA tem saldo geral muito melhor (goleou os fracos).
    // Pela regra 2026, ARG fica em 1º (h2h vence o saldo geral).
    const ms = group('A', ['ARG', 'BRA', 'ESP', 'GER'], {
      'ARG-BRA': [1, 0],  // ARG vence h2h
      'ARG-ESP': [1, 0],
      'ARG-GER': [0, 1],  // ARG perde (fica com 6 pts)
      'BRA-ESP': [5, 0],  // BRA goleia
      'BRA-GER': [5, 0],  // BRA goleia → saldo geral +9
      'ESP-GER': [0, 0],
    });
    const r = computeGroupProjection(ms, pred);
    const codes = r.groups[0].standings.map((s) => s.code);
    expect(codes[0]).toBe('ARG'); // h2h, apesar do saldo pior
    expect(codes[1]).toBe('BRA');
  });

  it('cai pro saldo geral quando o confronto direto empata', () => {
    reset();
    // ARG e BRA 7 pts, empataram o h2h (1-1). ARG tem saldo geral melhor.
    const ms = group('A', ['ARG', 'BRA', 'ESP', 'GER'], {
      'ARG-BRA': [1, 1],  // h2h empate
      'ARG-ESP': [3, 0],  // ARG goleia (saldo melhor)
      'ARG-GER': [3, 0],  // ARG goleia
      'BRA-ESP': [1, 0],  // BRA vence apertado
      'BRA-GER': [1, 0],
      'ESP-GER': [0, 0],
    });
    const r = computeGroupProjection(ms, pred);
    const codes = r.groups[0].standings.map((s) => s.code);
    expect(codes[0]).toBe('ARG'); // saldo geral desempata
    expect(codes[1]).toBe('BRA');
  });

  it('marca grupo incompleto e não gera classificados', () => {
    reset();
    const ms = group('A', ['ARG', 'BRA', 'ESP', 'GER'], {
      'ARG-BRA': [1, 0], 'ARG-ESP': [1, 0], 'ARG-GER': [1, 0],
      'BRA-ESP': [1, 0], 'BRA-GER': [1, 0], 'ESP-GER': [1, 0],
    });
    delete pred[ms[0].id]; // remove um palpite → grupo incompleto
    const r = computeGroupProjection(ms, pred);
    expect(r.groups[0].complete).toBe(false);
    expect(r.complete).toBe(false);
    expect(r.qualifiers).toEqual([]);
  });

  it('rankeia os terceiros entre grupos e corta os 8 melhores', () => {
    reset();
    const all: WcMatch[] = [];
    // 9 grupos; o 3º de cada vence o 4º por uma margem decrescente (saldo do 3º
    // cai a cada grupo) → o 3º do último grupo é o pior e fica de fora.
    for (let k = 0; k < 9; k++) {
      const margin = 9 - k; // 9,8,...,1
      const t = [`A${k}`, `B${k}`, `C${k}`, `D${k}`] as [string, string, string, string];
      all.push(...group(`G${k}`, t, {
        [`${t[0]}-${t[1]}`]: [1, 0], [`${t[0]}-${t[2]}`]: [1, 0], [`${t[0]}-${t[3]}`]: [1, 0],
        [`${t[1]}-${t[2]}`]: [1, 0], [`${t[1]}-${t[3]}`]: [1, 0],
        [`${t[2]}-${t[3]}`]: [margin, 0], // 3º (C) vence o 4º (D) por `margin`
      }));
    }
    const r = computeGroupProjection(all, pred);
    expect(r.thirdsRanked.length).toBe(9);
    const out = r.thirdsRanked.filter((t) => !t.in);
    expect(out.length).toBe(1);
    expect(out[0].code).toBe('C8'); // grupo G8 tinha a menor margem (1)
    // os 8 primeiros entram
    expect(r.thirdsRanked.slice(0, 8).every((t) => t.in)).toBe(true);
  });
});
