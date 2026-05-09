import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  LayoutList,
  Loader2,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { nbaDataService, DailyOpportunity } from '@/services/nba-data.service';
import { getTeamLogoUrl, getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscription } from '@/hooks/use-subscription';

const STAT_LABELS: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_threes: '3 Pontos',
  player_steals: 'Roubos',
  player_blocks: 'Bloqueios',
  player_turnovers: 'Turnovers',
  player_minutes: 'Minutos',
  player_points_assists: 'Pts + Ast',
  player_points_rebounds: 'Pts + Reb',
  player_rebounds_assists: 'Reb + Ast',
  player_points_rebounds_assists: 'PRA',
  player_blocks_steals: 'Blk + Stl',
};

function getTriggerStatusBadge(status: string): { text: string; cls: string } {
  const s = status.toLowerCase();
  if (s.includes('out for season')) return { text: 'OFS', cls: 'bg-terminal-red/20 text-terminal-red border-terminal-red/30' };
  if (s === 'out' || s.includes('out')) return { text: 'OUT', cls: 'bg-terminal-red/20 text-terminal-red border-terminal-red/30' };
  if (s.includes('doubtful')) return { text: 'DTD', cls: 'bg-orange-400/20 text-orange-400 border-orange-400/30' };
  return { text: 'Q', cls: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' };
}

function getTriggerStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return 'text-terminal-red';
  if (s.includes('doubtful')) return 'text-orange-400';
  return 'text-yellow-400';
}

function getScoreColor(score: number | null): string {
  if (!score) return 'opacity-50';
  if (score >= 80) return 'text-terminal-green';
  if (score >= 70) return 'text-terminal-yellow';
  return 'text-orange-400';
}

function PlayerPhoto({ name, teamAbbr }: { name: string; teamAbbr: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden bg-terminal-gray border border-terminal-border-subtle shrink-0 flex items-center justify-center">
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={name}
        className="w-full h-full object-cover object-top"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.innerHTML = `<span class="text-[9px] font-bold text-terminal-text opacity-60">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

type SortField = 'score' | 'gap_pct' | 'gap_vs_line_pct' | 'rating_stars';
type SortDir = 'asc' | 'desc';
type ViewMode = 'score' | 'game';

export default function Picks() {
  const navigate = useNavigate();
  const { isPremium } = useSubscription();
  const [opportunities, setOpportunities] = useState<DailyOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Free users: top 2 opportunities visible, rest blurred
  const FREE_VISIBLE_COUNT = 2;
  const isRowFree = (idx: number) => isPremium || idx < FREE_VISIBLE_COUNT;
  const getBlur = (idx: number) => isRowFree(idx) ? '' : 'blur-sm select-none pointer-events-none';

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('score');

  // Filters
  const [statFilter, setStatFilter] = useState<string>('all');
  const [gameFilter, setGameFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);

  // Sort
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Mobile expand
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Game group collapse (Por Jogo view)
  const [collapsedGames, setCollapsedGames] = useState<Set<number>>(new Set());
  const toggleGameCollapse = (gameId: number) => {
    setCollapsedGames(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId); else next.add(gameId);
      return next;
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await nbaDataService.getDailyOpportunities();
        setOpportunities(data);
      } catch (err) {
        console.error('Error loading opportunities:', err);
        setError('Falha ao carregar oportunidades');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const uniqueGames = useMemo(() => {
    const seen = new Map<number, { id: number; label: string }>();
    opportunities.forEach(o => {
      if (!seen.has(o.game_id)) {
        seen.set(o.game_id, { id: o.game_id, label: `${o.home_team_abbr} vs ${o.visitor_team_abbr}` });
      }
    });
    return Array.from(seen.values());
  }, [opportunities]);

  const availableStats = useMemo(() => {
    const set = new Set(opportunities.map(o => o.stat_type));
    return Array.from(set).sort();
  }, [opportunities]);

  const filtered = useMemo(() => {
    let result = [...opportunities];

    if (statFilter !== 'all') result = result.filter(o => o.stat_type === statFilter);
    if (gameFilter !== 'all') result = result.filter(o => o.game_id === Number(gameFilter));
    if (minScore > 0) result = result.filter(o => (o.score ?? 0) >= minScore);

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'score': cmp = (a.score ?? 0) - (b.score ?? 0); break;
        case 'gap_pct': cmp = a.gap_pct - b.gap_pct; break;
        case 'gap_vs_line_pct': cmp = (a.gap_vs_line_pct ?? -999) - (b.gap_vs_line_pct ?? -999); break;
        case 'rating_stars': cmp = a.rating_stars - b.rating_stars; break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [opportunities, statFilter, gameFilter, minScore, sortField, sortDir]);

  // Group by game for "Por Jogo" view
  const groupedByGame = useMemo(() => {
    const map = new Map<number, { label: string; time: string | null; is_b2b_home: boolean; is_b2b_visitor: boolean; opps: DailyOpportunity[] }>();
    filtered.forEach(o => {
      if (!map.has(o.game_id)) {
        map.set(o.game_id, {
          label: `${o.home_team_abbr} vs ${o.visitor_team_abbr}`,
          time: o.game_time,
          is_b2b_home: false,
          is_b2b_visitor: false,
          opps: [],
        });
      }
      const group = map.get(o.game_id)!;
      group.opps.push(o);
      if (o.is_b2b && o.is_home) group.is_b2b_home = true;
      if (o.is_b2b && !o.is_home) group.is_b2b_visitor = true;
    });
    return Array.from(map.entries()).sort((a, b) => {
      const maxA = Math.max(...a[1].opps.map(o => o.score ?? 0));
      const maxB = Math.max(...b[1].opps.map(o => o.score ?? 0));
      return maxB - maxA;
    });
  }, [filtered]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };


  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-terminal-green" />
      : <ChevronUp className="w-3 h-3 text-terminal-green" />;
  };

  // Summary
  const totalOpps = filtered.length;
  const highConfidence = filtered.filter(o => (o.score ?? 0) >= 80).length;
  const gamesCount = new Set(filtered.map(o => o.game_id)).size;

  // Map each opportunity to its global index (for consistent free/blur across views)
  const globalIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((opp, idx) => {
      const key = `${opp.trigger_player_id}-${opp.backup_player_id}-${opp.stat_type}`;
      map.set(key, idx);
    });
    return map;
  }, [filtered]);

  const getGlobalIndex = (opp: DailyOpportunity) => {
    const key = `${opp.trigger_player_id}-${opp.backup_player_id}-${opp.stat_type}`;
    return globalIndexMap.get(key) ?? 999;
  };

  const InfoTip = ({ text }: { text: string }) => (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-terminal-gray border border-terminal-border-subtle text-[9px] font-bold text-terminal-text opacity-60 hover:opacity-100 hover:bg-terminal-green/20 hover:border-terminal-green hover:text-terminal-green cursor-help transition-all ml-1 shrink-0" title={text}>i</span>
  );

  // Render a table row — column order: SCORE, JOGO, GATILHO, JOGADOR, STAT, COM, SEM, GAP%, LINHA, vs LINHA, AÇÃO
  const renderRow = (opp: DailyOpportunity, idx: number, showGame: boolean) => {
    const statusBadge = getTriggerStatusBadge(opp.trigger_status);
    const triggerLastName = opp.trigger_name.split(' ').pop();
    const isHighConf = (opp.score ?? 0) >= 80;
    const rowBlur = getBlur(idx);
    const rowFree = isRowFree(idx);

    return (
      <tr key={`${opp.trigger_player_id}-${opp.backup_player_id}-${opp.stat_type}-${idx}`}
        className={`border-b border-terminal-border-subtle hover:bg-terminal-light-gray/50 transition-colors ${isHighConf ? 'border-l-2 border-l-terminal-green bg-white/[0.02]' : ''}`}>
        {/* SCORE */}
        <td className="text-center py-2 px-3">
          <span className={rowBlur}>
          {isHighConf ? (
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terminal-green/15 border border-terminal-green/40 text-base font-black tabular-nums text-terminal-green">
              {opp.score}
            </span>
          ) : (
            <span className={`text-sm font-bold tabular-nums ${getScoreColor(opp.score)}`}>
              {opp.score ?? '—'}
            </span>
          )}
          </span>
        </td>
        {/* JOGO */}
        {showGame && (
          <td className="py-2 px-3">
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{opp.trigger_team_abbr}</span>
              <span className="opacity-30">vs</span>
              <span className="opacity-60">{opp.opponent_abbr}</span>
              {opp.is_b2b && <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded">B2B</span>}
            </div>
            {opp.game_time && (
              <div className="text-[9px] opacity-40 mt-0.5">
                {opp.game_time}h
              </div>
            )}
          </td>
        )}
        {/* GATILHO */}
        <td className="py-2 px-3">
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>{statusBadge.text}</span>
            <span className={`font-medium ${getTriggerStatusColor(opp.trigger_status)}`}>{triggerLastName}</span>
            {opp.trigger_days_out != null && <span className="text-[9px] opacity-40">{opp.trigger_days_out}d</span>}
          </div>
        </td>
        {/* JOGADOR */}
        <td className="py-2 px-3">
          <div className="flex items-center gap-2">
            <PlayerPhoto name={opp.backup_player_name} teamAbbr={opp.trigger_team_abbr} />
            <span className="font-bold text-terminal-text">{opp.backup_player_name}</span>
          </div>
        </td>
        {/* STAT */}
        <td className={`py-2 px-3 ${rowBlur}`}>
          <span className="text-[10px] bg-terminal-gray border border-terminal-border-subtle px-1.5 py-0.5 rounded cursor-help"
            title={{
              player_points_rebounds_assists: 'Pontos + Rebotes + Assistências',
              player_points_assists: 'Pontos + Assistências',
              player_points_rebounds: 'Pontos + Rebotes',
              player_rebounds_assists: 'Rebotes + Assistências',
              player_blocks_steals: 'Bloqueios + Roubos',
            }[opp.stat_type] || undefined}>
            {STAT_LABELS[opp.stat_type] || opp.stat_type}
          </span>
        </td>
        {/* COM */}
        <td className={`text-right py-2 px-3 opacity-50 tabular-nums ${rowBlur}`}>{opp.avg_com?.toFixed(1) ?? '—'}</td>
        {/* SEM */}
        <td className={`text-right py-2 px-3 font-bold text-terminal-text tabular-nums ${rowBlur}`}>{opp.avg_sem?.toFixed(1) ?? '—'}</td>
        {/* GAP% */}
        <td className={`text-right py-2 px-3 ${rowBlur}`}>
          <span className={`font-bold tabular-nums ${(opp.gap_pct ?? 0) >= 30 ? 'text-orange-400' : (opp.gap_pct ?? 0) >= 15 ? 'text-terminal-green' : 'text-terminal-blue'}`}>
            +{opp.gap_pct?.toFixed(1) ?? '—'}%
          </span>
        </td>
        {/* LINHA */}
        <td className={`text-right py-2 px-3 tabular-nums ${rowBlur}`}>
          {opp.line_value ? <span className="font-medium">{opp.line_value?.toFixed(1) ?? '—'}</span> : <span className="opacity-30">—</span>}
        </td>
        {/* vs LINHA */}
        <td className={`text-right py-2 px-3 tabular-nums ${rowBlur}`}>
          {opp.gap_vs_line_pct != null ? (
            <span className={`font-bold ${opp.gap_vs_line_pct > 10 ? 'text-terminal-green' : opp.gap_vs_line_pct > 0 ? 'text-terminal-blue' : 'text-terminal-red'}`}>
              {opp.gap_vs_line_pct > 0 ? '+' : ''}{opp.gap_vs_line_pct?.toFixed(1) ?? '—'}%
            </span>
          ) : <span className="opacity-30">—</span>}
        </td>
        {/* AÇÃO */}
        <td className="text-center py-2 px-3">
          {(() => {
            const slug = opp.backup_player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
            const params = new URLSearchParams({ stat: opp.stat_type, trigger: opp.trigger_name });
            const dashboardHref = `/nba-dashboard/${slug}?${params.toString()}`;
            const canAccess = rowFree; // top 2 can access dashboard, rest goes to paywall
            const href = canAccess ? dashboardHref : '/paywall-platform';
            return (
              <a href={href}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(canAccess ? dashboardHref : '/paywall-platform');
                }}
                title={canAccess ? `Ver ${opp.backup_player_name} — ${STAT_LABELS[opp.stat_type] || opp.stat_type} sem ${opp.trigger_name}` : 'Recurso exclusivo Premium'}
                className="inline-flex items-center gap-1 px-2 py-1 text-[9px] rounded border border-terminal-blue/30 text-terminal-blue hover:bg-terminal-blue/10 hover:border-terminal-blue/60 transition-all">
                <ExternalLink className="w-3 h-3" /> {canAccess ? 'Analisar' : 'Premium'}
              </a>
            );
          })()}
        </td>
      </tr>
    );
  };

  const tableHeaders = (showGame: boolean) => (
    <thead>
      <tr className="border-b border-terminal-border-subtle bg-terminal-dark-gray/50">
        <th className="text-center py-2.5 px-3 data-label whitespace-nowrap">
          <div className="flex items-center justify-center gap-0.5">
            <button onClick={() => handleSort('score')} className="flex items-center gap-1 hover:text-terminal-green">
              SCORE <SortIcon field="score" />
            </button>
            <InfoTip text="Score de 0-100 baseado em gap vs linha, amostra de jogos, dias fora do gatilho, matchup defensivo, ambiente de jogo e consistência" />
          </div>
        </th>
        {showGame && <th className="text-left py-2.5 px-3 data-label">JOGO</th>}
        <th className="text-left py-2.5 px-3 data-label whitespace-nowrap">
          <div className="flex items-center gap-0.5">
            GATILHO
            <InfoTip text="Jogador lesionado ou ausente que gera a oportunidade. OUT = confirmado fora. Q = Questionable (~50%). DTD = Doubtful (~75% fora)." />
          </div>
        </th>
        <th className="text-left py-2.5 px-3 data-label">JOGADOR</th>
        <th className="text-left py-2.5 px-3 data-label">STAT</th>
        <th className="text-right py-2.5 px-3 data-label whitespace-nowrap">
          <div className="flex items-center justify-end gap-0.5">
            COM
            <InfoTip text="Média do jogador nos jogos em que o gatilho estava em quadra" />
          </div>
        </th>
        <th className="text-right py-2.5 px-3 data-label whitespace-nowrap">
          <div className="flex items-center justify-end gap-0.5">
            SEM
            <InfoTip text="Média do jogador nos jogos em que o gatilho NÃO jogou — este é o cenário esperado para o jogo de hoje" />
          </div>
        </th>
        <th className="text-right py-2.5 px-3 data-label whitespace-nowrap">
          <div className="flex items-center justify-end gap-0.5">
            <button onClick={() => handleSort('gap_pct')} className="flex items-center gap-1 hover:text-terminal-green">
              GAP% <SortIcon field="gap_pct" />
            </button>
            <InfoTip text="Percentual de aumento: quanto o jogador performa a mais SEM o gatilho comparado a COM" />
          </div>
        </th>
        <th className="text-right py-2.5 px-3 data-label">LINHA</th>
        <th className="text-right py-2.5 px-3 data-label whitespace-nowrap">
          <button onClick={() => handleSort('gap_vs_line_pct')} className="flex items-center gap-1 ml-auto hover:text-terminal-green">
            vs LINHA <SortIcon field="gap_vs_line_pct" />
          </button>
        </th>
        <th className="text-center py-2.5 px-3 data-label"></th>
      </tr>
    </thead>
  );

  if (error) {
    return (
      <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
        <AnalyticsNav showBack />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-terminal-red mx-auto mb-4" />
            <p className="text-terminal-red text-sm mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="terminal-button px-4 py-2 rounded text-xs">
              TENTAR NOVAMENTE
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <AnalyticsNav showBack />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-terminal-blue/20 border border-terminal-blue rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-terminal-blue" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-wider text-terminal-blue">
                OPORTUNIDADES DO DIA
              </h1>
              <p className="text-[10px] md:text-xs text-terminal-text opacity-50">
                Quem se beneficia quando um titular não joga — ranqueado por score de confiança
              </p>
            </div>
          </div>

          {!isLoading && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-[10px] bg-terminal-gray border border-terminal-border-subtle px-2 py-1 rounded">
                {gamesCount} jogos • {totalOpps} oportunidades
              </span>
              {highConfidence > 0 && (
                <button
                  onClick={() => setMinScore(prev => prev === 80 ? 0 : 80)}
                  className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 transition-all ${
                    minScore === 80
                      ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green'
                      : 'bg-terminal-green/10 text-terminal-green border border-terminal-green/30 hover:border-terminal-green/60'
                  }`}>
                  <Shield className="w-3 h-3" /> {highConfidence} alta confiança
                </button>
              )}
            </div>
          )}
        </div>

        {/* Premium upsell banner */}
        {!isPremium && !isLoading && (
          <div className="bg-terminal-yellow/10 border border-terminal-yellow/30 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
            <p className="text-xs text-terminal-yellow">
              Dados de score, médias e gaps são exclusivos para assinantes Premium.
            </p>
            <a href="/paywall-platform" className="text-xs font-bold text-terminal-yellow hover:text-white transition-colors shrink-0 ml-4">
              ASSINAR →
            </a>
          </div>
        )}

        {/* Filters bar */}
        <div className="terminal-container p-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 opacity-40 shrink-0 hidden md:block" />
            <select value={statFilter} onChange={e => setStatFilter(e.target.value)}
              className="bg-terminal-dark-gray border border-terminal-border-subtle rounded px-2 py-1.5 text-xs focus:outline-none focus:border-terminal-green/50 min-w-0 flex-1 md:flex-none">
              <option value="all">Todas stats</option>
              <option value="player_points">Pontos</option>
              <option value="player_rebounds">Rebotes</option>
              <option value="player_assists">Assistências</option>
              <option value="player_points_rebounds_assists">PRA</option>
              {availableStats.filter(st => !['player_points', 'player_rebounds', 'player_assists', 'player_points_rebounds_assists'].includes(st)).map(st => (
                <option key={st} value={st}>{STAT_LABELS[st] || st}</option>
              ))}
            </select>
            <select value={gameFilter} onChange={e => setGameFilter(e.target.value)}
              className="bg-terminal-dark-gray border border-terminal-border-subtle rounded px-2 py-1.5 text-xs focus:outline-none focus:border-terminal-green/50 min-w-0 flex-1 md:flex-none">
              <option value="all">Todos jogos</option>
              {uniqueGames.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            <select value={minScore} onChange={e => setMinScore(Number(e.target.value))}
              className="bg-terminal-dark-gray border border-terminal-border-subtle rounded px-2 py-1.5 text-xs focus:outline-none focus:border-terminal-green/50 min-w-0 flex-1 md:flex-none">
              <option value={0}>Score: 0+</option>
              <option value={70}>Score: 70+</option>
              <option value={80}>Score: 80+</option>
            </select>

            {/* View mode toggle — same line on desktop, new line on mobile */}
            <div className="hidden md:flex gap-1 ml-auto">
              <button onClick={() => setViewMode('score')}
                className={`px-2 py-1 text-[10px] rounded border transition-all ${viewMode === 'score' ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue' : 'border-terminal-border-subtle text-terminal-text opacity-50 hover:opacity-80'}`}>
                Por Score
              </button>
              <button onClick={() => setViewMode('game')}
                className={`px-2 py-1 text-[10px] rounded border transition-all flex items-center gap-1 ${viewMode === 'game' ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue' : 'border-terminal-border-subtle text-terminal-text opacity-50 hover:opacity-80'}`}>
                <LayoutList className="w-3 h-3" /> Por Jogo
              </button>
            </div>
          </div>
          {/* Mobile: view mode toggle on separate line */}
          <div className="flex gap-1 mt-2 md:hidden">
            <button onClick={() => setViewMode('score')}
              className={`flex-1 py-1.5 text-[10px] rounded border transition-all text-center ${viewMode === 'score' ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue' : 'border-terminal-border-subtle text-terminal-text opacity-50'}`}>
              Por Score
            </button>
            <button onClick={() => setViewMode('game')}
              className={`flex-1 py-1.5 text-[10px] rounded border transition-all text-center flex items-center justify-center gap-1 ${viewMode === 'game' ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue' : 'border-terminal-border-subtle text-terminal-text opacity-50'}`}>
              <LayoutList className="w-3 h-3" /> Por Jogo
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="terminal-container p-4">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-5 h-5 text-terminal-green animate-spin" />
              <span className="text-xs opacity-60">Carregando oportunidades...</span>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-terminal-gray" />)}
            </div>
          </div>
        )}

        {/* Desktop — Por Score (flat table) */}
        {!isLoading && filtered.length > 0 && viewMode === 'score' && (
          <div className="hidden md:block terminal-container overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                {tableHeaders(true)}
                <tbody>
                  {filtered.map((opp, idx) => renderRow(opp, idx, true))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Desktop — Por Jogo (grouped) */}
        {!isLoading && filtered.length > 0 && viewMode === 'game' && (
          <div className="hidden md:block space-y-4">
            {groupedByGame.map(([gameId, group]) => (
              <div key={gameId} className="terminal-container overflow-hidden">
                <button onClick={() => toggleGameCollapse(gameId)}
                  className="w-full bg-terminal-gray px-3 py-2 border-b border-terminal-border-subtle flex items-center gap-3 hover:bg-terminal-gray/80 transition-colors text-left">
                  <div className="flex items-center gap-2">
                    <img src={getTeamLogoUrl(group.label.split(' vs ')[0])} alt="" className="w-5 h-5 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="text-xs font-bold">{group.label}</span>
                  </div>
                  {group.time && <span className="text-[10px] opacity-40">{group.time}</span>}
                  {(group.is_b2b_home || group.is_b2b_visitor) && (
                    <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1.5 py-0.5 rounded">B2B</span>
                  )}
                  <span className="text-[10px] opacity-40 ml-auto">{group.opps.length} oportunidades</span>
                  <ChevronDown className={`w-4 h-4 opacity-40 shrink-0 transition-transform ${collapsedGames.has(gameId) ? '-rotate-90' : ''}`} />
                </button>
                {!collapsedGames.has(gameId) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      {tableHeaders(false)}
                      <tbody>
                        {group.opps.map((opp) => renderRow(opp, getGlobalIndex(opp), false))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Mobile — Por Jogo (grouped) */}
        {!isLoading && filtered.length > 0 && viewMode === 'game' && (
          <div className="md:hidden space-y-4">
            {groupedByGame.map(([gameId, group]) => (
              <div key={gameId}>
                <button onClick={() => toggleGameCollapse(gameId)}
                  className="flex items-center gap-2 px-1 mb-2 w-full text-left">
                  <img src={getTeamLogoUrl(group.label.split(' vs ')[0])} alt="" className="w-4 h-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="text-xs font-bold">{group.label}</span>
                  {group.time && <span className="text-[10px] opacity-40">{group.time}</span>}
                  {(group.is_b2b_home || group.is_b2b_visitor) && (
                    <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 py-0.5 rounded">B2B</span>
                  )}
                  <span className="text-[10px] opacity-30 ml-auto">{group.opps.length}</span>
                  <ChevronDown className={`w-4 h-4 opacity-40 shrink-0 transition-transform ${collapsedGames.has(gameId) ? '-rotate-90' : ''}`} />
                </button>
                {!collapsedGames.has(gameId) && <div className="space-y-2">
                  {group.opps.map((opp) => {
                    const gIdx = getGlobalIndex(opp);
                    const statusBadge = getTriggerStatusBadge(opp.trigger_status);
                    const triggerLastName = opp.trigger_name.split(' ').pop();
                    const isHighConf = (opp.score ?? 0) >= 80;
                    const statLabel = STAT_LABELS[opp.stat_type] || opp.stat_type;
                    const slug = opp.backup_player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
                    const analyzeHref = `/nba-dashboard/${slug}?stat=${opp.stat_type}&trigger=${encodeURIComponent(opp.trigger_name)}`;
                    const groupBlur = getBlur(gIdx);
                    const groupCanAccess = isRowFree(gIdx);

                    return (
                      <a key={`${opp.trigger_player_id}-${opp.backup_player_id}-${opp.stat_type}`}
                        href={groupCanAccess ? analyzeHref : '/paywall-platform'}
                        onClick={(e) => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); navigate(groupCanAccess ? analyzeHref : '/paywall-platform'); } }}
                        className={`block terminal-container p-3 ${isHighConf ? 'border-terminal-green/30' : ''}`}>
                        <div className="flex items-center gap-3">
                          <PlayerPhoto name={opp.backup_player_name} teamAbbr={opp.trigger_team_abbr} />
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-terminal-text text-sm truncate block">{opp.backup_player_name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>SEM {triggerLastName} ({statusBadge.text})</span>
                              <span className={`text-xs font-bold bg-terminal-blue/10 text-terminal-blue border border-terminal-blue/30 px-1.5 py-0.5 rounded ${groupBlur}`}>{statLabel}</span>
                            </div>
                          </div>
                          <span className={groupBlur}>
                          {isHighConf ? (
                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terminal-green/15 border border-terminal-green/40 text-base font-black tabular-nums text-terminal-green shrink-0">{opp.score}</span>
                          ) : (
                            <span className={`text-lg font-bold tabular-nums shrink-0 ${getScoreColor(opp.score)}`}>{opp.score ?? '—'}</span>
                          )}
                          </span>
                        </div>
                        <div className={`mt-2 text-[11px] text-terminal-text opacity-80 ${groupBlur}`}>
                          Com {triggerLastName}: <span className="opacity-60">{opp.avg_com?.toFixed(1) ?? '—'}</span>
                          <span className="mx-1.5 opacity-30">→</span>
                          Sem: <span className="font-bold text-terminal-green">{opp.avg_sem?.toFixed(1) ?? '—'}</span>
                          <span className={`ml-1.5 font-bold ${(opp.gap_pct ?? 0) >= 30 ? 'text-orange-400' : 'text-terminal-green'}`}>(+{opp.gap_pct?.toFixed(1) ?? '—'}%)</span>
                        </div>
                      </a>
                    );
                  })}
                </div>}
              </div>
            ))}
          </div>
        )}

        {/* Mobile — Por Score (flat cards) */}
        {!isLoading && filtered.length > 0 && viewMode === 'score' && (
          <div className="md:hidden space-y-2">
            {filtered.map((opp, idx) => {
              const statusBadge = getTriggerStatusBadge(opp.trigger_status);
              const triggerLastName = opp.trigger_name.split(' ').pop();
              const isExpanded = expandedRow === idx;
              const isHighConf = (opp.score ?? 0) >= 80;
              const statLabel = STAT_LABELS[opp.stat_type] || opp.stat_type;
              const slug = opp.backup_player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
              const analyzeHref = `/nba-dashboard/${slug}?stat=${opp.stat_type}&trigger=${encodeURIComponent(opp.trigger_name)}`;
              const mobileBlur = getBlur(idx);
              const mobileCanAccess = isRowFree(idx);

              return (
                <div key={idx} className={`terminal-container overflow-hidden ${isHighConf ? 'border-terminal-green/30' : ''}`}>
                  <button className="w-full p-3 text-left" onClick={() => setExpandedRow(isExpanded ? null : idx)}>
                    {/* Row 1: Player + Score */}
                    <div className="flex items-center gap-3">
                      <PlayerPhoto name={opp.backup_player_name} teamAbbr={opp.trigger_team_abbr} />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-terminal-text text-sm truncate block">{opp.backup_player_name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] opacity-50">{opp.trigger_team_abbr} vs {opp.opponent_abbr}</span>
                          {opp.is_b2b && <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded">B2B</span>}
                        </div>
                      </div>
                      <span className={mobileBlur}>
                      {isHighConf ? (
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-terminal-green/15 border border-terminal-green/40 text-lg font-black tabular-nums text-terminal-green shrink-0">
                          {opp.score}
                        </span>
                      ) : (
                        <span className={`text-lg font-bold tabular-nums shrink-0 ${getScoreColor(opp.score)}`}>{opp.score ?? '—'}</span>
                      )}
                      </span>
                      <ChevronDown className={`w-4 h-4 opacity-30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Row 2: Trigger (always visible) + Stat (blurred for non-free) */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>
                        SEM {triggerLastName} ({statusBadge.text})
                      </span>
                      <span className={`text-xs font-bold bg-terminal-blue/10 text-terminal-blue border border-terminal-blue/30 px-2 py-0.5 rounded ${mobileBlur}`}>
                        {statLabel}
                      </span>
                    </div>

                    {/* Row 3: Storytelling — readable numbers */}
                    <div className={`mt-2 text-[11px] text-terminal-text opacity-80 ${mobileBlur}`}>
                      <span>Com {triggerLastName}: </span>
                      <span className="opacity-60">{opp.avg_com?.toFixed(1) ?? '—'}</span>
                      <span className="mx-1.5 opacity-30">→</span>
                      <span>Sem: </span>
                      <span className="font-bold text-terminal-text">{opp.avg_sem?.toFixed(1) ?? '—'}</span>
                      <span className={`ml-1.5 font-bold ${(opp.gap_pct ?? 0) >= 30 ? 'text-orange-400' : 'text-terminal-green'}`}>
                        (+{opp.gap_pct?.toFixed(1) ?? '—'}%)
                      </span>
                    </div>
                    {opp.line_value && (
                      <div className={`mt-1 text-[11px] opacity-60 ${mobileBlur}`}>
                        Linha atual: <span className="font-medium text-terminal-text">{opp.line_value?.toFixed(1) ?? '—'}</span>
                        {opp.gap_vs_line_pct != null && (
                          <span className={`ml-1.5 font-bold ${opp.gap_vs_line_pct > 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                            ({opp.gap_vs_line_pct > 0 ? '+' : ''}{opp.gap_vs_line_pct?.toFixed(1) ?? '—'}% vs linha)
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-terminal-border-subtle pt-2 space-y-2">
                      {opp.gap_vs_line_pct != null && opp.line_value && (
                        <div className={`text-[11px] text-center py-1.5 rounded border ${
                          opp.gap_vs_line_pct > 0
                            ? 'bg-terminal-green/10 text-terminal-green border-terminal-green/30'
                            : 'bg-terminal-red/10 text-terminal-red border-terminal-red/30'
                        }`}>
                          Média SEM ({opp.avg_sem?.toFixed(1) ?? '—'}) {opp.gap_vs_line_pct > 0 ? '>' : '<'} Linha ({opp.line_value?.toFixed(1) ?? '—'}) — {opp.gap_vs_line_pct > 0 ? 'OVER favorável' : 'UNDER favorável'}
                        </div>
                      )}

                      <a href={mobileCanAccess ? analyzeHref : '/paywall-platform'}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(mobileCanAccess ? analyzeHref : '/paywall-platform'); }}
                        className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-bold text-terminal-blue border border-terminal-blue/30 rounded hover:bg-terminal-blue/10 transition-all">
                        <ExternalLink className="w-3.5 h-3.5" /> {mobileCanAccess ? 'VER ANÁLISE COMPLETA' : 'ASSINAR PREMIUM'}
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="terminal-container p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-terminal-yellow mx-auto mb-3 opacity-50" />
            <p className="text-sm opacity-60 mb-1">Nenhuma oportunidade encontrada</p>
            <p className="text-[10px] opacity-40">
              {opportunities.length > 0 ? 'Tente ajustar os filtros' : 'Não há jogos com injury report disponível para hoje'}
            </p>
          </div>
        )}

        {/* Footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="mt-3 text-center text-[9px] opacity-30">
            Metodologia: análise 360° COM vs SEM • Score automático (gap + amostra + freshness + matchup)
          </div>
        )}
      </div>
    </div>
  );
}
