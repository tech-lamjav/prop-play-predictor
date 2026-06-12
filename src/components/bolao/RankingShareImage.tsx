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
// Paleta "Minimal Clean" — branco, tipografia grande, dourado no 1º
// ════════════════════════════════════════════════════════════════
const C_BG       = '#ffffff';
const C_INK      = '#111111';
const C_GRAY     = '#999999';
const C_GRAY_2   = '#bbbbbb';
const C_LINE     = '#eeeeee';
const C_LINE_2   = '#f0f0f0';
const C_GOLD     = '#d4a017';
const C_FOREST   = '#0a3d2e';
const C_ME_BG    = '#f6faf8';

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
 * capturado via html2canvas → PNG. Estilo "Minimal Clean" / Manrope (carregada
 * via Google Fonts no index.html — sem dependência npm).
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
        style={{ background: C_BG, color: C_INK, fontFamily: FONT, padding: 72 }}
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
  <header className="flex items-center justify-between" style={{ marginBottom: 34 }}>
    <span
      style={{
        fontSize: 52,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        // line-height folgado + padding vertical evitam o clipping de glifos do
        // html2canvas (que corta ascender/descender com line-height apertado).
        lineHeight: 1.4,
        paddingTop: 6,
        paddingBottom: 6,
        maxWidth: 720,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {bolaoName}
    </span>
    <span style={{ fontSize: 22, fontWeight: 600, color: C_GRAY, whiteSpace: 'nowrap' }}>
      Copa 2026
    </span>
  </header>
);

const Eyebrow: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '0.18em',
      color: C_INK,
      borderBottom: `2px solid ${C_INK}`,
      paddingBottom: 18,
      marginBottom: 6,
    }}
  >
    {text}
  </div>
);

const FooterUrl: React.FC<{ inviteCode: string }> = ({ inviteCode }) => (
  <div style={{ marginTop: 'auto', paddingTop: 28 }}>
    <p style={{ fontSize: 22, fontWeight: 600, color: C_INK, letterSpacing: '0.01em' }}>
      smartbetting.app/bolao/entrar/{inviteCode}
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
      <div className="flex flex-col" style={{ flex: 1 }}>
        {filled.map((entry, idx) => (
          <Top5Row
            key={entry?.user_id ?? `empty-${idx}`}
            rank={idx + 1}
            entry={entry}
            isMe={!!entry && entry.user_id === currentUserId}
            last={idx === 4}
          />
        ))}
        {!myInTop5 && myPosition && (
          <>
            <div style={{ padding: '14px 0', color: C_GRAY_2, fontSize: 22, fontWeight: 600 }}>···</div>
            <Top5Row rank={Number(myPosition.rank)} entry={myPosition} isMe last />
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
  last?: boolean;
}> = ({ rank, entry, isMe, last }) => {
  const isEmpty = !entry;
  return (
    <div
      className="flex items-baseline"
      style={{
        gap: 26,
        padding: '26px 20px',
        borderBottom: last ? 'none' : `1px solid ${C_LINE}`,
        borderRadius: isMe ? 12 : 0,
        background: isMe ? C_ME_BG : 'transparent',
        opacity: isEmpty ? 0.4 : 1,
      }}
    >
      <span
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: rank === 1 && !isEmpty ? C_GOLD : C_GRAY,
          minWidth: 64,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontSize: 34,
            fontWeight: 600,
            color: isEmpty ? C_GRAY : C_INK,
            fontStyle: isEmpty ? 'italic' : 'normal',
            letterSpacing: '-0.01em',
            margin: 0,
            // line-height + padding: evita html2canvas cortar glifos (descenders
            // de "jogador", ascenders, etc.) com overflow:hidden.
            lineHeight: 1.5,
            paddingTop: 4,
            paddingBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isEmpty ? 'Aguardando jogador' : entry.user_name}
          {isMe && <span style={{ fontSize: 17, color: C_FOREST, fontWeight: 700, marginLeft: 10 }}>você</span>}
        </p>
        {!isEmpty && (
          <p style={{ fontSize: 19, fontWeight: 500, color: C_GRAY, marginTop: 3, lineHeight: 1.4, paddingBottom: 2 }}>
            {metricsLabel(entry)}
          </p>
        )}
      </div>
      <span
        style={{
          fontSize: 44,
          fontWeight: 700,
          color: isEmpty ? C_GRAY : C_INK,
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
  let visible = ranking.slice(0, ALL_MAX_ROWS);
  const overflow = total - visible.length;

  // Garante que a linha do usuário apareça mesmo fora do corte.
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
          <div style={{ padding: '14px 12px', color: C_GRAY, fontSize: 22, fontWeight: 600 }}>
            + {overflow} {overflow === 1 ? 'jogador' : 'jogadores'}
          </div>
        )}
        {appendMe && (
          <>
            <div style={{ padding: '10px 12px', color: C_GRAY_2, fontSize: 22, fontWeight: 600 }}>···</div>
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
        color: rank === 1 ? C_GOLD : rank <= 5 ? C_GRAY : C_GRAY_2,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {rank}
    </span>
    <span
      className="flex-1 min-w-0"
      style={{
        fontWeight: rank <= 5 ? 700 : 600,
        color: C_INK,
        lineHeight: 1.5,
        paddingTop: 3,
        paddingBottom: 3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {entry.user_name}
      {isMe && <span style={{ fontSize: 15, color: C_FOREST, fontWeight: 700, marginLeft: 8 }}>você</span>}
    </span>
    <span style={{ fontWeight: 800, color: C_INK, fontVariantNumeric: 'tabular-nums' }}>
      {entry.total_points}
    </span>
  </div>
);
