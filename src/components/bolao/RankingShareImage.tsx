import React, { forwardRef } from 'react';
import type { BolaoRankingEntry, ChampionPrediction } from '@/services/bolao.service';

interface RankingShareImageProps {
  bolaoName: string;
  inviteCode: string;
  ranking: BolaoRankingEntry[];
  currentUserId?: string;
  myChampionPick?: ChampionPrediction | null;
  /** "top5" (pódio) | "all" (classificação geral compacta). Default top5. */
  mode?: 'top5' | 'all';
}

// ════════════════════════════════════════════════════════════════
// Paleta "Dark Stadium" — verde-mata + dourado (Copa)
// ════════════════════════════════════════════════════════════════
const C_BG_GRAD  = 'radial-gradient(120% 80% at 50% 0%, #0d5440 0%, #062318 60%, #03150e 100%)';
const C_CREAM    = '#f4f1e8';
const C_WHITE    = '#ffffff';
const C_GREEN_MUT = '#9fc3b3';   // textos secundários / subtítulos
const C_GOLD     = '#d4a017';
const C_GOLD_LT  = '#e9c766';
const C_GOLD_MUT = '#cbb06a';    // ranks 2..5
const C_LINE     = 'rgba(255,255,255,0.09)';
const C_LINE_2   = 'rgba(255,255,255,0.06)';
const C_GOLD_CARD = 'linear-gradient(90deg, rgba(212,160,23,0.18), rgba(212,160,23,0.04))';

const FONT = '"Manrope", system-ui, -apple-system, sans-serif';

/** Largura do número de rank — usada pra indentar o subtítulo sob o nome. */
const RANK_W = 64;
const ROW_GAP = 26;

/** Quantas linhas cabem no modo "all" antes de truncar com "+N jogadores". */
const ALL_MAX_ROWS = 15;

/** Métrica de acerto corrigida: cravar o placar conta como cravada E acerto. */
function metricsLabel(entry: BolaoRankingEntry): string {
  const cravadas = entry.exact_scores ?? 0;
  const acertos = (entry.exact_scores ?? 0) + (entry.correct_results ?? 0);
  return `${cravadas} cravada${cravadas !== 1 ? 's' : ''} · ${acertos} acerto${acertos !== 1 ? 's' : ''}`;
}

/**
 * Card 1080×1080 (feed) do ranking do bolão. Renderizado off-screen e
 * capturado via html2canvas → PNG. Estilo "Dark Stadium" (verde + dourado) /
 * Manrope (Google Fonts no index.html, sem dependência npm).
 *
 * É uma imagem impessoal (pra compartilhar): NÃO destaca o usuário logado.
 *
 * Alinhamento: cada linha é uma TOP-ROW (rank · nome · pontos, items-center) com
 * o subtítulo numa linha separada abaixo, indentado sob o nome — assim os
 * números ficam centrados com o nome, não puxados pra baixo pelo subtítulo.
 * Anti-clip html2canvas: line-height folgado + padding vertical nos textos.
 */
export const RankingShareImage = forwardRef<HTMLDivElement, RankingShareImageProps>(
  ({ bolaoName, inviteCode, ranking, mode = 'top5' }, ref) => {
    return (
      <div
        ref={ref}
        className="absolute -left-[9999px] top-0 w-[1080px] h-[1080px] flex flex-col overflow-hidden"
        style={{ background: C_BG_GRAD, color: C_CREAM, fontFamily: FONT, padding: 72 }}
      >
        <Header bolaoName={bolaoName} />
        {mode === 'all' ? <AllList ranking={ranking} /> : <Top5List ranking={ranking} />}
        <FooterUrl inviteCode={inviteCode} />
      </div>
    );
  }
);

RankingShareImage.displayName = 'RankingShareImage';

// ════════════════════════════════════════════════════════════════
// Header / Eyebrow / Footer
// ════════════════════════════════════════════════════════════════

const Header: React.FC<{ bolaoName: string }> = ({ bolaoName }) => (
  <header className="flex items-center justify-between" style={{ marginBottom: 30, gap: 24 }}>
    <span
      style={{
        fontSize: 52,
        fontWeight: 800,
        color: C_WHITE,
        letterSpacing: '-0.02em',
        lineHeight: 1.6,
        paddingTop: 14,
        paddingBottom: 14,
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
        border: '1.5px solid rgba(212,160,23,0.45)',
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

const Top5List: React.FC<{ ranking: BolaoRankingEntry[] }> = ({ ranking }) => {
  const filled: (BolaoRankingEntry | null)[] = ranking.slice(0, 5);
  while (filled.length < 5) filled.push(null);

  return (
    <>
      <Eyebrow text="RANKING · TOP 5" />
      <div className="flex flex-col" style={{ flex: 1, gap: 6 }}>
        {filled.map((entry, idx) => (
          <Top5Row key={entry?.user_id ?? `empty-${idx}`} rank={idx + 1} entry={entry} />
        ))}
      </div>
    </>
  );
};

const Top5Row: React.FC<{ rank: number; entry: BolaoRankingEntry | null }> = ({ rank, entry }) => {
  const isEmpty = !entry;
  const isFirst = rank === 1 && !isEmpty;

  const cardStyle: React.CSSProperties = isFirst
    ? { background: C_GOLD_CARD, border: '1.5px solid rgba(212,160,23,0.4)', borderRadius: 16, padding: '22px 28px' }
    : { padding: '18px 28px', borderBottom: `1px solid ${C_LINE}` };

  return (
    <div style={{ opacity: isEmpty ? 0.35 : 1, ...cardStyle }}>
      {/* TOP-ROW: rank · nome · pontos — todos numa linha, centrados */}
      <div className="flex items-center" style={{ gap: ROW_GAP }}>
        <span
          style={{
            fontSize: isFirst ? 54 : 40,
            fontWeight: 800,
            color: isFirst ? C_GOLD : C_GOLD_MUT,
            minWidth: RANK_W,
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rank}
        </span>
        <p
          className="flex-1 min-w-0"
          style={{
            fontSize: isFirst ? 34 : 30,
            fontWeight: isFirst ? 800 : 700,
            color: isEmpty ? C_GREEN_MUT : C_WHITE,
            letterSpacing: '-0.01em',
            margin: 0,
            lineHeight: 1.7,
            paddingTop: 10,
            paddingBottom: 10,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isEmpty ? 'Aguardando jogador' : entry.user_name}
        </p>
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
      {/* SUBTITLE: linha separada, indentada sob o nome */}
      {!isEmpty && (
        <p
          style={{
            marginTop: 4,
            paddingLeft: RANK_W + ROW_GAP,
            fontSize: 18,
            fontWeight: 500,
            color: C_GREEN_MUT,
            lineHeight: 1.4,
            paddingBottom: 2,
          }}
        >
          {metricsLabel(entry)}
        </p>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Todos (classificação geral compacta)
// ════════════════════════════════════════════════════════════════

const AllList: React.FC<{ ranking: BolaoRankingEntry[] }> = ({ ranking }) => {
  const total = ranking.length;
  const visible = ranking.slice(0, ALL_MAX_ROWS);
  const overflow = total - visible.length;

  return (
    <>
      <Eyebrow text={`CLASSIFICAÇÃO GERAL · ${total} ${total === 1 ? 'JOGADOR' : 'JOGADORES'}`} />
      <div className="flex flex-col" style={{ flex: 1 }}>
        {visible.map((entry) => (
          <AllRow key={entry.user_id} rank={Number(entry.rank)} entry={entry} />
        ))}
        {overflow > 0 && (
          <div style={{ padding: '14px 12px', color: C_GREEN_MUT, fontSize: 22, fontWeight: 600 }}>
            + {overflow} {overflow === 1 ? 'jogador' : 'jogadores'}
          </div>
        )}
      </div>
    </>
  );
};

const AllRow: React.FC<{ rank: number; entry: BolaoRankingEntry }> = ({ rank, entry }) => (
  <div
    className="flex items-center"
    style={{ gap: 20, padding: '13px 12px', borderBottom: `1px solid ${C_LINE_2}`, fontSize: 26 }}
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
        lineHeight: 1.7,
        paddingTop: 7,
        paddingBottom: 7,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {entry.user_name}
    </span>
    <span style={{ fontWeight: 800, color: C_WHITE, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
      {entry.total_points}
    </span>
  </div>
);
