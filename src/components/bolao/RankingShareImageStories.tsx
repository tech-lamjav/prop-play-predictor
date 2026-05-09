import React, { forwardRef } from 'react';
import type { BolaoRankingEntry, ChampionPrediction } from '@/services/bolao.service';

interface RankingShareImageStoriesProps {
  bolaoName: string;
  inviteCode: string;
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  myChampionPick?: ChampionPrediction | null;
}

// Constantes de cor (paleta "Direção A")
const C_CANVAS    = '#f6f7f5';
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
 * Variant Stories (1080×1920) do card de ranking — estilo "Editorial Light".
 *
 * Mesma arquitetura do feed: cada card tem 2 áreas (top-row alinhado +
 * subtitle separado abaixo). Princípio: lineHeight: 1 + items-center
 * pra alinhar caps automaticamente.
 *
 * Footer "VEM DISPUTAR" preserva URL + código de convite — porque quando
 * alguém posta a imagem nos próprios Stories, quem vê pode entrar no bolão.
 */
export const RankingShareImageStories = forwardRef<HTMLDivElement, RankingShareImageStoriesProps>(
  ({ bolaoName, inviteCode, ranking, currentUserId }, ref) => {
    const top5 = ranking.slice(0, 5);
    const filledTop5: (BolaoRankingEntry | null)[] = [...top5];
    while (filledTop5.length < 5) filledTop5.push(null);

    const myPosition = currentUserId ? ranking.find((r) => r.user_id === currentUserId) : null;
    const myInTop5 = top5.some((r) => r.user_id === currentUserId);

    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1920px] flex flex-col p-16 overflow-hidden"
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
        <div className="flex flex-col gap-4 mb-4">
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
        <div className="flex flex-col">
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

        <FooterCta inviteCode={inviteCode} />
      </div>
    );
  }
);

RankingShareImageStories.displayName = 'RankingShareImageStories';

// ════════════════════════════════════════════════════════════════
// Componentes do header / divider / footer
// ════════════════════════════════════════════════════════════════

const Header: React.FC = () => (
  <header className="flex items-center justify-between mb-10">
    {/* Pill com logo completo (já inclui o texto "Smart Betting") */}
    <span
      style={{
        display: 'inline-block',
        background: C_FOREST,
        padding: '14px 26px',
        borderRadius: 999,
        lineHeight: 0,
      }}
    >
      <img
        src="/logo.png"
        alt="Smart Betting"
        style={{
          display: 'block',
          height: 40,
          width: 'auto',
          objectFit: 'contain',
        }}
        crossOrigin="anonymous"
      />
    </span>
    <span
      style={{
        display: 'inline-block',
        fontSize: 13,
        fontWeight: 800,
        color: C_AMBER_2,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        background: C_AMBER_15,
        border: `2px solid ${C_AMBER_50}`,
        padding: '14px 24px',
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
      fontSize: 14,
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
      fontSize: 80,
      fontWeight: 900,
      color: C_INK,
      letterSpacing: '-0.028em',
      lineHeight: 1.18,
      paddingBottom: '20px',
      marginBottom: 28,
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      maxHeight: '320px',
      overflow: 'hidden',
    }}
  >
    {text}
  </h1>
);

const DividerWithLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-5 mb-7">
    <div style={{ flex: 1, height: 1.5, background: C_INK }} />
    <span
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: C_INK,
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
    <div style={{ flex: 1, height: 1.5, background: C_INK }} />
  </div>
);

const Divider: React.FC = () => (
  <div className="flex items-center justify-center gap-4 mt-5 mb-3" style={{ opacity: 0.4 }}>
    <div style={{ width: 32, height: 1, background: C_INK }} />
    <span style={{ fontSize: 12, letterSpacing: '0.3em', color: C_INK, fontWeight: 700 }}>
      •••
    </span>
    <div style={{ width: 32, height: 1, background: C_INK }} />
  </div>
);

const FooterCta: React.FC<{ inviteCode: string }> = ({ inviteCode }) => (
  <div
    className="mt-auto"
    style={{
      background: C_FOREST,
      borderRadius: 24,
      padding: '32px 40px',
    }}
  >
    <p
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: C_AMBER,
        letterSpacing: '0.4em',
        textTransform: 'uppercase',
        marginBottom: 10,
        lineHeight: 1.5,
      }}
    >
      Vem disputar
    </p>
    <p
      style={{
        fontSize: 26,
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: '0.02em',
        lineHeight: 1.4,
        marginBottom: 20,
      }}
    >
      smartbetting.app/bolao
    </p>
    <span
      style={{
        display: 'inline-block',
        background: C_AMBER,
        color: C_FOREST,
        padding: '18px 36px',
        borderRadius: 14,
        fontSize: 32,
        fontWeight: 900,
        letterSpacing: '0.16em',
        lineHeight: 1,
      }}
    >
      {inviteCode}
    </span>
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

  const cardStyle: React.CSSProperties =
    isMe && !isEmpty
      ? {
          background: C_FOREST,
          borderRadius: 20,
          padding: '24px 28px',
          color: '#ffffff',
        }
      : {
          background: C_CREAM,
          border: `2px solid ${C_AMBER_30}`,
          borderRadius: 20,
          padding: '24px 28px',
          opacity: isEmpty ? 0.45 : 1,
        };

  const numberColor   = isMe && !isEmpty ? C_AMBER : C_AMBER_2;
  const nameColor     = isMe && !isEmpty ? '#ffffff' : C_INK;
  const subtitleColor = isMe && !isEmpty ? 'rgba(255,255,255,0.65)' : C_INK_3;
  const ptsColor      = isMe && !isEmpty ? C_AMBER : C_INK;
  const ptsLabelColor = isMe && !isEmpty ? 'rgba(255,255,255,0.55)' : C_INK_3;

  return (
    <div style={cardStyle}>
      {/* TOP ROW — rank + nome + pontos */}
      <div className="flex items-center gap-5">
        <span
          style={{
            display: 'inline-block',
            fontSize: 80,
            fontWeight: 900,
            color: numberColor,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            minWidth: 100,
            textAlign: 'center',
          }}
        >
          {rank}
        </span>

        <p
          className="flex-1 min-w-0"
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: isEmpty ? subtitleColor : nameColor,
            fontStyle: isEmpty ? 'italic' : 'normal',
            letterSpacing: '-0.01em',
            lineHeight: 1.6,
            margin: 0,
            paddingTop: 5,
            paddingBottom: 5,
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
            fontSize: 80,
            fontWeight: 900,
            color: ptsColor,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            paddingBottom: 8,
          }}
        >
          {entry?.total_points ?? 0}
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: ptsLabelColor,
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              marginLeft: 10,
              verticalAlign: 'baseline',
            }}
          >
            pts
          </span>
        </span>
      </div>

      {/* SUBTITLE — placares · resultados, indentado pra alinhar com nome */}
      {!isEmpty && (
        <p
          style={{
            marginTop: 10,
            paddingLeft: 100 + 20,  // rank (100) + gap (20)
            fontSize: 16,
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
// PodiumRowSmall — top 4-5
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
          borderRadius: 14,
          padding: '18px 28px',
        }
      : {
          padding: '18px 28px',
          borderBottom: `1px solid ${C_LINE}`,
          opacity: isEmpty ? 0.45 : 1,
        };

  return (
    <div className="flex items-center gap-5" style={containerStyle}>
      <span
        style={{
          display: 'inline-block',
          fontSize: 36,
          fontWeight: 600,
          color: C_AMBER_2,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          minWidth: 60,
          textAlign: 'center',
          paddingBottom: 4,
        }}
      >
        {rank}
      </span>

      <p
        className="flex-1 min-w-0"
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: isEmpty ? C_INK_3 : C_INK,
          fontStyle: isEmpty ? 'italic' : 'normal',
          letterSpacing: '-0.01em',
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
          fontSize: 36,
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
