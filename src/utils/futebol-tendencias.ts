// ============================================================
// futebol-tendencias.ts — modelo de gols (Poisson) → tendências por mercado
// ============================================================
// Camada-ponte do módulo de futebol. A partir das médias OFICIAIS por mando
// (get_futebol_team_season) de cada time, estima um λ de gols esperados por lado
// e deriva, de forma coerente (um único modelo), as probabilidades dos mercados
// de futebol: 1X2, dupla chance, over/under, ambos marcam, clean sheet.
//
// IMPORTANTE: isto é uma ESTIMATIVA nossa (baseline), NÃO um veredito de valor.
// "Odd justa" = 1/prob (o que a odd precisaria ser pra ser neutra). O valor/edge
// só existe quando comparado à odd real da casa (TS 13 — odds, em ingestão) e a
// estimativa será calibrada/substituída pela TS 14 (predictions). É o slot onde
// 13/14 plugam — por enquanto, leitura descritiva probabilística.
// ============================================================
import type { FutebolTeamSeason } from '@/services/futebol-data.service';

const MAX_GOALS = 8; // cauda além disso é desprezível

export type Strength = 'alta' | 'media' | 'baixa';

export interface MarketTendency {
  key: string;
  group: string;     // ex.: "Total de gols"
  label: string;     // ex.: "Mais de 2,5 gols"
  prob: number;      // 0..1 — lado favorecido do mercado
  fairOdds: number;  // 1/prob
  reading: string;   // leitura em linguagem natural
  strength: Strength;
}

export interface Lambdas { lh: number; la: number; }

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
function poisson(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}
const num = (v: number | null | undefined): number | null =>
  typeof v === 'number' && isFinite(v) ? v : null;
const fair = (p: number) => (p > 0 ? 1 / p : 99);

function strengthFromProb(p: number): Strength {
  if (p >= 0.65) return 'alta';
  if (p >= 0.55) return 'media';
  return 'baixa';
}

/**
 * Gols esperados por lado, cruzando ataque (no mando) com a defesa do adversário
 * (no contra-mando). Cai pras médias totais se o split casa/fora faltar.
 */
export function lambdasFromSeason(home: FutebolTeamSeason, away: FutebolTeamSeason): Lambdas | null {
  const hAtk = num(home.goals_for_avg_home) ?? num(home.goals_for_avg_total);
  const hDef = num(home.goals_against_avg_home) ?? num(home.goals_against_avg_total);
  const aAtk = num(away.goals_for_avg_away) ?? num(away.goals_for_avg_total);
  const aDef = num(away.goals_against_avg_away) ?? num(away.goals_against_avg_total);
  if (hAtk == null || hDef == null || aAtk == null || aDef == null) return null;
  return {
    lh: Math.max(0.05, (hAtk + aDef) / 2),
    la: Math.max(0.05, (aAtk + hDef) / 2),
  };
}

export interface MatchupTendencies {
  lambdas: Lambdas;
  markets: MarketTendency[];
}

export function computeMatchupTendencies(
  home: FutebolTeamSeason,
  away: FutebolTeamSeason,
  homeName: string,
  awayName: string
): MatchupTendencies | null {
  // Sem amostra suficiente (ex.: seleções de Copa sem season stats no dataset) o
  // modelo gera λ≈0 e cospe "100%" sem sentido — melhor não exibir.
  const MIN_GAMES = 5;
  if ((home.played_total ?? 0) < MIN_GAMES || (away.played_total ?? 0) < MIN_GAMES) return null;

  const lam = lambdasFromSeason(home, away);
  if (!lam) return null;
  const { lh, la } = lam;

  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, lh));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, la));

  let pHome = 0, pDraw = 0, pAway = 0;
  let pOver15 = 0, pOver25 = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = ph[i] * pa[j];
      if (i > j) pHome += p; else if (i === j) pDraw += p; else pAway += p;
      const tot = i + j;
      if (tot >= 2) pOver15 += p;
      if (tot >= 3) pOver25 += p;
    }
  }
  const pBtts = (1 - ph[0]) * (1 - pa[0]);
  const pCsHome = pa[0]; // visitante marca 0
  const pCsAway = ph[0]; // mandante marca 0

  const markets: MarketTendency[] = [];

  // Resultado (1X2) — reporta o desfecho mais provável
  {
    const opts = [
      { side: 'home', p: pHome },
      { side: 'draw', p: pDraw },
      { side: 'away', p: pAway },
    ].sort((a, b) => b.p - a.p);
    const top = opts[0];
    const label = top.side === 'home' ? `Vitória do ${homeName}` : top.side === 'away' ? `Vitória do ${awayName}` : 'Empate';
    const reading =
      top.side === 'home' ? `${homeName} é favorito jogando em casa.`
      : top.side === 'away' ? `${awayName} chega como favorito mesmo fora.`
      : 'Confronto equilibrado — empate é o cenário mais provável.';
    markets.push({ key: 'resultado', group: 'Resultado', label, prob: top.p, fairOdds: fair(top.p), reading, strength: strengthFromProb(top.p) });
  }

  // Dupla chance — cenário mais provável de cobertura dupla
  {
    const opts = [
      { p: pHome + pDraw, label: `${homeName} ou empate` },
      { p: pHome + pAway, label: 'Fora do empate' },
      { p: pAway + pDraw, label: `${awayName} ou empate` },
    ].sort((a, b) => b.p - a.p);
    const top = opts[0];
    markets.push({ key: 'dupla_chance', group: 'Dupla chance', label: top.label, prob: top.p, fairOdds: fair(top.p), reading: `Cenário mais seguro do confronto: ${top.label.toLowerCase()}.`, strength: strengthFromProb(top.p) });
  }

  // Over/Under 2,5 gols
  {
    const isOver = pOver25 >= 0.5;
    const p = isOver ? pOver25 : 1 - pOver25;
    markets.push({
      key: 'ou25', group: 'Total de gols',
      label: isOver ? 'Mais de 2,5 gols' : 'Menos de 2,5 gols',
      prob: p, fairOdds: fair(p),
      reading: isOver ? 'Tendência de jogo movimentado, com gols dos dois lados.' : 'Tendência de jogo truncado, de poucos gols.',
      strength: strengthFromProb(p),
    });
  }

  // Ambos marcam (BTTS)
  {
    const isSim = pBtts >= 0.5;
    const p = isSim ? pBtts : 1 - pBtts;
    markets.push({
      key: 'btts', group: 'Ambos marcam',
      label: isSim ? 'Ambos marcam: Sim' : 'Ambos marcam: Não',
      prob: p, fairOdds: fair(p),
      reading: isSim ? 'Os dois lados tendem a balançar a rede.' : 'Um dos lados tende a passar em branco.',
      strength: strengthFromProb(p),
    });
  }

  // Over/Under 1,5 gols
  {
    const isOver = pOver15 >= 0.5;
    const p = isOver ? pOver15 : 1 - pOver15;
    markets.push({
      key: 'ou15', group: 'Total de gols',
      label: isOver ? 'Mais de 1,5 gols' : 'Menos de 1,5 gols',
      prob: p, fairOdds: fair(p),
      reading: isOver ? 'Difícil este jogo sair com menos de dois gols.' : 'Jogo com cara de placar curto.',
      strength: strengthFromProb(p),
    });
  }

  // Clean sheet — lado com maior chance de não sofrer
  {
    const homeBetter = pCsHome >= pCsAway;
    const p = homeBetter ? pCsHome : pCsAway;
    const team = homeBetter ? homeName : awayName;
    markets.push({
      key: 'clean_sheet', group: 'Não sofrer gols',
      label: `${team} não sofre gol`,
      prob: p, fairOdds: fair(p),
      reading: `${team} tem boa chance de manter o gol zerado.`,
      strength: strengthFromProb(p),
    });
  }

  return { lambdas: lam, markets };
}

/** Mercado-destaque: o mais confiante entre os "assinatura" (resultado, O/U 2,5, BTTS). */
export function headlineMarket(markets: MarketTendency[]): MarketTendency | null {
  const candidates = markets.filter((m) => ['resultado', 'ou25', 'btts'].includes(m.key));
  if (!candidates.length) return null;
  return candidates.reduce((best, m) => (m.prob > best.prob ? m : best));
}

export const STRENGTH_LABEL: Record<Strength, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
