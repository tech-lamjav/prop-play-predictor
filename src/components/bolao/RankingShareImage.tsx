import React, { forwardRef } from 'react';
import type { BolaoRankingEntry, ChampionPrediction } from '@/services/bolao.service';

interface RankingShareImageProps {
  bolaoName: string;
  inviteCode: string;
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  myChampionPick?: ChampionPrediction | null;
  /** "top5" (pódio + 4-5) | "all" (classificação geral compacta). Default top5. */
  mode?: 'top5' | 'all';
}

// ════════════════════════════════════════════════════════════════
// Paleta "Dark Stadium" — verde-mata + dourado (Copa)
// ════════════════════════════════════════════════════════════════
const C_BG_GRAD  = 'radial-gradient(120% 80% at 50% 0%, #0d5440 0%, #062318 60%, #03150e 100%)';
const C_CREAM    = '#f4f1e8';
const C_WHITE     = '#ffffff';
const C_GREEN_MUT = '#9fc3b3';   // textos secundários / subtítulos
const C_GOLD     = '#d4a017';
const C_GOLD_LT  = '#e9c766';
const C_GOLD_MUT = '#cbb06a';    // ranks 2..5
const C_LINE     = 'rgba(255,255,255,0.09)';
const C_LINE_2   = 'rgba(255,255,255,0.06)';
const C_ME_BG    = 'rgba(212,160,23,0.12)';
const C_GOLD_CARD = 'linear-gradient(90deg, rgba(212,160,23,0.18), rgba(212,160,23,0.04))';

const FONT = '"Manrope", system-ui, -apple-system, sans-serif';

/** Quantas linhas cabem no modo "all" antes de truncar com "+N jogadores". */
const ALL_MAX_ROWS = 15;

/** Métrica de acerto corrigida: cravar o placar conta como cravada E acerto. */
function metrics(entry: BolaoRankingEntry) {
  const cravadas = entry.exact_scores ?? 0;
  const acertos = (entry.exact_scores ?? 0) + (entry.correct_results ?? 0);
  return { cravadas, acertos };
}

function metricsLabel(entry: BolaoRankingEntry): string {
  const { cravadas, acertos } = metrics(entry);
  return `${cravadas} cravada${cravadas !== 1 ? 's' : ''} · ${acertos} acerto${acertos !== 1 ? 's' : ''}`;
}

/**
 * Card 1080×1080 (feed) do ranking do bolão. Renderizado off-screen e
 * capturado via html2canvas → PNG. Estilo "Dark Stadium" (verde + dourado) /
 * Manrope (carregada via Google Fonts no index.html — sem dependência npm).
 *
 * Anti-clipping html2canvas: textos com overflow:hidden usam line-height
 * folgado (≥1.4) + padding vertical, senão os glifos são cortados.
 *
 * mode="top5" → 5 primeiros (subtítulo com cravadas/acertos) + sua posição
 *               se estiver fora do top 5.
 * mode="all"  → classificação geral compacta (até ALL_MAX_ROWS linhas, com
 *               "+N jogadores" no overflow; sua linha sempre aparece).
 */
export const RankingShareImage = forwardRef<HTMLDivElement, RankingShareImageProps>(
  ({ bolaoName, inviteCode, ranking, currentUserId, mode = 'top5' }, ref) => {
    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1080px] flex flex-col overflow-hidden"
        style={{ background: C_BG_GRAD, color: C_CREAM, fontFamily: FONT, padding: 72 }}
      >
        <Header bolaoName={bolaoName} />
        {mode === 'all'
          ? <AllList ranking={ranking} currentUserId={currentUserId} />
          : <Top5List ranking={ranking} currentUserId={currentUserId} />}
        <FooterUrl inviteCode={inviteCode} />
      </div>
    );
  }
);

RankingShareImage.displayName = 'RankingShareImage';

// ════════════════════════════════════════════════════════════════
// Header
// ════════════════════════════════════════════════════════════════

const Header: React.FC<{ bolaoName: string }> = ({ bolaoName }) => (
  <header className="flex items-center justify-between" style={{ marginBottom: 30, gap: 24 }}>
    <span
      style={{
        fontSize: 52,
        fontWeight: 800,
        color: C_WHITE,
        letterSpacing: '-0.02em',
        lineHeight: 1.4,
        paddingTop: 6,
        paddingBottom: 6,
        maxWidth: 700,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {bolaoName}
    </span>
    <span
      style={{
        flexShrink: 0,
        fontSize: 18,
        fontWeight: 800,
        color: C_GOLD_LT,
        letterSpacing: '0.14em',
        border: `1.5px solid rgba(212,160,23,0.45)`,
        borderRadius: 999,
        padding: '12px 20px',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      COPA 2026
    </span>
  </header>
);

const Eyebrow: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      fontSize: 22,
      fontWeight: 800,
      letterSpacing: '0.18em',
      color: C_GREEN_MUT,
      borderBottom: `2px solid ${C_LINE}`,
      paddingBottom: 18,
      marginBottom: 6,
    }}
  >
    {text}
  </div>
);

const FooterUrl: React.FC<{ inviteCode: string }> = ({ inviteCode }) => (
  <div style={{ marginTop: 'auto', paddingTop: 28, borderTop: `1px solid ${C_LINE}` }}>
    <p style={{ fontSize: 22, fontWeight: 600, color: C_GREEN_MUT, letterSpacing: '0.01em', paddingTop: 6 }}>
      smartbetting.app/bolao/entrar/<span style={{ color: C_GOLD_LT, fontWeight: 700 }}>{inviteCode}</span>
    </p>
  </div>
);

// ════════════════════════════════════════════════════════════════
// Top 5
// ════════════════════════════════════════════════════════════════

const Top5List: React.FC<{ ranking: BolaoRankingEntry[]; currentUserId?: string }> = ({
  ranking,
  currentUserId,
}) => {
  const top5 = ranking.slice(0, 5);
  const filled: (BolaoRankingEntry | null)[] = [...top5];
  while (filled.length < 5) filled.push(null);

  const myInTop5 = top5.some((r) => r.user_id === currentUserId);
  const myPosition = currentUserId ? ranking.find((r) => r.user_id === currentUserId) : null;

  return (
    <>
      <Eyebrow text="RANKING · TOP 5" />
      <div className="flex flex-col" style={{ flex: 1, gap: 6 }}>
        {filled.map((entry, idx) => (
          <Top5Row
            key={entry?.user_id ?? `empty-${idx}`}
            rank={idx + 1}
            entry={entry}
            isMe={!!entry && entry.user_id === currentUserId}
          />
        ))}
        {!myInTop5 && myPosition && (
          <>
            <div style={{ padding: '12px 0', color: C_GOLD_MUT, fontSize: 22, fontWeight: 700, opacity: 0.6 }}>···</div>
            <Top5Row rank={Number(myPosition.rank)} entry={myPosition} isMe />
          </>
        )}
      </div>
    </>
  );
};

const Top5Row: React.FC<{
  rank: number;
  entry: BolaoRankingEntry | null;
  isMe?: boolean;
}> = ({ rank, entry, isMe }) => {
  const isEmpty = !entry;
  const isFirst = rank === 1 && !isEmpty;

  const rowStyle: React.CSSProperties = isFirst
    ? { background: C_GOLD_CARD, border: '1.5px solid rgba(212,160,23,0.4)', borderRadius: 16, padding: '24px 28px' }
    : isMe
      ? { background: C_ME_BG, borderRadius: 14, padding: '20px 28px' }
      : { padding: '20px 28px', borderBottom: `1px solid ${C_LINE}` };

  return (
    <div className="flex items-center" style={{ gap: 26, opacity: isEmpty ? 0.35 : 1, ...rowStyle }}>
      <span
        style={{
          fontSize: isFirst ? 54 : 40,
          fontWeight: 800,
          color: isFirst ? C_GOLD : C_GOLD_MUT,
          minWidth: 64,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontSize: isFirst ? 34 : 30,
            fontWeight: isFirst ? 800 : 700,
            color: isEmpty ? C_GREEN_MUT : C_WHITE,
            fontStyle: isEmpty ? 'italic' : 'normal',
            letterSpacing: '-0.01em',
            margin: 0,
            lineHeight: 1.5,
            paddingTop: 4,
            paddingBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isEmpty ? 'Aguardando jogador' : entry.user_name}
          {isMe && <span style={{ fontSize: 17, color: C_GOLD_LT, fontWeight: 800, marginLeft: 10 }}>você</span>}
        </p>
        {!isEmpty && (
          <p style={{ fontSize: 18, fontWeight: 500, color: C_GREEN_MUT, marginTop: 2, lineHeight: 1.4, paddingBottom: 2 }}>
            {metricsLabel(entry)}
          </p>
        )}
      </div>
      <span
        style={{
          fontSize: isFirst ? 52 : 40,
          fontWeight: 800,
          color: isEmpty ? C_GREEN_MUT : isFirst ? C_GOLD : C_WHITE,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {entry?.total_points ?? 0}
      </span>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Todos (classificação geral compacta)
// ════════════════════════════════════════════════════════════════

const AllList: React.FC<{ ranking: BolaoRankingEntry[]; currentUserId?: string }> = ({
  ranking,
  currentUserId,
}) => {
  const total = ranking.length;
  const visible = ranking.slice(0, ALL_MAX_ROWS);
  const overflow = total - visible.length;

  const myEntry = currentUserId ? ranking.find((r) => r.user_id === currentUserId) : null;
  const myShown = myEntry && visible.some((r) => r.user_id === currentUserId);
  const appendMe = !!myEntry && !myShown;

  return (
    <>
      <Eyebrow text={`CLASSIFICAÇÃO GERAL · ${total} ${total === 1 ? 'JOGADOR' : 'JOGADORES'}`} />
      <div className="flex flex-col" style={{ flex: 1 }}>
        {visible.map((entry) => (
          <AllRow
            key={entry.user_id}
            rank={Number(entry.rank)}
            entry={entry}
            isMe={entry.user_id === currentUserId}
          />
        ))}
        {overflow > 0 && !appendMe && (
          <div style={{ padding: '14px 12px', color: C_GREEN_MUT, fontSize: 22, fontWeight: 600 }}>
            + {overflow} {overflow === 1 ? 'jogador' : 'jogadores'}
          </div>
        )}
        {appendMe && (
          <>
            <div style={{ padding: '10px 12px', color: C_GOLD_MUT, fontSize: 22, fontWeight: 700, opacity: 0.6 }}>···</div>
            <AllRow rank={Number(myEntry!.rank)} entry={myEntry!} isMe />
          </>
        )}
      </div>
    </>
  );
};

const AllRow: React.FC<{ rank: number; entry: BolaoRankingEntry; isMe?: boolean }> = ({
  rank,
  entry,
  isMe,
}) => (
  <div
    className="flex items-center"
    style={{
      gap: 20,
      padding: '13px 12px',
      borderBottom: `1px solid ${C_LINE_2}`,
      borderRadius: isMe ? 10 : 0,
      background: isMe ? C_ME_BG : 'transparent',
      fontSize: 26,
    }}
  >
    <span
      style={{
        minWidth: 56,
        fontWeight: rank <= 3 ? 800 : 700,
        color: rank === 1 ? C_GOLD : rank <= 5 ? C_GOLD_MUT : C_GREEN_MUT,
        lineHeight: 1.2,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {rank}
    </span>
    <span
      className="flex-1 min-w-0"
      style={{
        fontWeight: rank <= 5 ? 700 : 600,
        color: rank <= 5 ? C_WHITE : C_CREAM,
        lineHeight: 1.5,
        paddingTop: 3,
        paddingBottom: 3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {entry.user_name}
      {isMe && <span style={{ fontSize: 15, color: C_GOLD_LT, fontWeight: 800, marginLeft: 8 }}>você</span>}
    </span>
    <span style={{ fontWeight: 800, color: C_WHITE, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
      {entry.total_points}
    </span>
  </div>
);
