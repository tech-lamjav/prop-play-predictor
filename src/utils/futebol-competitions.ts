// Fonte única das competições do módulo Futebol.
// Data-driven: o backend define o slug (futebol.fact_fixtures.competition). Aqui
// só damos nome amigável e a ordem de exibição. Liga nova que o Mateus subir
// aparece sozinha nas telas (rótulo via fallback humanizado); adicionar aqui é
// só pra ganhar nome bonito + posição no seletor.
//
// Slugs confirmados no mart (season 2026): brasileirao, serie_b, copa_do_brasil,
// libertadores, sudamericana, la_liga, premier_league, copa_mundo.

export const COMPETITION_LABELS: Record<string, string> = {
  brasileirao: 'Brasileirão',
  serie_b: 'Série B',
  copa_do_brasil: 'Copa do Brasil',
  libertadores: 'Libertadores',
  sudamericana: 'Sul-Americana',
  la_liga: 'La Liga',
  premier_league: 'Premier League',
  copa_mundo: 'Copa do Mundo',
};

// Ordem canônica nos seletores que buscam por slug (pickers). Copa do Mundo por
// último (encerrada). Ligas desconhecidas caem no fim, em ordem alfabética.
export const ALL_COMPETITIONS: string[] = [
  'brasileirao',
  'serie_b',
  'copa_do_brasil',
  'libertadores',
  'sudamericana',
  'la_liga',
  'premier_league',
  'copa_mundo',
];

function humanize(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Nome amigável de uma competição. Cai no humanize se o slug não estiver mapeado. */
export function competitionLabel(slug: string | null | undefined): string {
  if (!slug) return '—';
  return COMPETITION_LABELS[slug] ?? humanize(slug);
}

/** Ordena uma lista de slugs pela ordem canônica (desconhecidos ao fim, alfabético). */
export function sortCompetitions(slugs: string[]): string[] {
  const rank = (s: string) => {
    const i = ALL_COMPETITIONS.indexOf(s);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...slugs].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
