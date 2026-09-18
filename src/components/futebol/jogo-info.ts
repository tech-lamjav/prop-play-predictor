/**
 * O jogo do ponto de vista das telas: o mínimo que a faixa da partida, a bancada
 * de mercados e a página do jogo precisam saber para se desenhar.
 *
 * Morava dentro de `JogoResumo.tsx`, ao lado de um componente que ninguém
 * montava. O componente saiu; o tipo, que quatro módulos usam, ficou.
 */
export interface JogoInfo {
  fixtureId: number;
  /** Ids dos times: escudo e filtro de desfalques por lado. */
  homeId?: number;
  awayId?: number;
  home: string;
  away: string;
  competition: string;
  season: number;
  kickoffUtc: string | null;
  statusShort: string | null;
  goalsHome: number | null;
  goalsAway: number | null;
}
