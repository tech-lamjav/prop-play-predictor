/**
 * Mock fixture pra Análise 360.
 * Usado em dev quando o backend não tem dados pro dia (offseason / dia sem jogos)
 * ou quando ?mock=1 está na URL. Os números espelham o mockup de design.
 */

import type { DailyOpportunity } from '@/services/nba-data.service';

type Row = Partial<DailyOpportunity> & Pick<
  DailyOpportunity,
  'trigger_player_id' | 'trigger_name' | 'trigger_status' | 'trigger_team_abbr' |
  'backup_player_id' | 'backup_player_name' | 'stat_type' | 'avg_com' | 'avg_sem' |
  'gap' | 'gap_pct' | 'rating_stars'
>;

const today = (() => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value ?? '2026';
  const m = parts.find(p => p.type === 'month')?.value ?? '05';
  const d = parts.find(p => p.type === 'day')?.value ?? '12';
  return `${y}-${m}-${d}`;
})();

const fill = (r: Row): DailyOpportunity => ({
  game_id: r.game_id ?? 1000,
  game_date: r.game_date ?? today,
  game_time: r.game_time ?? '21:00',
  home_team_abbr: r.home_team_abbr ?? r.trigger_team_abbr,
  visitor_team_abbr: r.visitor_team_abbr ?? 'XXX',
  trigger_player_id: r.trigger_player_id,
  trigger_name: r.trigger_name,
  trigger_status: r.trigger_status,
  trigger_team_abbr: r.trigger_team_abbr,
  trigger_team_id: r.trigger_team_id ?? 0,
  trigger_days_out: r.trigger_days_out ?? null,
  trigger_freshness: r.trigger_freshness ?? null,
  trigger_participation_pct: r.trigger_participation_pct ?? null,
  is_b2b: r.is_b2b ?? false,
  fatigue_level: r.fatigue_level ?? null,
  backup_player_id: r.backup_player_id,
  backup_player_name: r.backup_player_name,
  stat_type: r.stat_type,
  avg_com: r.avg_com,
  avg_sem: r.avg_sem,
  stddev_sem: r.stddev_sem ?? 2.5,
  cv_sem: r.cv_sem ?? 22,
  gap: r.gap,
  gap_pct: r.gap_pct,
  jogos_com: r.jogos_com ?? 28,
  jogos_sem: r.jogos_sem ?? 12,
  line_value: r.line_value ?? null,
  gap_vs_line: r.gap_vs_line ?? null,
  gap_vs_line_pct: r.gap_vs_line_pct ?? null,
  signal: r.signal ?? 'over',
  score: r.score ?? 70,
  score_base: r.score_base ?? 70,
  score_label: r.score_label ?? null,
  opponent_abbr: r.opponent_abbr ?? null,
  opponent_def_rank: r.opponent_def_rank ?? null,
  opponent_off_rank: r.opponent_off_rank ?? null,
  is_home: r.is_home ?? true,
  rating_stars: r.rating_stars,
  spread: r.spread ?? null,
  blowout_deflator: r.blowout_deflator ?? null,
});

const rows: Row[] = [
  // ─── OUT ─────────────────────────────────────────────────────────────────
  // 1. Luka Doncic — LAL vs GSW, 4 impactados, top: Reaves +41% em PRA
  { game_id: 1001, home_team_abbr: 'LAL', visitor_team_abbr: 'GSW', trigger_player_id: 1, trigger_name: 'Luka Doncic', trigger_status: 'out', trigger_team_abbr: 'LAL', trigger_days_out: 7, rating_stars: 3,
    backup_player_id: 101, backup_player_name: 'Austin Reaves', stat_type: 'player_points_rebounds_assists', avg_com: 24.5, avg_sem: 34.5, gap: 10.0, gap_pct: 41, score: 82, line_value: 26.5, gap_vs_line: 8.0, gap_vs_line_pct: 30 },
  { game_id: 1001, home_team_abbr: 'LAL', visitor_team_abbr: 'GSW', trigger_player_id: 1, trigger_name: 'Luka Doncic', trigger_status: 'out', trigger_team_abbr: 'LAL', trigger_days_out: 7, rating_stars: 3,
    backup_player_id: 102, backup_player_name: 'Rui Hachimura', stat_type: 'player_points', avg_com: 12.4, avg_sem: 16.8, gap: 4.4, gap_pct: 35, score: 74 },
  { game_id: 1001, home_team_abbr: 'LAL', visitor_team_abbr: 'GSW', trigger_player_id: 1, trigger_name: 'Luka Doncic', trigger_status: 'out', trigger_team_abbr: 'LAL', trigger_days_out: 7, rating_stars: 3,
    backup_player_id: 103, backup_player_name: 'Dalton Knecht', stat_type: 'player_points', avg_com: 9.1, avg_sem: 12.6, gap: 3.5, gap_pct: 38, score: 71 },
  { game_id: 1001, home_team_abbr: 'LAL', visitor_team_abbr: 'GSW', trigger_player_id: 1, trigger_name: 'Luka Doncic', trigger_status: 'out', trigger_team_abbr: 'LAL', trigger_days_out: 7, rating_stars: 3,
    backup_player_id: 104, backup_player_name: 'Gabe Vincent', stat_type: 'player_assists', avg_com: 2.4, avg_sem: 3.3, gap: 0.9, gap_pct: 38, score: 68 },

  // 2. Pascal Siakam — IND vs BKN, 1 impactado, top: Toppin +20% em Pontos
  { game_id: 1002, home_team_abbr: 'IND', visitor_team_abbr: 'BKN', trigger_player_id: 2, trigger_name: 'Pascal Siakam', trigger_status: 'out', trigger_team_abbr: 'IND', trigger_days_out: 6, rating_stars: 3,
    backup_player_id: 201, backup_player_name: 'Obi Toppin', stat_type: 'player_points', avg_com: 11.3, avg_sem: 13.6, gap: 2.3, gap_pct: 20, score: 75, line_value: 11.5, gap_vs_line: 2.1, gap_vs_line_pct: 18 },

  // 3. Josh Giddey — CHI vs WAS, 2 impactados, top: White +28% em Assist.
  { game_id: 1003, home_team_abbr: 'CHI', visitor_team_abbr: 'WAS', trigger_player_id: 3, trigger_name: 'Josh Giddey', trigger_status: 'out', trigger_team_abbr: 'CHI', trigger_days_out: 6, rating_stars: 3,
    backup_player_id: 301, backup_player_name: 'Coby White', stat_type: 'player_assists', avg_com: 4.6, avg_sem: 5.9, gap: 1.3, gap_pct: 28, score: 78 },
  { game_id: 1003, home_team_abbr: 'CHI', visitor_team_abbr: 'WAS', trigger_player_id: 3, trigger_name: 'Josh Giddey', trigger_status: 'out', trigger_team_abbr: 'CHI', trigger_days_out: 6, rating_stars: 3,
    backup_player_id: 302, backup_player_name: 'Ayo Dosunmu', stat_type: 'player_points', avg_com: 10.8, avg_sem: 12.9, gap: 2.1, gap_pct: 19, score: 70 },

  // 4. Austin Reaves — também OUT (?) — top: LaRavia +41% em PRA
  { game_id: 1001, home_team_abbr: 'LAL', visitor_team_abbr: 'GSW', trigger_player_id: 4, trigger_name: 'Austin Reaves', trigger_status: 'out', trigger_team_abbr: 'LAL', trigger_days_out: 7, rating_stars: 3,
    backup_player_id: 401, backup_player_name: 'Jake LaRavia', stat_type: 'player_points_rebounds_assists', avg_com: 8.9, avg_sem: 12.6, gap: 3.7, gap_pct: 41, score: 73 },
  { game_id: 1001, home_team_abbr: 'LAL', visitor_team_abbr: 'GSW', trigger_player_id: 4, trigger_name: 'Austin Reaves', trigger_status: 'out', trigger_team_abbr: 'LAL', trigger_days_out: 7, rating_stars: 3,
    backup_player_id: 402, backup_player_name: 'Gabe Vincent', stat_type: 'player_assists', avg_com: 2.5, avg_sem: 3.6, gap: 1.1, gap_pct: 44, score: 70 },

  // 5. Matas Buzelis — CHI vs WAS, 1 impactado, top: Vučević +14% em Reb
  { game_id: 1003, home_team_abbr: 'CHI', visitor_team_abbr: 'WAS', trigger_player_id: 5, trigger_name: 'Matas Buzelis', trigger_status: 'out', trigger_team_abbr: 'CHI', trigger_days_out: 7, rating_stars: 3,
    backup_player_id: 501, backup_player_name: 'Nikola Vučević', stat_type: 'player_rebounds', avg_com: 10.1, avg_sem: 11.5, gap: 1.4, gap_pct: 14, score: 68 },

  // 6. Jaxson Hayes — LAL, 1 impactado, top: Ayton +21% em PRA
  { game_id: 1001, home_team_abbr: 'LAL', visitor_team_abbr: 'GSW', trigger_player_id: 6, trigger_name: 'Jaxson Hayes', trigger_status: 'out', trigger_team_abbr: 'LAL', trigger_days_out: 4, rating_stars: 3,
    backup_player_id: 601, backup_player_name: 'Deandre Ayton', stat_type: 'player_points_rebounds_assists', avg_com: 21.2, avg_sem: 25.7, gap: 4.5, gap_pct: 21, score: 76 },

  // 7. Noah Clowney — BKN vs IND, 1 impactado, top: Sharpe +12% em Pontos
  { game_id: 1002, home_team_abbr: 'IND', visitor_team_abbr: 'BKN', trigger_player_id: 7, trigger_name: 'Noah Clowney', trigger_status: 'out', trigger_team_abbr: 'BKN', trigger_days_out: 6, rating_stars: 1,
    backup_player_id: 701, backup_player_name: "Day'Ron Sharpe", stat_type: 'player_points', avg_com: 7.4, avg_sem: 8.3, gap: 0.9, gap_pct: 12, score: 62 },

  // 8. Terance Mann — BKN vs IND, 1 impactado, top: Cam Thomas +9% em P+Ast
  { game_id: 1002, home_team_abbr: 'IND', visitor_team_abbr: 'BKN', trigger_player_id: 8, trigger_name: 'Terance Mann', trigger_status: 'out', trigger_team_abbr: 'BKN', trigger_days_out: 6, rating_stars: 1,
    backup_player_id: 801, backup_player_name: 'Cam Thomas', stat_type: 'player_points_assists', avg_com: 28.4, avg_sem: 31.0, gap: 2.6, gap_pct: 9, score: 64 },

  // 9. Nikola Jovic — MIA vs TOR, 3 impactados, top: Jaquez +18% em Pontos
  { game_id: 1004, home_team_abbr: 'MIA', visitor_team_abbr: 'TOR', trigger_player_id: 9, trigger_name: 'Nikola Jovic', trigger_status: 'out', trigger_team_abbr: 'MIA', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 901, backup_player_name: 'Jaime Jaquez Jr.', stat_type: 'player_points', avg_com: 10.2, avg_sem: 12.0, gap: 1.8, gap_pct: 18, score: 72 },
  { game_id: 1004, home_team_abbr: 'MIA', visitor_team_abbr: 'TOR', trigger_player_id: 9, trigger_name: 'Nikola Jovic', trigger_status: 'out', trigger_team_abbr: 'MIA', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 902, backup_player_name: 'Pelle Larsson', stat_type: 'player_rebounds', avg_com: 2.8, avg_sem: 3.6, gap: 0.8, gap_pct: 29, score: 65 },
  { game_id: 1004, home_team_abbr: 'MIA', visitor_team_abbr: 'TOR', trigger_player_id: 9, trigger_name: 'Nikola Jovic', trigger_status: 'out', trigger_team_abbr: 'MIA', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 903, backup_player_name: 'Kel\'el Ware', stat_type: 'player_blocks', avg_com: 0.8, avg_sem: 1.2, gap: 0.4, gap_pct: 50, score: 64 },

  // 10. Josh Minott — BKN vs IND, 1 impactado, top: Cam Thomas +8% em Reb
  { game_id: 1002, home_team_abbr: 'IND', visitor_team_abbr: 'BKN', trigger_player_id: 10, trigger_name: 'Josh Minott', trigger_status: 'out', trigger_team_abbr: 'BKN', trigger_days_out: 4, rating_stars: 1,
    backup_player_id: 1001, backup_player_name: 'Cam Thomas', stat_type: 'player_rebounds', avg_com: 3.1, avg_sem: 3.3, gap: 0.2, gap_pct: 8, score: 60 },

  // ─── Q (Questionable) ─────────────────────────────────────────────────────
  // OG Anunoby — Q · NYK vs PHI · 4 impactados (cadeia rica pro detalhe)
  // Miles McBride
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2001, backup_player_name: 'Miles McBride', stat_type: 'player_points', avg_com: 9.2, avg_sem: 14.5, gap: 5.3, gap_pct: 58, score: 80, line_value: 10.5, gap_vs_line: 4.0, gap_vs_line_pct: 38 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2001, backup_player_name: 'Miles McBride', stat_type: 'player_assists', avg_com: 3.2, avg_sem: 4.6, gap: 1.4, gap_pct: 44, score: 76, line_value: 3.5, gap_vs_line: 1.1, gap_vs_line_pct: 31 },
  // Josh Hart
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2002, backup_player_name: 'Josh Hart', stat_type: 'player_assists', avg_com: 4.4, avg_sem: 6.1, gap: 1.7, gap_pct: 39, score: 80, line_value: 4.5, gap_vs_line: 1.6, gap_vs_line_pct: 38 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2002, backup_player_name: 'Josh Hart', stat_type: 'player_points_rebounds_assists', avg_com: 22.7, avg_sem: 29.5, gap: 6.8, gap_pct: 30, score: 71, line_value: 25.5, gap_vs_line: 4.0, gap_vs_line_pct: 15 },
  // Mikal Bridges
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2003, backup_player_name: 'Mikal Bridges', stat_type: 'player_points', avg_com: 13.5, avg_sem: 17.8, gap: 4.3, gap_pct: 32, score: 75, line_value: 14.5, gap_vs_line: 3.3, gap_vs_line_pct: 22 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2003, backup_player_name: 'Mikal Bridges', stat_type: 'player_points_rebounds_assists', avg_com: 28.0, avg_sem: 24.4, gap: -3.6, gap_pct: -13, score: 69, line_value: 21.5, gap_vs_line: 2.9, gap_vs_line_pct: 13 },
  // Karl-Anthony Towns
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2004, backup_player_name: 'Karl-Anthony Towns', stat_type: 'player_points_rebounds_assists', avg_com: 32.4, avg_sem: 38.2, gap: 5.8, gap_pct: 18, score: 73, line_value: 33.5, gap_vs_line: 4.7, gap_vs_line_pct: 14 },

  // ─── Complementos: cada backup do OG com as 4 stats principais ─────────────
  // (números fictícios mas coerentes; refletem que "cada um cresce em algo")
  // McBride — faltavam Rebotes e PRA
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2001, backup_player_name: 'Miles McBride', stat_type: 'player_rebounds', avg_com: 3.4, avg_sem: 3.8, gap: 0.4, gap_pct: 12, score: 65, line_value: 3.5, gap_vs_line: 0.3, gap_vs_line_pct: 9 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2001, backup_player_name: 'Miles McBride', stat_type: 'player_points_rebounds_assists', avg_com: 15.8, avg_sem: 22.9, gap: 7.1, gap_pct: 45, score: 78, line_value: 17.5, gap_vs_line: 5.4, gap_vs_line_pct: 31 },
  // Hart — faltavam Pontos e Rebotes
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2002, backup_player_name: 'Josh Hart', stat_type: 'player_points', avg_com: 9.7, avg_sem: 11.2, gap: 1.5, gap_pct: 15, score: 67, line_value: 10.5, gap_vs_line: 0.7, gap_vs_line_pct: 7 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2002, backup_player_name: 'Josh Hart', stat_type: 'player_rebounds', avg_com: 8.2, avg_sem: 9.5, gap: 1.3, gap_pct: 16, score: 72, line_value: 8.5, gap_vs_line: 1.0, gap_vs_line_pct: 12 },
  // Bridges — faltavam Assistências e Rebotes
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2003, backup_player_name: 'Mikal Bridges', stat_type: 'player_assists', avg_com: 3.6, avg_sem: 4.1, gap: 0.5, gap_pct: 14, score: 66, line_value: 3.5, gap_vs_line: 0.6, gap_vs_line_pct: 17 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2003, backup_player_name: 'Mikal Bridges', stat_type: 'player_rebounds', avg_com: 4.2, avg_sem: 4.8, gap: 0.6, gap_pct: 14, score: 65, line_value: 4.5, gap_vs_line: 0.3, gap_vs_line_pct: 7 },
  // Towns — faltavam Pontos, Assistências e Rebotes
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2004, backup_player_name: 'Karl-Anthony Towns', stat_type: 'player_points', avg_com: 23.2, avg_sem: 27.3, gap: 4.1, gap_pct: 18, score: 72, line_value: 24.5, gap_vs_line: 2.8, gap_vs_line_pct: 11 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2004, backup_player_name: 'Karl-Anthony Towns', stat_type: 'player_assists', avg_com: 2.9, avg_sem: 3.2, gap: 0.3, gap_pct: 10, score: 62, line_value: 3.0, gap_vs_line: 0.2, gap_vs_line_pct: 7 },
  { game_id: 1005, home_team_abbr: 'NYK', visitor_team_abbr: 'PHI', trigger_player_id: 20, trigger_name: 'OG Anunoby', trigger_status: 'questionable', trigger_team_abbr: 'NYK', trigger_days_out: 5, rating_stars: 3,
    backup_player_id: 2004, backup_player_name: 'Karl-Anthony Towns', stat_type: 'player_rebounds', avg_com: 12.1, avg_sem: 13.8, gap: 1.7, gap_pct: 14, score: 70, line_value: 12.5, gap_vs_line: 1.3, gap_vs_line_pct: 10 },

  // Norman Powell — Q · BOS vs NYK · 1 impactado · +15%
  { game_id: 1006, home_team_abbr: 'BOS', visitor_team_abbr: 'NYK', trigger_player_id: 21, trigger_name: 'Norman Powell', trigger_status: 'questionable', trigger_team_abbr: 'BOS', trigger_days_out: 2, rating_stars: 3,
    backup_player_id: 2101, backup_player_name: 'Sam Hauser', stat_type: 'player_points', avg_com: 10.4, avg_sem: 12.0, gap: 1.6, gap_pct: 15, score: 68 },

  // Jaylen Brown — Q · BOS vs NYK · 1 impactado · +19%
  { game_id: 1006, home_team_abbr: 'BOS', visitor_team_abbr: 'NYK', trigger_player_id: 22, trigger_name: 'Jaylen Brown', trigger_status: 'questionable', trigger_team_abbr: 'BOS', trigger_days_out: 1, rating_stars: 3,
    backup_player_id: 2201, backup_player_name: 'Payton Pritchard', stat_type: 'player_points', avg_com: 14.2, avg_sem: 16.9, gap: 2.7, gap_pct: 19, score: 75 },

  // Derrick White — Q · BOS vs NYK · 1 impactado · +22%
  { game_id: 1006, home_team_abbr: 'BOS', visitor_team_abbr: 'NYK', trigger_player_id: 23, trigger_name: 'Derrick White', trigger_status: 'questionable', trigger_team_abbr: 'BOS', trigger_days_out: 3, rating_stars: 3,
    backup_player_id: 2301, backup_player_name: 'Payton Pritchard', stat_type: 'player_assists', avg_com: 3.4, avg_sem: 4.1, gap: 0.7, gap_pct: 22, score: 71 },

  // Neemias Queta — Q · BOS vs NYK · 1 impactado · +11%
  { game_id: 1006, home_team_abbr: 'BOS', visitor_team_abbr: 'NYK', trigger_player_id: 24, trigger_name: 'Neemias Queta', trigger_status: 'questionable', trigger_team_abbr: 'BOS', trigger_days_out: 1, rating_stars: 3,
    backup_player_id: 2401, backup_player_name: 'Luke Kornet', stat_type: 'player_rebounds', avg_com: 5.2, avg_sem: 5.8, gap: 0.6, gap_pct: 11, score: 64 },
];

export const MOCK_ANALISE360 = {
  opportunities: rows.map(fill),
  playerStarsMap: new Map<number, number>([
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 2], [6, 2], [7, 1], [8, 1], [9, 3], [10, 1],
    [20, 3], [21, 2], [22, 3], [23, 3], [24, 2],
  ]),
};

/**
 * ?mock=1 só funciona em build dev (vite dev). Em build de produção/staging
 * (vite build), import.meta.env.DEV é false e a query string é ignorada,
 * garantindo que clientes não consigam ativar mock acidentalmente.
 */
export function isMockAnalise360(): boolean {
  if (typeof window === 'undefined') return false;
  if (!import.meta.env.DEV) return false;
  return new URLSearchParams(window.location.search).has('mock');
}
