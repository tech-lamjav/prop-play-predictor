import React from 'react';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getTeamLogoUrl } from '@/utils/team-logos';

export interface GameAngle {
  /** Time alvo do ângulo (geralmente o oponente de quem vai render o pick) */
  teamAbbr: string;
  /** Label da métrica defensiva (ex: "Defesa de pontos") */
  metricLabel: string;
  /** Rank defensivo da liga (1 = melhor defesa, 30 = pior). Maior é melhor pro bettor. */
  rank: number;
}

export interface GameHighlight {
  playerName: string;
  teamAbbr: string;
  stars: number;
  statShort: string;
  gapPct: number;
}

export interface GameInjuryTag {
  name: string;
  teamAbbr: string;
  status: string;
}

export interface RichGame {
  gameId: number;
  gameDate: string;
  gameDatetimeBrasilia: string | null;
  isFinished: boolean;
  homeWon: boolean;
  visitorWon: boolean;
  home: {
    teamId: number;
    abbr: string;
    name: string;
    score: number | null;
    lastFive: string | null;
    isB2B: boolean;
  };
  visitor: {
    teamId: number;
    abbr: string;
    name: string;
    score: number | null;
    lastFive: string | null;
    isB2B: boolean;
  };
  angle: GameAngle | null;
  highlights: GameHighlight[];
  injuries: GameInjuryTag[];
}

interface NBAGamesRichProps {
  games: RichGame[];
  onOpenGame: (gameId: number, gameDate: string) => void;
}

function statusBadgeTone(status: string): { text: string; cls: string } {
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return { text: 'OUT', cls: 'text-rose-700' };
  if (s.includes('doubtful')) return { text: 'DTD', cls: 'text-orange-700' };
  return { text: 'Q', cls: 'text-amber-700' };
}

function angleBadgeTone(rank: number): { cls: string; label: string } {
  if (rank >= 20) return { cls: 'bg-emerald-100 text-forest', label: 'defesa fraca' };
  if (rank >= 11) return { cls: 'bg-amber-100 text-amber-700', label: 'defesa média' };
  return { cls: 'bg-rose-100 text-rose-700', label: 'defesa forte' };
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] ?? full;
}

function formatTime(iso: string | null): string {
  if (!iso) return 'TBD';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TeamLogo: React.FC<{ teamName: string; abbr: string; size?: number }> = ({ teamName, abbr, size = 36 }) => (
  <div className="rounded-full grid place-items-center shrink-0 bg-canvas-2 border border-line overflow-hidden" style={{ width: size, height: size }}>
    <img
      src={getTeamLogoUrl(teamName)}
      alt={abbr}
      className="w-[80%] h-[80%] object-contain"
      onError={(e) => {
        const el = e.target as HTMLImageElement;
        el.style.display = 'none';
        const parent = el.parentElement;
        if (parent) parent.insertAdjacentHTML('beforeend', `<span class="text-[10px] font-bold text-ink-2">${abbr}</span>`);
      }}
    />
  </div>
);

const FormDots: React.FC<{ form: string | null; align?: 'left' | 'right' }> = ({ form, align = 'left' }) => {
  if (!form) return null;
  const last3 = form.replace(/\s/g, '').slice(0, 3).split('');
  return (
    <div className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'justify-end' : ''}`}>
      {last3.map((r, i) => {
        const isWin = r === 'V' || r === 'W';
        return (
          <span
            key={i}
            className={`inline-flex items-center justify-center text-[8px] font-bold text-white ${isWin ? 'bg-forest' : 'bg-rose-700'}`}
            style={{ width: 14, height: 14, borderRadius: 3 }}
          >
            {isWin ? 'V' : 'D'}
          </span>
        );
      })}
    </div>
  );
};

const GameRow: React.FC<{ g: RichGame; onClick: () => void }> = ({ g, onClick }) => {
  const time = formatTime(g.gameDatetimeBrasilia);
  const angle = g.angle ? angleBadgeTone(g.angle.rank) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left grid grid-cols-[72px_1fr_280px_220px_28px] items-center gap-5 px-5 py-4 border-t border-line first:border-t-0 hover:bg-canvas-2 transition-colors"
    >
      {/* Time */}
      <div>
        {g.isFinished ? (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-2">FT</div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-2/70">final</div>
          </>
        ) : (
          <>
            <div className="text-[18px] font-semibold tabular tracking-tight text-ink">{time}</div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-ink-2/70">hoje</div>
          </>
        )}
      </div>

      {/* Teams */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <TeamLogo teamName={g.visitor.name} abbr={g.visitor.abbr} />
          <div className="min-w-0">
            <div className={`text-[13px] font-semibold tracking-tight ${g.visitorWon ? 'text-forest' : 'text-ink'}`}>
              {g.visitor.abbr}
              {g.visitor.isB2B && (
                <span className="ml-1.5 px-1 h-3.5 inline-flex items-center rounded text-[8px] font-bold uppercase bg-amber-100 text-amber-700">B2B</span>
              )}
              {g.isFinished && g.visitor.score != null && (
                <span className={`ml-2 tabular ${g.visitorWon ? 'text-forest' : 'text-ink-2'}`}>{g.visitor.score}</span>
              )}
            </div>
            <FormDots form={g.visitor.lastFive} />
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-3 shrink-0">@</span>
        <div className="flex items-center gap-3 min-w-0">
          <TeamLogo teamName={g.home.name} abbr={g.home.abbr} />
          <div className="min-w-0">
            <div className={`text-[13px] font-semibold tracking-tight ${g.homeWon ? 'text-forest' : 'text-ink'}`}>
              {g.home.abbr}
              {g.home.isB2B && (
                <span className="ml-1.5 px-1 h-3.5 inline-flex items-center rounded text-[8px] font-bold uppercase bg-amber-100 text-amber-700">B2B</span>
              )}
              {g.isFinished && g.home.score != null && (
                <span className={`ml-2 tabular ${g.homeWon ? 'text-forest' : 'text-ink-2'}`}>{g.home.score}</span>
              )}
            </div>
            <FormDots form={g.home.lastFive} />
          </div>
        </div>
      </div>

      {/* Matchup */}
      <div className="pr-2 min-w-0">
        {g.angle && angle && (
          <>
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-2">Matchup</div>
            <div className="text-[12px] mt-1 text-ink">
              <span className="font-semibold">{g.angle.teamAbbr}</span> {g.angle.metricLabel} · #{g.angle.rank}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold tabular ${angle.cls}`}>
                {angle.label}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Highlights + injuries */}
      <div className="flex flex-col gap-1.5 min-w-0">
        {g.highlights.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {g.highlights.map((h, i) => (
              <span
                key={i}
                className="px-2 h-6 inline-flex items-center gap-1 rounded text-[11px] font-semibold bg-forest text-white whitespace-nowrap"
              >
                <span className="text-amber-300 tracking-tight">{'★'.repeat(Math.max(1, Math.min(3, h.stars)))}</span>
                <span>{lastName(h.playerName)}</span>
                <span className="text-white/70 tabular">+{Math.round(h.gapPct)}% {h.statShort}</span>
              </span>
            ))}
          </div>
        )}
        {g.injuries.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <span className="uppercase tracking-[0.14em] font-bold text-ink-2/70">Lesões:</span>
            {g.injuries.map((inj, i) => {
              const badge = statusBadgeTone(inj.status);
              return (
                <span key={i} className="text-ink-2 whitespace-nowrap">
                  <span className="font-semibold text-ink">{lastName(inj.name)}</span>{' '}
                  <span className={`tabular font-bold ${badge.cls}`}>{badge.text}</span>
                  {i < g.injuries.length - 1 ? ',' : ''}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-ink-3" />
    </button>
  );
};

const GameCardMobile: React.FC<{ g: RichGame; onClick: () => void }> = ({ g, onClick }) => {
  const time = formatTime(g.gameDatetimeBrasilia);
  const angle = g.angle ? angleBadgeTone(g.angle.rank) : null;
  const starsTotal = g.highlights.reduce((acc, h) => acc + h.stars, 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl overflow-hidden bg-white border border-line hover:border-forest/30 transition-colors"
    >
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between bg-canvas-2 border-b border-line">
        {g.isFinished ? (
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2/70">FT</span>
        ) : (
          <span className="text-[10px] font-semibold tabular">{time}</span>
        )}
        <div className="flex items-center gap-1.5">
          {starsTotal > 0 && (
            <span className="px-1.5 h-4 inline-flex items-center rounded text-[9px] font-bold uppercase bg-forest text-white">★ {starsTotal}</span>
          )}
          {g.injuries.length > 0 && (
            <span className="px-1.5 h-4 inline-flex items-center rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-700 gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              {g.injuries.length}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-3 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamLogo teamName={g.visitor.name} abbr={g.visitor.abbr} size={32} />
          <div className="min-w-0">
            <div className={`text-[12px] font-semibold tracking-tight ${g.visitorWon ? 'text-forest' : 'text-ink'}`}>
              {g.visitor.abbr}
              {g.isFinished && g.visitor.score != null && <span className="ml-1.5 tabular">{g.visitor.score}</span>}
            </div>
            <FormDots form={g.visitor.lastFive} />
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-widest font-bold text-ink-3 shrink-0">@</span>
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <div className="text-right min-w-0">
            <div className={`text-[12px] font-semibold tracking-tight ${g.homeWon ? 'text-forest' : 'text-ink'}`}>
              {g.isFinished && g.home.score != null && <span className="mr-1.5 tabular">{g.home.score}</span>}
              {g.home.abbr}
            </div>
            <FormDots form={g.home.lastFive} align="right" />
          </div>
          <TeamLogo teamName={g.home.name} abbr={g.home.abbr} size={32} />
        </div>
      </div>

      {/* Footer */}
      {(g.angle || g.highlights.length > 0) && (
        <div className="px-3 py-2 flex flex-col gap-1.5 border-t border-line">
          {g.angle && angle && (
            <div className="text-[10px] text-ink-2">
              <span className="text-[9px] uppercase tracking-[0.16em] font-bold mr-1 text-ink-2/70">Ângulo</span>
              <span className="font-semibold text-ink">{g.angle.teamAbbr}</span> {g.angle.metricLabel} · #{g.angle.rank}
              <span className={`ml-1 px-1 py-0.5 rounded text-[9px] font-bold ${angle.cls}`}>{angle.label}</span>
            </div>
          )}
          {g.highlights.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {g.highlights.map((h, i) => (
                <span key={i} className="px-1.5 h-5 inline-flex items-center gap-1 rounded text-[10px] font-semibold bg-forest text-white whitespace-nowrap">
                  <span className="text-amber-300 tracking-tight">{'★'.repeat(Math.max(1, Math.min(3, h.stars)))}</span>
                  <span>{lastName(h.playerName)}</span>
                  <span className="text-white/70 tabular">+{Math.round(h.gapPct)}%</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  );
};

export const NBAGamesRich: React.FC<NBAGamesRichProps> = ({ games, onOpenGame }) => {
  const isMobile = useIsMobile();

  if (games.length === 0) {
    return (
      <div className="text-center py-8 text-[13px] text-ink-2 bg-white border border-line rounded-xl">
        Nenhum jogo hoje
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2.5">
        {games.map(g => (
          <GameCardMobile key={g.gameId} g={g} onClick={() => onOpenGame(g.gameId, g.gameDate)} />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-line overflow-hidden">
      {games.map(g => (
        <GameRow key={g.gameId} g={g} onClick={() => onOpenGame(g.gameId, g.gameDate)} />
      ))}
    </div>
  );
};
