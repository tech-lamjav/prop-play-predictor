import React, { forwardRef } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import type { BolaoRankingEntry, ChampionPrediction } from '@/services/bolao.service';

interface RankingShareImageStoriesProps {
  bolaoName: string;
  inviteCode: string;
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  myChampionPick?: ChampionPrediction | null;
}

/**
 * Variant Stories (1080×1920) do card de ranking.
 *
 * Diferenças do feed (1080×1080):
 *  - Vertical, com pódio em destaque (top 3 maior, top 4-5 menores)
 *  - Logo Smart Betting maior no topo (branding viral primeiro frame visível)
 *  - URL de convite no rodapé com mais respiro
 *  - Feito pra Instagram Stories / WhatsApp Status
 */
export const RankingShareImageStories = forwardRef<HTMLDivElement, RankingShareImageStoriesProps>(
  ({ bolaoName, inviteCode, ranking, currentUserId, myChampionPick }, ref) => {
    const top5 = ranking.slice(0, 5);
    const filledTop5: (BolaoRankingEntry | null)[] = [...top5];
    while (filledTop5.length < 5) filledTop5.push(null);

    const myPosition = currentUserId
      ? ranking.find(r => r.user_id === currentUserId)
      : null;
    const myInTop5 = top5.some(r => r.user_id === currentUserId);

    const renderRankBadge = (rank: number, big: boolean) => {
      const size = big ? 'w-16 h-16' : 'w-12 h-12';
      if (rank === 1) return <Trophy className={`${size} text-yellow-400`} strokeWidth={2.5} />;
      if (rank === 2) return <Medal className={`${size} text-slate-300`} strokeWidth={2.5} />;
      if (rank === 3) return <Award className={`${size} text-orange-400`} strokeWidth={2.5} />;
      return (
        <span
          className={big ? 'text-4xl font-black opacity-60 tabular-nums' : 'text-2xl font-black opacity-60 tabular-nums'}
          style={{ lineHeight: 1.5 }}
        >
          {rank}º
        </span>
      );
    };

    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1920px] flex flex-col p-16 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #050a14 0%, #0f1a2e 50%, #0a1628 100%)',
          fontFamily: '"Inter", "JetBrains Mono", system-ui, sans-serif',
          color: '#e8eef0',
        }}
      >
        {/* ─── Top brand bar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <img
              src="/logo-sem-texto.png"
              alt="Smart Betting"
              className="w-14 h-14 object-contain"
              crossOrigin="anonymous"
            />
            <span
              className="text-xl font-bold uppercase opacity-90"
              style={{ letterSpacing: '0.2em', lineHeight: 1.5 }}
            >
              smartbetting
            </span>
          </div>
          <Trophy className="w-14 h-14 text-yellow-400" strokeWidth={1.5} />
        </div>

        {/* ─── Title ───────────────────────────────────────────────── */}
        <div className="mb-10">
          <p
            className="text-base font-bold uppercase text-terminal-blue mb-3"
            style={{ letterSpacing: '0.4em', lineHeight: 1.6 }}
          >
            Bolão · Copa 2026
          </p>
          <h1
            className="text-6xl font-black"
            style={{
              lineHeight: 1.2,
              paddingBottom: '8px',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              maxHeight: '180px',
              overflow: 'hidden',
            }}
          >
            {bolaoName}
          </h1>
        </div>

        {/* ─── Top 3 — destaque grande (pódio visível) ────────────── */}
        <p
          className="text-sm font-bold uppercase mb-5"
          style={{
            letterSpacing: '0.3em',
            color: 'rgba(232, 238, 240, 0.6)',
            lineHeight: 1.6,
          }}
        >
          Top 5 do ranking
        </p>

        <div className="flex flex-col gap-4 mb-6">
          {/* Top 3 — cards grandes */}
          {filledTop5.slice(0, 3).map((entry, idx) => {
            const rank = idx + 1;
            const isMe = entry?.user_id === currentUserId;
            const isEmpty = !entry;
            return (
              <div
                key={entry?.user_id ?? `empty-${idx}`}
                className={`flex items-center gap-6 px-6 rounded-2xl border-2 ${
                  isMe
                    ? 'border-terminal-green/70 bg-terminal-green/15'
                    : 'border-yellow-500/30 bg-yellow-500/5'
                } ${isEmpty ? 'opacity-30' : ''}`}
                style={{ minHeight: '128px', paddingTop: '22px', paddingBottom: '22px' }}
              >
                <div className="w-20 flex items-center justify-center shrink-0">
                  {renderRankBadge(rank, true)}
                </div>
                <div className="flex-1 min-w-0">
                  {isEmpty ? (
                    <p
                      className="text-3xl font-bold opacity-50 italic"
                      style={{ lineHeight: 1.5, paddingBottom: '4px' }}
                    >
                      Aguardando jogador
                    </p>
                  ) : (
                    <>
                      <p
                        className="text-3xl font-bold"
                        style={{
                          lineHeight: 1.4,
                          paddingBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '600px',
                        }}
                      >
                        {entry.user_name}
                        {isMe && (
                          <span className="ml-3 text-base text-terminal-green/90 font-medium">
                            (você)
                          </span>
                        )}
                      </p>
                      <p
                        className="text-base opacity-50 mt-1"
                        style={{ lineHeight: 1.5 }}
                      >
                        {entry.exact_scores} placares · {entry.correct_results} resultados
                      </p>
                    </>
                  )}
                </div>
                <div className="text-right shrink-0 min-w-[140px]">
                  <p
                    className={`text-6xl font-black tabular-nums ${
                      isEmpty ? 'opacity-30' : 'text-terminal-green'
                    }`}
                    style={{ lineHeight: 1.1, paddingBottom: '4px' }}
                  >
                    {entry?.total_points ?? 0}
                  </p>
                  <p
                    className="text-sm opacity-50 uppercase mt-1"
                    style={{ letterSpacing: '0.1em', lineHeight: 1.5 }}
                  >
                    pts
                  </p>
                </div>
              </div>
            );
          })}

          {/* Top 4-5 — cards menores */}
          {filledTop5.slice(3, 5).map((entry, idx) => {
            const rank = idx + 4;
            const isMe = entry?.user_id === currentUserId;
            const isEmpty = !entry;
            return (
              <div
                key={entry?.user_id ?? `empty-${idx + 3}`}
                className={`flex items-center gap-5 px-5 rounded-xl border ${
                  isMe ? 'border-terminal-green/70 bg-terminal-green/15' : 'border-white/8 bg-white/[0.025]'
                } ${isEmpty ? 'opacity-30' : ''}`}
                style={{ minHeight: '92px', paddingTop: '16px', paddingBottom: '16px' }}
              >
                <div className="w-14 flex items-center justify-center shrink-0">
                  {renderRankBadge(rank, false)}
                </div>
                <div className="flex-1 min-w-0">
                  {isEmpty ? (
                    <p
                      className="text-xl font-bold opacity-50 italic"
                      style={{ lineHeight: 1.5, paddingBottom: '4px' }}
                    >
                      Aguardando jogador
                    </p>
                  ) : (
                    <p
                      className="text-2xl font-bold"
                      style={{
                        lineHeight: 1.4,
                        paddingBottom: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '600px',
                      }}
                    >
                      {entry.user_name}
                      {isMe && (
                        <span className="ml-2 text-sm text-terminal-green/90 font-medium">(você)</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 min-w-[100px]">
                  <p
                    className={`text-4xl font-black tabular-nums ${
                      isEmpty ? 'opacity-30' : 'text-terminal-green'
                    }`}
                    style={{ lineHeight: 1.1, paddingBottom: '4px' }}
                  >
                    {entry?.total_points ?? 0}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Sua posição se fora do top 5 ───────────────────────── */}
        {!myInTop5 && myPosition && (
          <div
            className="flex items-center gap-5 px-5 rounded-xl border-2 border-terminal-green/70 bg-terminal-green/15 mb-6"
            style={{ minHeight: '92px', paddingTop: '16px', paddingBottom: '16px' }}
          >
            <div className="w-14 flex items-center justify-center shrink-0">
              <span
                className="text-2xl font-black opacity-80 tabular-nums"
                style={{ lineHeight: 1.5 }}
              >
                {myPosition.rank}º
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-2xl font-bold"
                style={{
                  lineHeight: 1.4,
                  paddingBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '600px',
                }}
              >
                {myPosition.user_name}
                <span className="ml-2 text-sm text-terminal-green/90 font-medium">(você)</span>
              </p>
            </div>
            <div className="text-right shrink-0 min-w-[100px]">
              <p
                className="text-4xl font-black text-terminal-green tabular-nums"
                style={{ lineHeight: 1.1, paddingBottom: '4px' }}
              >
                {myPosition.total_points}
              </p>
            </div>
          </div>
        )}

        {/* ─── Champion pick ──────────────────────────────────────── */}
        {myChampionPick && (
          <div
            className="flex items-center gap-4 px-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 mb-6"
            style={{ minHeight: '88px' }}
          >
            <Trophy className="w-8 h-8 text-yellow-400 shrink-0" strokeWidth={2.5} />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span
                className="text-base opacity-70 uppercase whitespace-nowrap"
                style={{ letterSpacing: '0.1em', lineHeight: 1.5 }}
              >
                Meu campeão:
              </span>
              <TeamFlag code={myChampionPick.predicted_team_code} size="md" />
              <span
                className="text-3xl font-bold text-yellow-300"
                style={{ fontFamily: 'monospace', lineHeight: 1.4, paddingBottom: '4px' }}
              >
                {myChampionPick.predicted_team_code}
              </span>
            </div>
          </div>
        )}

        {/* ─── Footer com URL de convite (destaque) ──────────────── */}
        <div className="mt-auto pt-8 border-t border-white/10">
          <p
            className="text-base opacity-60 uppercase mb-3"
            style={{ letterSpacing: '0.3em', lineHeight: 1.6 }}
          >
            Vem disputar:
          </p>
          <p
            className="text-3xl font-bold text-terminal-blue truncate"
            style={{
              fontFamily: 'monospace',
              lineHeight: 1.5,
              paddingBottom: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            smartbetting.app/bolao/<br />
            entrar/{inviteCode}
          </p>
        </div>
      </div>
    );
  }
);

RankingShareImageStories.displayName = 'RankingShareImageStories';
