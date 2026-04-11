import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, Star, Radar, TrendingUp, Calendar,
  AlertTriangle, FileText
} from 'lucide-react';
import { getTeamLogoUrl, getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import { InjuryReportModal } from '@/components/nba/InjuryReportModal';
import { useHomeNBAData } from '@/hooks/use-home-nba';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// --- Date helpers ---

function formatDateBR(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00-03:00`);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long' });
}

// --- Helpers ---

const STAT_LABELS: Record<string, string> = {
  player_points: 'pontos', player_assists: 'assists', player_rebounds: 'rebotes',
  player_threes: '3 pontos', player_steals: 'roubos', player_blocks: 'bloqueios',
  player_points_rebounds_assists: 'pts+reb+ast', player_points_assists: 'pts+ast',
  player_points_rebounds: 'pts+reb', player_rebounds_assists: 'reb+ast',
};

function getTriggerStatusBadge(status: string): { text: string; cls: string } {
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return { text: 'OUT', cls: 'bg-terminal-red/20 text-terminal-red border-terminal-red/30' };
  if (s.includes('doubtful')) return { text: 'DTD', cls: 'bg-orange-400/20 text-orange-400 border-orange-400/30' };
  return { text: 'Q', cls: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' };
}

function slugify(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
}

// --- Player Photo ---

function PlayerPhoto({ name, teamAbbr, size = 'md' }: { name: string; teamAbbr: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  const textClass = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-[10px]' : 'text-[9px]';
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-terminal-gray border border-terminal-border-subtle shrink-0 flex items-center justify-center`}>
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
            if (parent) parent.innerHTML = `<span class="${textClass} font-bold text-terminal-text opacity-60">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

// --- Last Results ---

function LastResults({ results }: { results: string | null }) {
  if (!results) return null;
  const last3 = results.replace(/\s/g, '').slice(0, 3).split('').reverse();
  return (
    <div className="flex items-center gap-0.5">
      {last3.map((r, i) => {
        const isWin = r === 'V' || r === 'W';
        const opacity = ['opacity-40', 'opacity-70', 'opacity-100'][i] ?? 'opacity-100';
        return (
          <span key={i} className={`w-4 h-4 flex items-center justify-center text-[8px] font-bold rounded ${opacity} ${
            isWin ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
          }`}>
            {isWin ? 'V' : 'D'}
          </span>
        );
      })}
    </div>
  );
}

// --- Skeleton ---

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full rounded-lg bg-terminal-dark-gray" />
      ))}
    </div>
  );
}

// --- Section Header (simplified — subtitle removed to reduce noise) ---

function SectionHeader({ icon: Icon, title, count, actionLabel, onAction, actionHref }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-terminal-text/25" />
        <h2 className="text-sm font-bold text-terminal-text/70 uppercase tracking-wide">{title}</h2>
        {count != null && <span className="text-xs text-terminal-text/20 tabular-nums">{count}</span>}
      </div>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0 && onAction) { e.preventDefault(); onAction(); } }}
          className="text-[11px] text-terminal-blue/50 hover:text-terminal-blue flex items-center gap-1 transition-colors shrink-0 no-underline"
        >
          {actionLabel} <ChevronRight className="w-3 h-3" />
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

  const topTriggers = useMemo(() => {
    const starsMap = new Map<number, number>();
    players.forEach(p => starsMap.set(p.player_id, p.rating_stars ?? 0));
    const seen = new Map<number, { id: number; name: string; status: string; teamAbbr: string; daysOut: number | null; stars: number; backupCount: number }>();
    opportunities.forEach(o => {
      if (!seen.has(o.trigger_player_id)) {
        seen.set(o.trigger_player_id, { id: o.trigger_player_id, name: o.trigger_name, status: o.trigger_status, teamAbbr: o.trigger_team_abbr, daysOut: o.trigger_days_out, stars: starsMap.get(o.trigger_player_id) ?? 0, backupCount: 0 });
      }
      seen.get(o.trigger_player_id)!.backupCount = new Set(opportunities.filter(x => x.trigger_player_id === o.trigger_player_id && x.backup_player_id).map(x => x.backup_player_id)).size;
    });
    return Array.from(seen.values()).filter(t => t.stars >= 2).sort((a, b) => b.stars - a.stars).slice(0, 3);
  }, [opportunities, players]);

  const topOpps = useMemo(() => [...opportunities].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 2), [opportunities]);

  // Build set of teams with injuries for game card indicators
  const teamsWithInjuries = useMemo(() => {
    const set = new Set<string>();
    topTriggers.forEach(t => set.add(t.teamAbbr));
    return set;
  }, [topTriggers]);

  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return players.filter(p => p.player_name.toLowerCase().includes(term) || p.team_abbreviation.toLowerCase().includes(term)).sort((a, b) => (b.rating_stars ?? 0) - (a.rating_stars ?? 0)).slice(0, 8);
  }, [players, searchTerm]);

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <Helmet>
        <title>Lesões NBA Hoje e Oportunidades de Apostas do Dia | Smart Betting</title>
        <meta name="description" content="Lesões chave da NBA hoje com impacto nos companheiros, oportunidades de prop bets selecionadas e jogos do dia. Atualizado diariamente." />
      </Helmet>
      <AnalyticsNav />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header + Impact headline */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-terminal-blue mb-0.5">Hoje na NBA</h1>
            <p className="text-sm text-terminal-text/35 capitalize">{formatDateBR(today)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-terminal-text/25" />
              <Input
                placeholder="Buscar jogador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={() => setTimeout(() => setSearchTerm(''), 200)}
                className="pl-8 w-44 sm:w-48 lg:w-56 bg-terminal-dark-gray border-terminal-border-subtle/50 text-terminal-text placeholder:text-terminal-text/20 h-9 font-mono text-xs rounded-md"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full mt-1 right-0 w-72 bg-terminal-dark-gray border border-terminal-border-subtle/60 rounded-lg shadow-xl shadow-black/40 z-50 overflow-hidden">
                  {searchResults.map(player => {
                    const slug = slugify(player.player_name);
                    return (
                      <a key={player.player_id} href={`/nba-dashboard/${slug}`}
                        onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); setSearchTerm(''); navigate(`/nba-dashboard/${slug}`); } }}
                        className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-terminal-gray/40 transition-colors no-underline border-b border-terminal-border-subtle/20 last:border-b-0"
                      >
                        <PlayerPhoto name={player.player_name} teamAbbr={player.team_abbreviation} size="sm" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-terminal-text truncate block">{player.player_name}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-terminal-text/40">
                            <span>{player.team_abbreviation}</span>
                            {player.rating_stars > 0 && (
                              <div className="flex items-center gap-0.5 ml-1">
                                {Array.from({ length: Math.min(player.rating_stars, 5) }).map((_, i) => (
                                  <Star key={i} className="w-2 h-2 text-terminal-yellow fill-terminal-yellow" />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-terminal-text/20 shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
              {searchTerm.length >= 2 && searchResults.length === 0 && !isLoading && (
                <div className="absolute top-full mt-1 right-0 w-72 bg-terminal-dark-gray border border-terminal-border-subtle/60 rounded-lg shadow-xl shadow-black/40 z-50 px-3 py-3 text-xs text-terminal-text/30 text-center">
                  Nenhum jogador encontrado
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Impact headline — the aha moment */}
        {!isLoading && (topTriggers.length > 0 || topOpps.length > 0 || games.length > 0) && (
          <div className="flex items-center gap-2 mb-6">
            {topTriggers.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-terminal-red/70 bg-terminal-red/5 border border-terminal-red/15 px-2 py-1 rounded-full whitespace-nowrap">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="font-bold tabular-nums">{topTriggers.length}</span> lesoes chave
              </span>
            )}
            {topOpps.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-terminal-green/70 bg-terminal-green/5 border border-terminal-green/15 px-2 py-1 rounded-full whitespace-nowrap">
                <TrendingUp className="w-3 h-3 shrink-0" />
                <span className="font-bold tabular-nums">{topOpps.length}</span> oportunidades
              </span>
            )}
            {games.length > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-terminal-blue/70 bg-terminal-blue/5 border border-terminal-blue/15 px-2 py-1 rounded-full whitespace-nowrap">
                <Calendar className="w-3 h-3 shrink-0" />
                <span className="font-bold tabular-nums">{games.length}</span> jogos
              </span>
            )}
          </div>
        )}

        {/* Section 1: Hero Destaque + Sidebar (oportunidades + lesões) */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
            <Skeleton className="lg:col-span-3 h-52 rounded-xl bg-terminal-dark-gray" />
            <div className="lg:col-span-2 space-y-2">
              <Skeleton className="h-16 w-full rounded-lg bg-terminal-dark-gray" />
              <Skeleton className="h-16 w-full rounded-lg bg-terminal-dark-gray" />
              <Skeleton className="h-16 w-full rounded-lg bg-terminal-dark-gray" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-10 items-start">
            {/* Left: Destaques do Dia (opp #1 + opp #2 + ver todas) */}
            <div className="lg:col-span-3 bg-terminal-dark-gray border border-terminal-border-subtle/50 rounded-xl p-4 space-y-3">
              <span className="text-[9px] text-terminal-blue/50 uppercase tracking-widest font-semibold block">Destaques do Dia</span>

              {isLoading ? <SectionSkeleton rows={2} /> : topOpps.length === 0 ? (
                <p className="text-sm text-terminal-text/25 py-4 text-center">Nenhuma oportunidade disponivel</p>
              ) : (
                <>
                  {topOpps.map((opp) => {
                    const slug = slugify(opp.backup_player_name);
                    const isPositive = opp.gap_pct > 0;
                    const triggerLastName = opp.trigger_name.split(' ').pop();
                    const statLabel = STAT_LABELS[opp.stat_type] ?? opp.stat_type;
                    return (
                      <a
                        key={`${opp.trigger_player_id}-${opp.backup_player_id}-${opp.stat_type}`}
                        href={`/nba-dashboard/${slug}?stat=${opp.stat_type}&trigger=${encodeURIComponent(opp.trigger_name)}`}
                        onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate(`/nba-dashboard/${slug}?stat=${opp.stat_type}&trigger=${encodeURIComponent(opp.trigger_name)}`); } }}
                        className="block bg-terminal-gray rounded-lg p-3 hover:bg-terminal-gray/80 active:scale-[0.99] border border-terminal-border-subtle transition-all no-underline"
                      >
                        <div className="flex items-start gap-3">
                          <PlayerPhoto name={opp.backup_player_name} teamAbbr={opp.trigger_team_abbr} size="lg" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-terminal-text leading-relaxed mb-1.5">
                              <span className="font-bold">{opp.backup_player_name}</span> faz{' '}
                              <span className={`font-bold ${isPositive ? 'text-terminal-green' : 'text-terminal-red'}`}>{isPositive ? '+' : ''}{opp.gap_pct.toFixed(0)}% {statLabel}</span>{' '}
                              quando {triggerLastName}{' '}
                              <span className={`font-bold ${getTriggerStatusBadge(opp.trigger_status).cls.split(' ').find(c => c.startsWith('text-'))}`}>({getTriggerStatusBadge(opp.trigger_status).text})</span> nao joga
                            </p>
                            <div className="flex items-center gap-2 text-[11px] flex-wrap">
                              <span className="text-terminal-text/30 tabular-nums">{opp.avg_com.toFixed(1)} → <span className="text-terminal-text font-bold">{opp.avg_sem.toFixed(1)}</span></span>
                              {opp.line_value != null && (
                                <>
                                  <span className="text-terminal-text/15">|</span>
                                  <span className="text-terminal-text/30 tabular-nums">Linha {opp.line_value.toFixed(1)}</span>
                                  {opp.gap_vs_line_pct != null && (
                                    <span className={`font-bold tabular-nums ${opp.gap_vs_line_pct > 0 ? 'text-terminal-green/70' : 'text-terminal-red/70'}`}>({opp.gap_vs_line_pct > 0 ? '+' : ''}{opp.gap_vs_line_pct.toFixed(0)}%)</span>
                                  )}
                                </>
                              )}
                              {opp.score != null && (
                                <>
                                  <span className="text-terminal-text/15">|</span>
                                  <span className={`font-bold tabular-nums ${opp.score >= 80 ? 'text-terminal-green' : opp.score >= 70 ? 'text-terminal-yellow' : 'text-orange-400'}`}>Score {opp.score}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                  {/* Ver todas */}
                  <a
                    href="/oportunidades"
                    onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate('/oportunidades'); } }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 bg-terminal-gray border border-terminal-blue/20 rounded-lg hover:bg-terminal-gray/80 active:scale-[0.99] transition-all text-left no-underline"
                  >
                    <TrendingUp className="w-4 h-4 text-terminal-blue/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-terminal-blue/70 block">Ver Todas as Oportunidades</span>
                      <span className="text-[10px] text-terminal-text/25">Tabela completa com scores, gaps e linhas</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-terminal-blue/20 shrink-0" />
                  </a>
                </>
              )}
            </div>

            {/* Right: Lesões Chave + CTAs */}
            <div className="lg:col-span-2 space-y-3">
              {/* Lesões chave */}
              {topTriggers.length > 0 && (
                <div>
                  <span className="text-[9px] text-terminal-text/25 uppercase tracking-widest font-semibold block mb-2">Lesoes Chave</span>
                  <div className="space-y-1.5">
                    {topTriggers.slice(0, 3).map(t => (
                      <a
                        key={t.id}
                        href={`/analise-360/${t.id}`}
                        onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate(`/analise-360/${t.id}`); } }}
                        className="w-full bg-terminal-dark-gray border border-terminal-border-subtle/40 rounded-lg px-3 py-2.5 flex items-center gap-2.5 hover:border-terminal-red/25 active:scale-[0.99] transition-all text-left no-underline"
                      >
                        <PlayerPhoto name={t.name} teamAbbr={t.teamAbbr} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm font-bold text-terminal-text truncate">{t.name}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${getTriggerStatusBadge(t.status).cls}`}>
                              {getTriggerStatusBadge(t.status).text}
                            </span>
                          </div>
                          <span className="text-[10px] text-terminal-text/35">{t.backupCount} impactados</span>
                        </div>
                        <span className="text-[10px] text-terminal-blue/50 shrink-0 whitespace-nowrap">Ver impacto →</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Injury Report */}
              <button
                onClick={() => setInjuryModalOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-terminal-blue/5 border border-terminal-blue/15 rounded-lg hover:bg-terminal-blue/10 active:scale-[0.99] transition-all text-left"
              >
                <AlertTriangle className="w-4 h-4 text-terminal-blue/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-terminal-blue/70 block">Injury Report Completo</span>
                  <span className="text-[10px] text-terminal-text/25">Todas as lesoes dos jogos de hoje</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-terminal-blue/20 shrink-0" />
              </button>

              {/* Análise 360 */}
              <a
                href="/analise-360"
                onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate('/analise-360'); } }}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-terminal-blue/5 border border-terminal-blue/15 rounded-lg hover:bg-terminal-blue/10 active:scale-[0.99] transition-all text-left no-underline"
              >
                <Radar className="w-4 h-4 text-terminal-blue/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-terminal-blue/70 block">Analise 360</span>
                  <span className="text-[10px] text-terminal-text/25">Veja o impacto completo das lesoes nos companheiros</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-terminal-blue/20 shrink-0" />
              </a>

              {/* Relatório do Dia */}
              <a
                href="/report"
                onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate('/report'); } }}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-terminal-blue/5 border border-terminal-blue/15 rounded-lg hover:bg-terminal-blue/10 active:scale-[0.99] transition-all text-left no-underline"
              >
                <FileText className="w-4 h-4 text-terminal-blue/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-terminal-blue/70 block">Relatorio do Dia</span>
                  <span className="text-[10px] text-terminal-text/25">Resumo com as melhores analises e picks</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-terminal-blue/20 shrink-0" />
              </a>
            </div>
          </div>
        )}

        {/* Section 2: Jogos de Hoje — horizontal scroll */}
        <div className="mb-10">
          <SectionHeader icon={Calendar} title="Jogos de Hoje" count={games.length || undefined} actionLabel="Ver todos" actionHref="/home-games" onAction={() => navigate('/home-games')} />

          {isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-52 rounded-xl bg-terminal-dark-gray shrink-0" />
              ))}
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-8 text-xs text-terminal-text/25">Nenhum jogo hoje</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
              {games.map(game => {
                const finished = game.winner_team_id !== null;
                const homeWon = finished && game.winner_team_id === game.home_team_id;
                const visitorWon = finished && game.winner_team_id === game.visitor_team_id;
                const hasInjuryImpact = teamsWithInjuries.has(game.home_team_abbreviation) || teamsWithInjuries.has(game.visitor_team_abbreviation);
                return (
                  <a
                    key={game.game_id}
                    href={`/game/${game.game_id}?date=${game.game_date}`}
                    onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate(`/game/${game.game_id}?date=${game.game_date}`); } }}
                    className={`shrink-0 w-56 bg-terminal-dark-gray border rounded-xl p-3.5 hover:border-terminal-green/40 active:scale-[0.98] transition-all no-underline ${hasInjuryImpact ? 'border-terminal-red/25' : 'border-terminal-border-subtle/50'}`}
                  >
                    {/* Time + injury indicator + chevron */}
                    <div className="flex items-center justify-between mb-3">
                      {game.game_datetime_brasilia && !finished ? (
                        <span className="text-xs text-terminal-blue font-mono tabular-nums font-bold">
                          {new Date(game.game_datetime_brasilia).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : finished ? (
                        <span className="text-[10px] bg-terminal-gray/40 text-terminal-text/60 px-1.5 py-0.5 rounded">FT</span>
                      ) : (
                        <span className="text-[10px] text-terminal-text/30">TBD</span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {(game.home_team_is_b2b_game || game.visitor_team_is_b2b_game) && (
                          <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded">B2B</span>
                        )}
                        {hasInjuryImpact && !finished && (
                          <span className="text-[8px] text-terminal-red/50 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />
                          </span>
                        )}
                        <ChevronRight className="w-3 h-3 text-terminal-text/15" />
                      </div>
                    </div>
                    {/* Home team */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        <img src={getTeamLogoUrl(game.home_team_name)} alt={game.home_team_abbreviation} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                      </div>
                      <span className={`text-sm font-bold flex-1 truncate ${homeWon ? 'text-terminal-green' : 'text-terminal-text'}`}>{game.home_team_abbreviation}</span>
                      {finished && <span className={`text-sm font-bold tabular-nums ${homeWon ? 'text-terminal-green' : 'text-terminal-text/40'}`}>{game.home_team_score}</span>}
                      <LastResults results={game.home_team_last_five} />
                    </div>
                    {/* Visitor team */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        <img src={getTeamLogoUrl(game.visitor_team_name)} alt={game.visitor_team_abbreviation} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                      </div>
                      <span className={`text-sm font-bold flex-1 truncate ${visitorWon ? 'text-terminal-green' : 'text-terminal-text'}`}>{game.visitor_team_abbreviation}</span>
                      {finished && <span className={`text-sm font-bold tabular-nums ${visitorWon ? 'text-terminal-green' : 'text-terminal-text/40'}`}>{game.visitor_team_score}</span>}
                      <LastResults results={game.visitor_team_last_five} />
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

      </div>

      <InjuryReportModal open={injuryModalOpen} onClose={() => setInjuryModalOpen(false)} games={games} />
    </div>
  );
}
