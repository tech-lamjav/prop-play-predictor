import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { nbaDataService, DailyOpportunity } from '@/services/nba-data.service';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

const STAT_LABELS: Record<string, string> = {
  player_points: 'PONTOS',
  player_assists: 'ASSISTÊNCIAS',
  player_rebounds: 'REBOTES',
  player_threes: '3 PONTOS',
  player_steals: 'ROUBOS',
  player_blocks: 'BLOQUEIOS',
  player_points_rebounds_assists: 'PRA',
  player_points_assists: 'PTS + AST',
  player_points_rebounds: 'PTS + REB',
  player_rebounds_assists: 'REB + AST',
  player_blocks_steals: 'BLK + STL',
};

interface FreePropCardProps {
  layout?: 'vertical' | 'horizontal';
}

export function FreePropCard({ layout = 'vertical' }: FreePropCardProps) {
  const navigate = useNavigate();
  const [topOpps, setTopOpps] = useState<DailyOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const opps = await nbaDataService.getDailyOpportunities();
        // Top 2 by score
        setTopOpps(opps.slice(0, 2));
      } catch (error) {
        console.error('Error loading daily opportunities:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const isHorizontal = layout === 'horizontal';

  if (isLoading) {
    return (
      <div className={isHorizontal ? 'terminal-container p-6' : 'terminal-container p-4'}>
        <h3 className="section-title mb-3">OPORTUNIDADE GRÁTIS DO DIA</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-terminal-gray rounded w-3/4"></div>
          <div className="h-4 bg-terminal-gray rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (topOpps.length === 0) return null;

  const renderOppCard = (opp: DailyOpportunity, compact: boolean) => {
    const statLabel = STAT_LABELS[opp.stat_type] || opp.stat_type.replace('player_', '').replace(/_/g, ' ').toUpperCase();
    const triggerLastName = opp.trigger_name.split(' ').pop();
    const statusColor = opp.trigger_status.toLowerCase().includes('out') ? 'bg-terminal-red/20 text-terminal-red border-terminal-red/30'
      : opp.trigger_status.toLowerCase().includes('doubtful') ? 'bg-orange-400/20 text-orange-400 border-orange-400/30'
      : 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30';
    const triggerTextColor = opp.trigger_status.toLowerCase().includes('out') ? 'text-terminal-red'
      : opp.trigger_status.toLowerCase().includes('doubtful') ? 'text-orange-400' : 'text-yellow-400';
    const slug = opp.backup_player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
    const href = `/nba-dashboard/${slug}?stat=${opp.stat_type}&trigger=${encodeURIComponent(opp.trigger_name)}`;
    const initials = opp.backup_player_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const handleClick = () => navigate(href);

    return (
      <div
        key={`${opp.trigger_player_id}-${opp.backup_player_id}-${opp.stat_type}`}
        onClick={handleClick}
        className="bg-terminal-gray rounded border border-terminal-green/30 hover:border-terminal-green transition-colors cursor-pointer p-3"
      >
        {/* Row 1: Photo + Name + Score */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-terminal-dark-gray border border-terminal-border-subtle shrink-0 flex items-center justify-center">
            <img
              src={getPlayerPhotoUrl(opp.backup_player_name, opp.trigger_team_abbr)}
              alt={opp.backup_player_name}
              className="w-full h-full object-cover object-top"
              data-player-photo-index="0"
              onError={(e) => {
                const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, opp.backup_player_name, opp.trigger_team_abbr);
                if (!didTry) {
                  const el = e.target as HTMLImageElement;
                  el.style.display = 'none';
                  const parent = el.parentElement;
                  if (parent) parent.innerHTML = `<span class="text-[9px] font-bold text-terminal-text opacity-60">${initials}</span>`;
                }
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-terminal-text truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {opp.backup_player_name}
            </div>
            <div className={`opacity-50 ${compact ? 'text-[10px]' : 'text-xs'}`}>
              {opp.trigger_team_abbr} vs {opp.opponent_abbr}
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border shrink-0 ${
            (opp.score ?? 0) >= 80 ? 'bg-terminal-green/15 text-terminal-green border-terminal-green/40' : (opp.score ?? 0) >= 70 ? 'bg-terminal-yellow/15 text-terminal-yellow border-terminal-yellow/40' : 'bg-orange-400/15 text-orange-400 border-orange-400/40'
          }`}>
            <span className="text-[9px] opacity-60">Score</span>
            <span className="text-sm font-black tabular-nums">{opp.score}</span>
          </div>
        </div>

        {/* Row 2: Stat + Trigger badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`font-bold bg-terminal-blue/10 text-terminal-blue border border-terminal-blue/30 px-1.5 py-0.5 rounded ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {statLabel}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusColor}`}>
            SEM <span className={`font-medium ${triggerTextColor}`}>{triggerLastName}</span>
          </span>
        </div>

        {/* Row 3: Numbers with labels */}
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-terminal-text`}>
          <span className="opacity-50">Com {triggerLastName}: </span>
          <span className="opacity-60">{opp.avg_com?.toFixed(1)}</span>
          <span className="mx-1 opacity-30">→</span>
          <span className="opacity-50">Sem: </span>
          <span className="font-bold text-terminal-text">{opp.avg_sem?.toFixed(1)}</span>
          <span className="ml-1 font-bold text-terminal-text">(+{opp.gap_pct?.toFixed(1)}%)</span>
        </div>
        {opp.line_value && (
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} opacity-50 mt-0.5`}>
            Linha: {opp.line_value?.toFixed(1)}
          </div>
        )}

        {/* CTA */}
        <div className="mt-3 pt-0">
          <div className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-bold text-terminal-black bg-terminal-green rounded hover:bg-terminal-green/90 transition-all">
            Ver Análise Completa <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  };

  // Horizontal: show both in grid
  if (isHorizontal) {
    return (
      <div className="terminal-container p-6">
        <h3 className="section-title mb-3">OPORTUNIDADE GRÁTIS DO DIA</h3>
        <p className="text-xs text-terminal-text opacity-70 mb-4">Top oportunidades do dia — acesso gratuito</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topOpps.map(opp => renderOppCard(opp, false))}
        </div>
      </div>
    );
  }

  // Vertical (sidebar): paginate
  const current = topOpps[activeIndex];
  const total = topOpps.length;

  return (
    <div className="terminal-container p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">OPORTUNIDADE DO DIA</h3>
        {total > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i - 1 + total) % total); }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-terminal-gray/50 text-terminal-text/50 hover:text-terminal-text transition-colors">
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-[10px] text-terminal-text/40 font-mono tabular-nums">{activeIndex + 1}/{total}</span>
            <button onClick={(e) => { e.stopPropagation(); setActiveIndex((i) => (i + 1) % total); }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-terminal-gray/50 text-terminal-text/50 hover:text-terminal-text transition-colors">
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      {renderOppCard(current, true)}
    </div>
  );
}
