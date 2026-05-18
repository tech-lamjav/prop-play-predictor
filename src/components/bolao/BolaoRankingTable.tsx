import React from 'react';
import { Trophy, Target, Crosshair, Medal, Award, Share2, ChevronRight } from 'lucide-react';
import type { BolaoRankingEntry } from '@/services/bolao.service';

interface BolaoRankingTableProps {
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  /** Optional: when set, empty state shows a "Convidar amigos" CTA */
  onInviteFriends?: () => void;
  /** Optional: when set, cada linha vira clicável e dispara este callback com o entry */
  onSelectUser?: (entry: BolaoRankingEntry) => void;
}

/**
 * Renders rank badge: top-3 get a medal/trophy icon, others show ordinal.
 * Colors are tier-specific (gold/silver/bronze) to keep podium hierarchy.
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="w-5 h-5 text-amber" aria-label="1º lugar" />;
  }
  if (rank === 2) {
    return <Medal className="w-5 h-5 text-ink-3" aria-label="2º lugar" />;
  }
  if (rank === 3) {
    return <Award className="w-5 h-5 text-status-warning" aria-label="3º lugar" />;
  }
  return <span className="text-[13px] font-bold text-ink-2 tabular-nums">{rank}º</span>;
}

export const BolaoRankingTable: React.FC<BolaoRankingTableProps> = ({
  ranking,
  currentUserId,
  onInviteFriends,
  onSelectUser,
}) => {
  if (ranking.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-white border border-line rounded-rebrand-xl">
        <div className="w-14 h-14 mx-auto mb-3 rounded-rebrand-md bg-canvas-2 border border-forest/20 flex items-center justify-center">
          <Trophy className="w-7 h-7 text-forest" />
        </div>
        <p className="text-[16px] font-bold text-ink">Sem competição ainda</p>
        <p className="text-[13px] text-ink-2 mt-1 mb-4">
          Convide amigos pra começar a disputa
        </p>
        {onInviteFriends && (
          <button
            type="button"
            onClick={onInviteFriends}
            className="inline-flex items-center gap-1.5 h-11 px-5 rounded-rebrand-md bg-forest text-white hover:bg-forest-2 font-semibold text-[13px] transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Convidar amigos
          </button>
        )}
      </div>
    );
  }

  const clickable = !!onSelectUser;
  // Layout responsivo:
  // - Mobile: # | Jogador | Pts | [CTA] (sem exatos/resultados)
  // - Desktop: # | Jogador | Pts | Exatos | Resultados | [CTA]
  const colsMobile = clickable
    ? 'grid-cols-[36px_1fr_56px_72px]'
    : 'grid-cols-[36px_1fr_56px]';
  const colsDesktop = clickable
    ? 'md:grid-cols-[50px_1fr_70px_60px_60px_88px]'
    : 'md:grid-cols-[50px_1fr_80px_70px_70px]';
  const cols = `${colsMobile} ${colsDesktop}`;

  return (
    <div className="space-y-2">
      {/* Hint de descoberta — aparece só quando rows são clicáveis */}
      {clickable && (
        <p className="text-[11px] text-ink-3 px-1">
          Clique num jogador pra ver os palpites dele.
        </p>
      )}

      <div className="bg-white border border-line rounded-rebrand-xl overflow-hidden">
        {/* Header */}
        <div className={`grid ${cols} gap-2 px-3 sm:px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-ink-2 font-bold border-b border-line bg-canvas`}>
          <div>#</div>
          <div>Jogador</div>
          <div className="text-center">Pts</div>
          <div className="text-center hidden md:block">
            <Crosshair className="w-3 h-3 mx-auto" aria-label="Placares exatos" />
          </div>
          <div className="text-center hidden md:block">
            <Target className="w-3 h-3 mx-auto" aria-label="Resultados corretos" />
          </div>
          {clickable && <div />}
        </div>

        {/* Rows */}
        <div className="divide-y divide-line">
          {ranking.map((entry) => {
            const isCurrentUser = entry.user_id === currentUserId;
            const baseClasses = `grid ${cols} gap-2 px-3 sm:px-4 py-3 items-center transition-colors text-left w-full ${
              isCurrentUser ? 'bg-forest/[0.05]' : ''
            } ${clickable ? 'group hover:bg-canvas-2 cursor-pointer focus-visible:bg-canvas-2 focus-visible:outline-none' : ''}`;
            const content = (
              <>
                <div className="flex items-center">
                  <RankBadge rank={Number(entry.rank)} />
                </div>
                <div className="flex items-center min-w-0">
                  <span className={`text-[13px] font-medium truncate ${isCurrentUser ? 'text-forest font-semibold' : 'text-ink'}`}>
                    {entry.user_name}
                    {isCurrentUser && (
                      <span className="text-[11px] text-ink-2 font-normal ml-1">(você)</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <span className="text-[14px] font-bold text-ink tabular-nums">
                    {entry.total_points}
                  </span>
                </div>
                <div className="hidden md:flex items-center justify-center">
                  <span className="text-[12px] text-ink-2 tabular-nums">
                    {entry.exact_scores}
                  </span>
                </div>
                <div className="hidden md:flex items-center justify-center">
                  <span className="text-[12px] text-ink-2 tabular-nums">
                    {entry.correct_results}
                  </span>
                </div>
                {clickable && (
                  <div className="flex items-center justify-end">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-rebrand-sm border border-forest/30 bg-forest/[0.06] text-forest text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.08em] whitespace-nowrap group-hover:border-forest group-hover:bg-forest group-hover:text-white transition-colors"
                      aria-hidden="true"
                    >
                      Ver
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                )}
              </>
            );

            return clickable ? (
              <button
                type="button"
                key={entry.user_id}
                onClick={() => onSelectUser!(entry)}
                aria-label={`Ver palpites de ${entry.user_name}`}
                className={baseClasses}
              >
                {content}
              </button>
            ) : (
              <div key={entry.user_id} className={baseClasses}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
