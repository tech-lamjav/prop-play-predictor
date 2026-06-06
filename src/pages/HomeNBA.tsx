import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, Star, FileText, LayoutGrid, ArrowRight } from 'lucide-react';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import { InjuryReportModal } from '@/components/nba/InjuryReportModal';
import { useHomeNBAData } from '@/hooks/use-home-nba';
import { NBAHomeNav } from '@/components/nba-home/NBAHomeHeader';
import { NBABriefingStrip } from '@/components/nba-home/NBABriefingStrip';
import { NBATopPickHero, type TopPickData } from '@/components/nba-home/NBATopPickHero';
import { NBAHotOppCard, type HotOppData } from '@/components/nba-home/NBAHotOppCard';
import { NBAKeyInjuriesRail, type KeyInjuryData } from '@/components/nba-home/NBAKeyInjuriesRail';
import { NBAGamesRich, type RichGame } from '@/components/nba-home/NBAGamesRich';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// --- Date helpers ---

function getSaoPauloTodayDate(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value ?? '2025';
  const m = parts.find(p => p.type === 'month')?.value ?? '01';
  const d = parts.find(p => p.type === 'day')?.value ?? '01';
  return new Date(`${y}-${m}-${d}T12:00:00-03:00`);
}

// --- Helpers ---

function slugify(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
}

// --- Player Photo ---

function PlayerPhoto({ name, teamAbbr, size = 'md' }: { name: string; teamAbbr: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  const textClass = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-[10px]' : 'text-[9px]';
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-ink-3 border border-line shrink-0 flex items-center justify-center`}>
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={`Foto de ${name}`}
        className="w-full h-full object-cover object-top"
        loading="lazy"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.innerHTML = `<span class="${textClass} font-semibold text-ink-2">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

// --- Section Header ---

function SectionHeader({ eyebrow, title, count, actionLabel, onAction, actionHref }: {
  eyebrow?: string;
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-ink-2">{eyebrow}</div>
        )}
        <div className="text-[18px] font-semibold tracking-tight mt-1 text-ink">
          {title}
          {count != null && <span className="text-ink-2/70 font-normal text-[14px] ml-2 tabular">{count}</span>}
        </div>
      </div>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0 && onAction) { e.preventDefault(); onAction(); } }}
          className="text-[12px] font-semibold inline-flex items-center gap-1 transition-colors shrink-0 no-underline text-forest hover:text-forest-soft"
        >
          {actionLabel} <ChevronRight className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

// --- Main Page ---

export default function HomeNBA() {
  const navigate = useNavigate();
  const { data, isLoading } = useHomeNBAData();
  const games = data?.games ?? [];
  const players = data?.players ?? [];
  const opportunities = data?.opportunities ?? [];
  const today = data?.today ?? '';

  const [searchTerm, setSearchTerm] = useState('');
  const [injuryModalOpen, setInjuryModalOpen] = useState(false);

  // --- Derived data ---

  const todayDate = useMemo(() => (today ? new Date(`${today}T12:00:00-03:00`) : getSaoPauloTodayDate()), [today]);

  interface TriggerAgg {
    id: number;
    name: string;
    status: string;
    teamAbbr: string;
    daysOut: number | null;
    stars: number;
    backupCount: number;
    topImpact: { playerName: string; statType: string; gapPct: number } | null;
  }

  const topTriggers = useMemo<TriggerAgg[]>(() => {
    const starsMap = new Map<number, number>();
    players.forEach(p => starsMap.set(p.player_id, p.rating_stars ?? 0));
    const seen = new Map<number, TriggerAgg>();
    opportunities.forEach(o => {
      if (!seen.has(o.trigger_player_id)) {
        seen.set(o.trigger_player_id, {
          id: o.trigger_player_id,
          name: o.trigger_name,
          status: o.trigger_status,
          teamAbbr: o.trigger_team_abbr,
          daysOut: o.trigger_days_out,
          stars: starsMap.get(o.trigger_player_id) ?? 0,
          backupCount: 0,
          topImpact: null,
        });
      }
      const agg = seen.get(o.trigger_player_id)!;
      agg.backupCount = new Set(
        opportunities
          .filter(x => x.trigger_player_id === o.trigger_player_id && x.backup_player_id)
          .map(x => x.backup_player_id),
      ).size;
      // Top impact = maior gap_pct entre as oportunidades deste trigger
      if (!agg.topImpact || o.gap_pct > agg.topImpact.gapPct) {
        agg.topImpact = { playerName: o.backup_player_name, statType: o.stat_type, gapPct: o.gap_pct };
      }
    });
    return Array.from(seen.values())
      .filter(t => t.stars >= 2)
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 4);
  }, [opportunities, players]);

  const sortedOpps = useMemo(() => [...opportunities].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [opportunities]);
  const heroPick = sortedOpps[0] ?? null;
  /** Restantes (sem o hero) para a seção de oportunidades. */
  const topOpps = useMemo(() => sortedOpps.slice(1, 4), [sortedOpps]);

  const heroData = useMemo<TopPickData | null>(() => {
    if (!heroPick) return null;
    return {
      playerName: heroPick.backup_player_name,
      teamAbbr: heroPick.trigger_team_abbr,
      statType: heroPick.stat_type,
      triggerName: heroPick.trigger_name,
      triggerStatus: heroPick.trigger_status,
      lineValue: heroPick.line_value,
      avgCom: heroPick.avg_com,
      avgSem: heroPick.avg_sem,
      gapPct: heroPick.gap_pct,
      edgePct: heroPick.gap_vs_line_pct,
      score: heroPick.score,
      opponentAbbr: heroPick.opponent_abbr,
      isHome: heroPick.is_home,
      gameTime: heroPick.game_time,
    };
  }, [heroPick]);

  const handleOpenHero = () => {
    if (!heroPick) return;
    const slug = slugify(heroPick.backup_player_name);
    navigate(`/nba-dashboard/${slug}?stat=${heroPick.stat_type}&trigger=${encodeURIComponent(heroPick.trigger_name)}`);
  };

  // Onda 3 — Hot opportunities (4 cards) e Key Injuries (rail)
  const hotOppsData = useMemo<Array<HotOppData & { _opp: typeof sortedOpps[0] }>>(() => {
    return topOpps.map(o => ({
      _opp: o,
      playerName: o.backup_player_name,
      teamAbbr: o.trigger_team_abbr,
      statType: o.stat_type,
      triggerName: o.trigger_name,
      triggerStatus: o.trigger_status,
      lineValue: o.line_value,
      projection: o.avg_sem,
      edgePct: o.gap_vs_line_pct,
      score: o.score,
      ratingStars: o.rating_stars,
      opponentAbbr: o.opponent_abbr,
      isHome: o.is_home,
      gameTime: o.game_time,
    }));
  }, [topOpps]);

  const keyInjuriesData = useMemo<KeyInjuryData[]>(() => {
    return topTriggers.map(t => ({
      id: t.id,
      name: t.name,
      teamAbbr: t.teamAbbr,
      status: t.status,
      impactedCount: t.backupCount,
      topImpact: t.topImpact,
    }));
  }, [topTriggers]);

  // Onda 4 — enriquecer cada jogo com angle + highlights + injuries vindos de opportunities
  const richGames = useMemo<RichGame[]>(() => {
    const STAT_DEF_LABEL: Record<string, string> = {
      player_points: 'Defesa de pontos',
      player_assists: 'Defesa de assist.',
      player_rebounds: 'Reb. cedidos',
      player_threes: 'Defesa de 3pts',
      player_steals: 'Defesa de roubos',
      player_blocks: 'Defesa de blocks',
      player_points_rebounds_assists: 'Defesa de PRA',
      player_points_assists: 'Defesa de PA',
      player_points_rebounds: 'Defesa de PR',
      player_rebounds_assists: 'Defesa de RA',
    };
    const STAT_SHORT: Record<string, string> = {
      player_points: 'pts', player_assists: 'ast', player_rebounds: 'reb',
      player_threes: '3pts', player_steals: 'stl', player_blocks: 'blk',
      player_points_rebounds_assists: 'pra', player_points_assists: 'pa',
      player_points_rebounds: 'pr', player_rebounds_assists: 'ra',
    };

    return games.map<RichGame>(game => {
      const finished = game.winner_team_id !== null;
      const gameOpps = opportunities.filter(o => o.game_id === game.game_id);

      // Highlights: top 2 opps por score (sem repetir player+stat)
      const seenKey = new Set<string>();
      const highlights = [...gameOpps]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .filter(o => {
          const k = `${o.backup_player_id ?? o.backup_player_name}-${o.stat_type}`;
          if (seenKey.has(k)) return false;
          seenKey.add(k);
          return true;
        })
        .slice(0, 2)
        .map(o => ({
          playerName: o.backup_player_name,
          teamAbbr: o.trigger_team_abbr,
          stars: o.rating_stars,
          statShort: STAT_SHORT[o.stat_type] ?? o.stat_type,
          gapPct: o.gap_pct,
        }));

      // Angle: top opp por score que tenha opponent_def_rank
      const angleOpp = [...gameOpps]
        .filter(o => o.opponent_def_rank != null && o.opponent_abbr != null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
      const angle = angleOpp
        ? {
            teamAbbr: angleOpp.opponent_abbr!,
            metricLabel: STAT_DEF_LABEL[angleOpp.stat_type] ?? 'Defesa',
            rank: angleOpp.opponent_def_rank!,
          }
        : null;

      // Injuries: triggers únicos do jogo (até 3)
      const seenTriggers = new Map<number, { name: string; teamAbbr: string; status: string }>();
      gameOpps.forEach(o => {
        if (!seenTriggers.has(o.trigger_player_id)) {
          seenTriggers.set(o.trigger_player_id, {
            name: o.trigger_name,
            teamAbbr: o.trigger_team_abbr,
            status: o.trigger_status,
          });
        }
      });
      const injuries = Array.from(seenTriggers.values()).slice(0, 3);

      return {
        gameId: game.game_id,
        gameDate: game.game_date,
        gameDatetimeBrasilia: game.game_datetime_brasilia,
        isFinished: finished,
        homeWon: finished && game.winner_team_id === game.home_team_id,
        visitorWon: finished && game.winner_team_id === game.visitor_team_id,
        home: {
          teamId: game.home_team_id,
          abbr: game.home_team_abbreviation,
          name: game.home_team_name,
          score: game.home_team_score,
          lastFive: game.home_team_last_five,
          isB2B: game.home_team_is_b2b_game,
        },
        visitor: {
          teamId: game.visitor_team_id,
          abbr: game.visitor_team_abbreviation,
          name: game.visitor_team_name,
          score: game.visitor_team_score,
          lastFive: game.visitor_team_last_five,
          isB2B: game.visitor_team_is_b2b_game,
        },
        angle,
        highlights,
        injuries,
      };
    });
  }, [games, opportunities]);

  // KPIs do BriefingStrip
  const briefingKpis = useMemo(() => {
    const highConf = opportunities.filter(o => (o.rating_stars ?? 0) >= 3).length;
    return {
      games: games.length,
      opps: opportunities.length,
      highConf,
      keyInjuries: topTriggers.length,
    };
  }, [games, opportunities, topTriggers]);

  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return players.filter(p => p.player_name.toLowerCase().includes(term) || p.team_abbreviation.toLowerCase().includes(term)).sort((a, b) => (b.rating_stars ?? 0) - (a.rating_stars ?? 0)).slice(0, 8);
  }, [players, searchTerm]);

  return (
    <div className="theme-rebrand w-full min-h-screen bg-canvas text-ink">
      <Helmet>
        <title>Lesões NBA Hoje e Oportunidades de Apostas do Dia | Smart Betting</title>
        <meta name="description" content="Lesões chave da NBA hoje com impacto nos companheiros, oportunidades de prop bets selecionadas e jogos do dia. Atualizado diariamente." />
      </Helmet>
      <NBAHomeNav showBack />

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 sm:px-6 py-6 focus:outline-none flex flex-col gap-6 md:gap-7">
        {/* Briefing strip com busca embarcada na coluna esquerda */}
        <NBABriefingStrip
          date={todayDate}
          kpis={briefingKpis}
          searchSlot={
            <div className="relative w-full md:w-80">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-2" />
              <Input
                placeholder="Buscar jogador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={() => setTimeout(() => setSearchTerm(''), 200)}
                className="pl-9 w-full h-10 bg-white border border-line text-ink placeholder:text-ink-2 text-[13px] rounded-md"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 w-full bg-white border border-line rounded-lg shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] z-50 overflow-hidden">
                  {searchResults.map(player => {
                    const slug = slugify(player.player_name);
                    return (
                      <a key={player.player_id} href={`/nba-dashboard/${slug}`}
                        onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); setSearchTerm(''); navigate(`/nba-dashboard/${slug}`); } }}
                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-ink-3/40 transition-colors no-underline border-b border-line last:border-b-0"
                      >
                        <PlayerPhoto name={player.player_name} teamAbbr={player.team_abbreviation} size="sm" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[13px] font-semibold text-ink truncate block">{player.player_name}</span>
                          <div className="flex items-center gap-1.5 text-[11px] text-ink-2">
                            <span>{player.team_abbreviation}</span>
                            {player.rating_stars > 0 && (
                              <div className="flex items-center gap-0.5 ml-1">
                                {Array.from({ length: Math.min(player.rating_stars, 5) }).map((_, i) => (
                                  <Star key={i} className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-ink-2/60 shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
              {searchTerm.length >= 2 && searchResults.length === 0 && !isLoading && (
                <div className="absolute top-full mt-1 left-0 w-full bg-white border border-line rounded-lg shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] z-50 px-3 py-3 text-[12px] text-ink-2 text-center">
                  Nenhum jogador encontrado
                </div>
              )}
            </div>
          }
        />

        {/* Onda 2: TopPickHero — destaque #1 do dia (skeleton enquanto carrega) */}
        {isLoading ? (
          <Skeleton className="h-64 rounded-2xl" />
        ) : heroData ? (
          <NBATopPickHero pick={heroData} onOpenAnalysis={handleOpenHero} />
        ) : null}

        {/* Onda 3: HotOpps grid + KeyInjuriesRail (2-col) */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
            <div className="lg:col-span-2 space-y-2">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
            {/* Left: Outras oportunidades quentes (3 cards + CTA no slot 4 do grid 2x2) */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-ink-2">Outras oportunidades quentes</div>

              {hotOppsData.length === 0 ? (
                <div className="bg-white border border-line rounded-xl p-6 text-center text-[13px] text-ink-2">
                  Sem oportunidades adicionais hoje
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hotOppsData.map(o => {
                    const opp = o._opp;
                    const slug = slugify(opp.backup_player_name);
                    return (
                      <NBAHotOppCard
                        key={`${opp.trigger_player_id}-${opp.backup_player_id}-${opp.stat_type}`}
                        opp={o}
                        href={`/nba-dashboard/${slug}?stat=${opp.stat_type}&trigger=${encodeURIComponent(opp.trigger_name)}`}
                        onClick={() => navigate(`/nba-dashboard/${slug}?stat=${opp.stat_type}&trigger=${encodeURIComponent(opp.trigger_name)}`)}
                      />
                    );
                  })}
                  {/* CTA card no slot vazio do grid 2x2 — leva pra tela com tabela completa */}
                  <a
                    href="/oportunidades"
                    onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate('/oportunidades'); } }}
                    className="group bg-forest-tint border border-forest/20 rounded-xl p-4 hover:bg-forest-tint/70 hover:border-forest/40 transition-colors no-underline flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-md grid place-items-center bg-forest text-white shrink-0">
                        <LayoutGrid className="w-5 h-5" />
                      </div>
                      <div className="text-[14px] font-semibold tracking-tight text-forest leading-tight">
                        As {opportunities.length} oportunidades de hoje
                      </div>
                    </div>
                    <div className="text-[12px] text-ink-2 leading-relaxed flex-1">
                      Compare lado a lado e ordene por score, vantagem ou linha.
                    </div>
                    <div className="h-10 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-amber-400 text-ink group-hover:bg-amber-300 transition-colors w-full">
                      <span>Ver oportunidades</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </a>
                </div>
              )}
            </div>

            {/* Right: KeyInjuriesRail */}
            <div className="lg:col-span-2">
              <NBAKeyInjuriesRail
                injuries={keyInjuriesData}
                onSelect={(id) => navigate(`/analise-360/${id}`)}
                onOpenAll={() => navigate('/analise-360')}
                onOpenInjuryReport={() => setInjuryModalOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Onda 4: Jogos de hoje — rich rows (desktop) / stacked cards (mobile) */}
        <div>
          <SectionHeader
            eyebrow="Jogos de hoje"
            title={`${games.length || 0} ${games.length === 1 ? 'partida' : 'partidas'}`}
            actionLabel="Ver todos"
            actionHref="/home-games"
            onAction={() => navigate('/home-games')}
          />

          {isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <NBAGamesRich
              games={richGames}
              onOpenGame={(id, date) => navigate(`/game/${id}?date=${date}`)}
            />
          )}
        </div>

        {/* Acesso rápido — Relatório do dia (Injury Report agora vive dentro do KeyInjuriesRail) */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-ink-2 mb-3">Acesso rápido</div>
          <a
            href="/report"
            onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate('/report'); } }}
            className="block text-left rounded-xl px-5 py-4 flex items-center gap-4 transition-colors bg-white border border-line hover:border-forest/30 no-underline"
          >
            <div className="w-11 h-11 rounded-lg grid place-items-center bg-ink-3/60 text-forest shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold tracking-tight text-ink">Relatório do dia</div>
              <div className="text-[11px] mt-0.5 text-ink-2">Resumo com as melhores análises e picks</div>
            </div>
            <ChevronRight className="w-4 h-4 text-ink-2/40 shrink-0" />
          </a>
        </div>
      </main>

      <InjuryReportModal
        open={injuryModalOpen}
        onClose={() => setInjuryModalOpen(false)}
        games={games}
        opportunities={opportunities}
      />
    </div>
  );
}
