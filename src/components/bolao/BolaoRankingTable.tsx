import React from 'react';
import { Trophy, Target, Crosshair, Medal, Award, Share2 } from 'lucide-react';
import type { BolaoRankingEntry } from '@/services/bolao.service';

interface BolaoRankingTableProps {
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  /** Optional: when set, empty state shows a "Convidar amigos" CTA */
  onInviteFriends?: () => void;
}

/**
 * Renders rank badge: top-3 get a medal/trophy icon, others show ordinal.
 * Colors are tier-specific (gold/silver/bronze) to keep podium hierarchy.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="w-5 h-5 text-yellow-400" aria-label="1º lugar" />;
  }
  if (rank === 2) {
    return <Medal className="w-5 h-5 text-slate-300" aria-label="2º lugar" />;
  }
  if (rank === 3) {
    return <Award className="w-5 h-5 text-orange-400" aria-label="3º lugar" />;
  }
  return <span className="text-sm font-bold opacity-60">{rank}º</span>;
}

export const BolaoRankingTable: React.FC<BolaoRankingTableProps> = ({
  ranking,
  currentUserId,
  onInviteFriends,
}) => {
  if (ranking.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-terminal-blue/10 border border-terminal-blue/30 flex items-center justify-center">
          <Trophy className="w-7 h-7 text-terminal-blue/70" />
        </div>
        <p className="text-sm sm:text-base font-bold">Sem competição ainda</p>
        <p className="text-xs sm:text-sm opacity-60 mt-1 mb-4">
          Convide amigos pra começar a disputa
        </p>
        {onInviteFriends && (
          <button
            type="button"
            onClick={onInviteFriends}
            className="inline-flex items-center gap-1.5 h-11 px-5 rounded-lg border border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue hover:bg-terminal-blue/20 active:bg-terminal-blue/30 font-bold text-sm transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Convidar amigos
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-[40px_1fr_60px_50px_50px] md:grid-cols-[50px_1fr_80px_70px_70px] gap-2 px-3 py-2 text-[10px] uppercase opacity-50 font-bold">
        <div>#</div>
        <div>Jogador</div>
        <div className="text-center">Pts</div>
        <div className="text-center hidden md:block">
          <Crosshair className="w-3 h-3 mx-auto" title="Placares exatos" />
        </div>
        <div className="text-center hidden md:block">
          <Target className="w-3 h-3 mx-auto" title="Resultados corretos" />
        </div>
      </div>

      {/* Rows */}
      {ranking.map((entry) => {
        const isCurrentUser = entry.user_id === currentUserId;
        return (
          <div
            key={entry.user_id}
            className={`grid grid-cols-[40px_1fr_60px_50px_50px] md:grid-cols-[50px_1fr_80px_70px_70px] gap-2 px-3 py-3 rounded transition-colors ${
              isCurrentUser
                ? 'bg-terminal-green/10 border border-terminal-green/30'
                : 'bg-terminal-dark-gray/30 border border-terminal-border-subtle hover:bg-terminal-dark-gray/50'
            }`}
          >
            <div className="flex items-center">
              <RankBadge rank={Number(entry.rank)} />
            </div>
            <div className="flex items-center">
              <span className={`text-sm font-medium truncate ${isCurrentUser ? 'text-terminal-green' : ''}`}>
                {entry.user_name}
                {isCurrentUser && <span className="text-[10px] opacity-50 ml-1">(você)</span>}
              </span>
            </div>
            <div className="flex items-center justify-center">
              <span className="text-sm font-bold text-terminal-green">{entry.total_points}</span>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <span className="text-xs opacity-70">{entry.exact_scores}</span>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <span className="text-xs opacity-70">{entry.correct_results}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
