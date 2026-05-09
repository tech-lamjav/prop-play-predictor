import React, { forwardRef } from 'react';
import type { BolaoRankingEntry, ChampionPrediction } from '@/services/bolao.service';

interface RankingShareImageProps {
  bolaoName: string;
  inviteCode: string;
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  myChampionPick?: ChampionPrediction | null;
}

// ════════════════════════════════════════════════════════════════
// Constantes de cor (paleta "Direção A")
// ════════════════════════════════════════════════════════════════
const C_CANVAS    = '#f6f7f5';
const C_CANVAS_2  = '#eef0eb';
const C_INK       = '#1a1d1a';
const C_INK_2     = '#4a4f48';
const C_INK_3     = '#8a8f86';
const C_LINE      = 'rgba(26,29,26,0.10)';
const C_FOREST    = '#0a3d2e';
const C_AMBER     = '#d4a017';
const C_AMBER_2   = '#b8870f';
const C_CREAM     = '#fffaf0';
const C_AMBER_30  = 'rgba(212, 160, 23, 0.30)';
const C_AMBER_15  = 'rgba(212, 160, 23, 0.14)';
const C_AMBER_50  = 'rgba(212, 160, 23, 0.50)';

/**
 * Card visual 1080×1080 (Instagram-friendly) com o ranking do bolão.
 * Renderizado off-screen no DOM e capturado via html2canvas → PNG.
 *
 * ┌─ Layout principles ──────────────────────────────────────────┐
 * │ 1. Cada card tem 2 áreas: TOP-ROW (rank+nome+pontos) e       │
 * │    SUBTITLE (placares · resultados, abaixo).                 │
 * │ 2. TOP-ROW usa flex items-center com TODOS os elementos com  │
 * │    lineHeight: 1 (garante que o cap visual center === line   │
 * │    box center, e centers alinham automaticamente).           │
 * │ 3. SUBTITLE fica numa linha separada, indentada pra começar  │
 * │    onde o nome começa.                                       │
 * │ 4. Pill do header usa inline-block + verticalAlign: middle.  │
 * │                                                              │
 * │ Estilo: "Editorial Light" — fundo off-white, números         │
 * │ dourados, card-você em verde-mata.                           │
 * └──────────────────────────────────────────────────────────────┘
 */
export const RankingShareImage = forwardRef<HTMLDivElement, RankingShareImageProps>(
  ({ bolaoName, inviteCode, ranking, currentUserId }, ref) => {
    const top5 = ranking.slice(0, 5);
    const filledTop5: (BolaoRankingEntry | null)[] = [...top5];
    while (filledTop5.length < 5) filledTop5.push(null);

    const myPosition = currentUserId ? ranking.find((r) => r.user_id === currentUserId) : null;
    const myInTop5 = top5.some((r) => r.user_id === currentUserId);

    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1080px] flex flex-col p-14 overflow-hidden"
        style={{
          background: C_CANVAS,
          fontFamily: '"Inter Variable", "Inter", system-ui, sans-serif',
          color: C_INK,
        }}
      >
        <Header />
        <Eyebrow text="Ranking" />
        <Title text={bolaoName} />
        <DividerWithLabel label="Top 5" />

        {/* Top 3 — pódio em destaque */}
        <div className="flex flex-col gap-3 mb-3">
          {filledTop5.slice(0, 3).map((entry, idx) => (
            <PodiumCardBig
              key={entry?.user_id ?? `empty-${idx}`}
              rank={idx + 1}
              entry={entry}
              isMe={entry?.user_id === currentUserId}
            />
          ))}
        </div>

        {/* Top 4-5 — compacto */}
        <div className="flex flex-col gap-1">
          {filledTop5.slice(3, 5).map((entry, idx) => (
            <PodiumRowSmall
              key={entry?.user_id ?? `empty-${idx + 3}`}
              rank={idx + 4}
              entry={entry}
              isMe={entry?.user_id === currentUserId}
            />
          ))}
        </div>

        {/* Sua posição se fora do top 5 */}
        {!myInTop5 && myPosition && (
          <>
            <Divider />
            <PodiumRowSmall rank={Number(myPosition.rank)} entry={myPosition} isMe />
          </>
        )}

        {/* Footer URL */}
        <FooterUrl inviteCode={inviteCode} />
      </div>
    );
  }
);

RankingShareImage.displayName = 'RankingShareImage';

// ════════════════════════════════════════════════════════════════
// Componentes do header / divider / footer
// ════════════════════════════════════════════════════════════════

const Header: React.FC = () => (
  <header className="flex items-center justify-between mb-7">
    {/* Pill com logo completo (já inclui o texto "Smart Betting") */}
    <span
      style={{
        display: 'inline-block',
        background: C_FOREST,
        padding: '12px 22px',
        borderRadius: 999,
        lineHeight: 0,  // remove space below inline-block image
      }}
    >
      <img
        src="/logo.png"
        alt="Smart Betting"
        style={{
          display: 'block',
          height: 32,
          width: 'auto',
          objectFit: 'contain',
        }}
        crossOrigin="anonymous"
      />
    </span>
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 800,
        color: C_AMBER_2,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        background: C_AMBER_15,
        border: `1.5px solid ${C_AMBER_50}`,
        padding: '11px 18px',
        borderRadius: 999,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      Bolão · Copa 2026
    </span>
  </header>
);

const Eyebrow: React.FC<{ text: string }> = ({ text }) => (
  <p
    style={{
      fontSize: 12,
      fontWeight: 800,
      color: C_INK_2,
      letterSpacing: '0.4em',
      textTransform: 'uppercase',
      marginBottom: 14,
      lineHeight: 1.5,
    }}
  >
    {text}
  </p>
);

const Title: React.FC<{ text: string }> = ({ text }) => (
  <h1
    style={{
      fontSize: 60,
      fontWeight: 900,
      color: C_INK,
      letterSpacing: '-0.028em',
      lineHeight: 1.2,
      paddingBottom: '16px',
      marginBottom: 18,
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      maxHeight: '230px',
      overflow: 'hidden',
    }}
  >
    {text}
  </h1>
);

const DividerWithLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-4 mb-5">
    <div style={{ flex: 1, height: 1, background: C_INK }} />
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: C_INK,
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
    <div style={{ flex: 1, height: 1, background: C_INK }} />
  </div>
);

const Divider: React.FC = () => (
  <div className="flex items-center justify-center gap-4 mt-3 mb-2" style={{ opacity: 0.4 }}>
    <div style={{ width: 24, height: 1, background: C_INK }} />
    <span style={{ fontSize: 10, letterSpacing: '0.3em', color: C_INK }}>•••</span>
    <div style={{ width: 24, height: 1, background: C_INK }} />
  </div>
);

const FooterUrl: React.FC<{ inviteCode: string }> = ({ inviteCode }) => (
  <div className="mt-auto pt-6" style={{ borderTop: `1px solid ${C_LINE}` }}>
    <p
      style={{
        fontSize: 15,
        fontWeight: 700,
        color: C_FOREST,
        letterSpacing: '0.02em',
        lineHeight: 1.5,
        paddingBottom: '6px',
        textAlign: 'center',
      }}
    >
      smartbetting.app/bolao/entrar/{inviteCode}
    </p>
  </div>
);

// ════════════════════════════════════════════════════════════════
// PodiumCardBig — top 3
// ════════════════════════════════════════════════════════════════

const PodiumCardBig: React.FC<{
  rank: number;
  entry: BolaoRankingEntry | null;
  isMe?: boolean;
}> = ({ rank, entry, isMe }) => {
  const isEmpty = !entry;

  // Estilo visual do card
  const cardStyle: React.CSSProperties =
    isMe && !isEmpty
      ? {
          background: C_FOREST,
          borderRadius: 16,
          padding: '20px 24px',
          color: '#ffffff',
        }
      : {
          background: C_CREAM,
          border: `1.5px solid ${C_AMBER_30}`,
          borderRadius: 16,
          padding: '20px 24px',
          opacity: isEmpty ? 0.45 : 1,
        };

  const numberColor = isMe && !isEmpty ? C_AMBER : C_AMBER_2;
  const nameColor   = isMe && !isEmpty ? '#ffffff' : C_INK;
  const subtitleColor = isMe && !isEmpty ? 'rgba(255,255,255,0.65)' : C_INK_3;
  const ptsColor    = isMe && !isEmpty ? C_AMBER : C_INK;
  const ptsLabelColor = isMe && !isEmpty ? 'rgba(255,255,255,0.55)' : C_INK_3;

  return (
    <div style={cardStyle}>
      {/* TOP ROW — rank + nome + pontos
          Princípio: todos com lineHeight 1, items-center → cap centers alinham. */}
      <div className="flex items-center gap-4">
        <span
          style={{
            display: 'inline-block',
            fontSize: 56,
            fontWeight: 900,
            color: numberColor,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            minWidth: 70,
            textAlign: 'center',
          }}
        >
          {rank}
        </span>

        <p
          className="flex-1 min-w-0"
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: isEmpty ? subtitleColor : nameColor,
            fontStyle: isEmpty ? 'italic' : 'normal',
            letterSpacing: '-0.01em',
            // lineHeight 1.6 + padding vertical pra evitar clipping com
            // overflow:hidden (necessário pra ellipsis). html2canvas tem
            // pequenas variações de rendering, então damos folga generosa.
            // Cap visual center continua na line box center → alinhamento OK.
            lineHeight: 1.6,
            margin: 0,
            paddingTop: 4,
            paddingBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isEmpty ? 'Aguardando jogador' : entry.user_name}
        </p>

        <span
          style={{
            display: 'inline-block',
            fontSize: 56,
            fontWeight: 900,
            color: ptsColor,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            paddingBottom: 6,  // respiro pra alinhar visualmente com o número do nome
          }}
        >
          {entry?.total_points ?? 0}
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: ptsLabelColor,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginLeft: 8,
              verticalAlign: 'baseline',
            }}
          >
            pts
          </span>
        </span>
      </div>

      {/* SUBTITLE — linha separada abaixo, indentada pra alinhar com o nome */}
      {!isEmpty && (
        <p
          style={{
            marginTop: 8,
            paddingLeft: 70 + 16,  // largura do rank (70) + gap (16)
            fontSize: 13,
            lineHeight: 1.4,
            color: subtitleColor,
          }}
        >
          {entry.exact_scores} placar{entry.exact_scores !== 1 ? 'es' : ''} ·{' '}
          {entry.correct_results} resultado{entry.correct_results !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// PodiumRowSmall — top 4-5 (e fora do top 5)
// ════════════════════════════════════════════════════════════════

const PodiumRowSmall: React.FC<{
  rank: number;
  entry: BolaoRankingEntry | null;
  isMe?: boolean;
}> = ({ rank, entry, isMe }) => {
  const isEmpty = !entry;

  const containerStyle: React.CSSProperties =
    isMe && !isEmpty
      ? {
          background: 'rgba(10, 61, 46, 0.06)',
          borderRadius: 12,
          padding: '14px 24px',
        }
      : {
          padding: '14px 24px',
          borderBottom: `1px solid ${C_LINE}`,
          opacity: isEmpty ? 0.45 : 1,
        };

  return (
    <div className="flex items-center gap-4" style={containerStyle}>
      <span
        style={{
          display: 'inline-block',
          fontSize: 28,
          fontWeight: 600,
          color: C_AMBER_2,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          minWidth: 40,
          textAlign: 'center',
          paddingBottom: 4,
        }}
      >
        {rank}
      </span>

      <p
        className="flex-1 min-w-0"
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: isEmpty ? C_INK_3 : C_INK,
          fontStyle: isEmpty ? 'italic' : 'normal',
          letterSpacing: '-0.01em',
          lineHeight: 1.6,
          margin: 0,
          paddingTop: 3,
          paddingBottom: 3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {isEmpty ? 'Aguardando jogador' : entry.user_name}
      </p>

      <span
        style={{
          display: 'inline-block',
          fontSize: 28,
          fontWeight: 800,
          color: isEmpty ? C_INK_3 : C_INK,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          paddingBottom: 4,
        }}
      >
        {entry?.total_points ?? 0}
      </span>
    </div>
  );
};
