import React, { forwardRef } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import type { BolaoRankingEntry, ChampionPrediction } from '@/services/bolao.service';

interface RankingShareImageProps {
  bolaoName: string;
  inviteCode: string;
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  myChampionPick?: ChampionPrediction | null;
}

/**
 * Card visual 1080×1080 (Instagram-friendly) com o ranking do bolão.
 * Renderizado off-screen no DOM e capturado via html2canvas pra virar PNG.
 *
 * Nota técnica sobre html2canvas:
 *  Tipografia compacta (line-height: 1, leading-tight) é renderizada
 *  com bordas cortadas pelo html2canvas. Mantemos lineHeight ≥ 1.4
 *  e altura de container generosa pra preservar descenders (y/p/g/j).
 *
 * Decisões de design:
 *  - Top 5 sempre visível com slots "Aguardando jogador"
 *  - Pódio (Trophy/Medal/Award) sempre nos 3 primeiros pra dar identidade
 *  - Logo Smart Betting só no footer (cleaner que dual no header)
 *  - Truncate horizontal de nomes longos via ellipsis
 *  - Respiro vertical generoso pra evitar corte de fonte
 */
export const RankingShareImage = forwardRef<HTMLDivElement, RankingShareImageProps>(
  ({ bolaoName, inviteCode, ranking, currentUserId, myChampionPick }, ref) => {
    const top5 = ranking.slice(0, 5);
    const filledTop5: (BolaoRankingEntry | null)[] = [...top5];
    while (filledTop5.length < 5) filledTop5.push(null);

    const myPosition = currentUserId
      ? ranking.find(r => r.user_id === currentUserId)
      : null;
    const myInTop5 = top5.some(r => r.user_id === currentUserId);

    const renderRankBadge = (rank: number) => {
      if (rank === 1) return <Trophy className="w-12 h-12 text-yellow-400" strokeWidth={2.5} />;
      if (rank === 2) return <Medal className="w-12 h-12 text-slate-300" strokeWidth={2.5} />;
      if (rank === 3) return <Award className="w-12 h-12 text-orange-400" strokeWidth={2.5} />;
      return <span className="text-3xl font-black opacity-60 tabular-nums" style={{ lineHeight: 1.5 }}>{rank}º</span>;
    };

    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1080px] flex flex-col p-14 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #050a14 0%, #0f1a2e 45%, #0a1628 100%)',
          fontFamily: '"Inter", "JetBrains Mono", system-ui, sans-serif',
          color: '#e8eef0',
        }}
      >
        {/* ─── Header — só nome do bolão + Trophy (logo vai no footer) ── */}
        <div className="flex items-start justify-between gap-8 mb-12">
          <div className="flex-1 min-w-0">
            <p
              className="text-base font-bold uppercase text-terminal-blue mb-4"
              style={{ letterSpacing: '0.4em', lineHeight: 1.6 }}
            >
              Bolão · Copa 2026
            </p>
            <h1
              className="text-5xl font-black"
              style={{
                lineHeight: 1.2,                  // respiro maior pra fontes
                paddingBottom: '8px',             // descenders (g, p, j) precisam de espaço
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                maxHeight: '160px',
                overflow: 'hidden',
              }}
            >
              {bolaoName}
            </h1>
          </div>
          <div className="shrink-0 pt-2">
            <Trophy className="w-16 h-16 text-yellow-400" strokeWidth={1.5} />
          </div>
        </div>

        {/* ─── Subtítulo ranking ───────────────────────────────────── */}
        <p
          className="text-sm font-bold uppercase mb-5"
          style={{
            letterSpacing: '0.3em',
            color: 'rgba(232, 238, 240, 0.6)',
            lineHeight: 1.6,
            paddingBottom: '4px',
          }}
        >
          Top 5 do ranking
        </p>

        {/* ─── Top 5 ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-2">
          {filledTop5.map((entry, idx) => {
            const rank = idx + 1;
            const isPodium = rank <= 3;
            const isMe = entry?.user_id === currentUserId;
            const isEmpty = !entry;

            return (
              <div
                key={entry?.user_id ?? `empty-${idx}`}
                className={`flex items-center gap-5 px-5 rounded-2xl border-2 ${
                  isMe
                    ? 'border-terminal-green/70 bg-terminal-green/15'
                    : isPodium
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-white/8 bg-white/[0.025]'
                } ${isEmpty ? 'opacity-30' : ''}`}
                style={{
                  minHeight: '102px',                    // mais respiro pra fonte completa
                  paddingTop: '18px',
                  paddingBottom: '18px',
                }}
              >
                {/* Posição/medalha */}
                <div className="w-14 flex items-center justify-center shrink-0">
                  {renderRankBadge(rank)}
                </div>

                {/* Nome + stats */}
                <div className="flex-1 min-w-0">
                  {isEmpty ? (
                    <p
                      className="text-2xl font-bold opacity-50 italic"
                      style={{ lineHeight: 1.5, paddingBottom: '4px' }}
                    >
                      Aguardando jogador
                    </p>
                  ) : (
                    <>
                      <p
                        className="text-2xl font-bold"
                        style={{
                          lineHeight: 1.4,                // espaço pra descenders
                          paddingBottom: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '640px',
                        }}
                      >
                        {entry.user_name}
                        {isMe && (
                          <span
                            className="ml-3 text-base text-terminal-green/90 font-medium"
                            style={{ lineHeight: 1.4 }}
                          >
                            (você)
                          </span>
                        )}
                      </p>
                      <p
                        className="text-sm opacity-50 mt-1"
                        style={{ lineHeight: 1.5 }}
                      >
                        {entry.exact_scores} placares · {entry.correct_results} resultados
                      </p>
                    </>
                  )}
                </div>

                {/* Pontos */}
                <div className="text-right shrink-0 min-w-[110px]">
                  <p
                    className={`text-5xl font-black tabular-nums ${
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
        </div>

        {/* ─── Sua posição se fora do top 5 ──────────────────────────── */}
        {!myInTop5 && myPosition && (
          <>
            <div className="flex items-center gap-3 my-3 opacity-30">
              <div className="flex-1 h-px bg-white/30" />
              <span className="text-xs uppercase" style={{ letterSpacing: '0.3em' }}>···</span>
              <div className="flex-1 h-px bg-white/30" />
            </div>
            <div
              className="flex items-center gap-5 px-5 rounded-2xl border-2 border-terminal-green/70 bg-terminal-green/15"
              style={{ minHeight: '102px', paddingTop: '18px', paddingBottom: '18px' }}
            >
              <div className="w-14 flex items-center justify-center shrink-0">
                <span
                  className="text-3xl font-black opacity-80 tabular-nums"
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
                    maxWidth: '640px',
                  }}
                >
                  {myPosition.user_name}
                  <span className="ml-3 text-base text-terminal-green/90 font-medium">(você)</span>
                </p>
                <p className="text-sm opacity-50 mt-1" style={{ lineHeight: 1.5 }}>
                  de {ranking.length} participantes
                </p>
              </div>
              <div className="text-right shrink-0 min-w-[110px]">
                <p
                  className="text-5xl font-black text-terminal-green tabular-nums"
                  style={{ lineHeight: 1.1, paddingBottom: '4px' }}
                >
                  {myPosition.total_points}
                </p>
                <p className="text-sm opacity-50 uppercase mt-1" style={{ letterSpacing: '0.1em', lineHeight: 1.5 }}>
                  pts
                </p>
              </div>
            </div>
          </>
        )}

        {/* ─── Champion pick ──────────────────────────────────────── */}
        {myChampionPick && (
          <div className="mt-5 flex items-center gap-4 px-5 py-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10">
            <Trophy className="w-7 h-7 text-yellow-400 shrink-0" strokeWidth={2.5} />
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span
                className="text-base opacity-70 uppercase whitespace-nowrap"
                style={{ letterSpacing: '0.1em', lineHeight: 1.5 }}
              >
                Meu campeão:
              </span>
              <TeamFlag code={myChampionPick.predicted_team_code} size="md" />
              <span
                className="text-2xl font-bold text-yellow-300"
                style={{ fontFamily: 'monospace', lineHeight: 1.4, paddingBottom: '4px' }}
              >
                {myChampionPick.predicted_team_code}
              </span>
            </div>
          </div>
        )}

        {/* ─── Footer com logo Smart Betting ──────────────────────── */}
        <div
          className="mt-auto pt-8 border-t border-white/10 flex items-center justify-between gap-6"
          style={{ minHeight: '88px' }}
        >
          <div className="min-w-0 flex-1">
            <p
              className="text-sm opacity-60 uppercase mb-2"
              style={{ letterSpacing: '0.2em', lineHeight: 1.6 }}
            >
              Vem disputar:
            </p>
            <p
              className="text-xl font-bold text-terminal-blue truncate"
              style={{
                fontFamily: 'monospace',
                lineHeight: 1.5,
                paddingBottom: '4px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              smartbetting.app/bolao/entrar/{inviteCode}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <img
              src="/logo-sem-texto.png"
              alt="Smart Betting"
              className="w-10 h-10 object-contain opacity-90"
              crossOrigin="anonymous"
            />
            <span
              className="text-base font-bold opacity-80 uppercase"
              style={{ letterSpacing: '0.15em', lineHeight: 1.5 }}
            >
              smartbetting
            </span>
          </div>
        </div>
      </div>
    );
  }
);

RankingShareImage.displayName = 'RankingShareImage';
