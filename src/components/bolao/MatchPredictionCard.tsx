import React, { useState, useEffect, useRef } from 'react';
import { Lock, Check, MoreVertical, Trash2, Wand2, Loader2 } from 'lucide-react';
import type { WcMatch, BolaoPrediction } from '@/services/bolao.service';
import { isMatchLocked, isMatchPredictionLocked, computeMatchDeadline } from '@/hooks/use-bolao';
import { readDraft, writeDraft, clearDraft } from '@/components/bolao/useDraftPrediction';
import { generateQuickPickPredictions } from '@/components/bolao/quick-pick';
import { ScoreStepper } from '@/components/bolao/ScoreStepper';
import { TeamFlag } from '@/components/bolao/TeamFlag';

interface MatchPredictionCardProps {
  match: WcMatch;
  prediction?: BolaoPrediction;
  onSave: (matchId: number, homeScore: number, awayScore: number) => void;
  onDelete?: (matchId: number) => void;
  bolaoId?: string;
  deadlineMode?: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start';
  allMatches?: WcMatch[];
  isClosed?: boolean;
  enableSuggestion?: boolean;
  hideMatchDate?: boolean;
}

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved';

const AUTOSAVE_DEBOUNCE_MS = 500;
const SAVING_VISIBLE_MS = 1000;
const SAVED_VISIBLE_MS = 1500;

/**
 * Linha compacta de palpite — 1 linha por jogo.
 * Layout: hora · time-A · bandeira-A · input × input · bandeira-B · time-B · status
 *
 * Em mobile, os botões +/− do ScoreStepper aparecem (tap rápido).
 * Em desktop, os botões somem (sm:hidden) — só o input editável.
 *
 * Status à direita:
 *  - Locked: ícone Lock
 *  - Editando: "Editando..." (cinza, durante debounce)
 *  - Salvando: spinner + "Salvando"
 *  - Salvo: ✓ verde + "Salvo agora"
 *  - Sem palpite + enableSuggestion: link "Sugerir"
 *  - Idle com palpite: nada (linha verde sutil indica)
 */
export const MatchPredictionCard: React.FC<MatchPredictionCardProps> = ({
  match,
  prediction,
  onSave,
  onDelete,
  bolaoId,
  deadlineMode,
  allMatches,
  isClosed,
  enableSuggestion,
  hideMatchDate,
}) => {
  const locked = deadlineMode
    ? isMatchPredictionLocked(match, deadlineMode, allMatches, !!isClosed)
    : isMatchLocked(match);
  const deadline = deadlineMode
    ? computeMatchDeadline(match, deadlineMode, allMatches)
    : null;

  const initialHome = prediction?.predicted_home_score != null
    ? prediction.predicted_home_score.toString()
    : (bolaoId ? readDraft(bolaoId, match.id)?.home ?? '' : '');
  const initialAway = prediction?.predicted_away_score != null
    ? prediction.predicted_away_score.toString()
    : (bolaoId ? readDraft(bolaoId, match.id)?.away ?? '' : '');
  const [homeScore, setHomeScore] = useState<string>(initialHome);
  const [awayScore, setAwayScore] = useState<string>(initialAway);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const prevPredictionRef = useRef<BolaoPrediction | undefined>(prediction);
  useEffect(() => {
    const hadBefore = !!prevPredictionRef.current;
    if (prediction) {
      setHomeScore(prediction.predicted_home_score.toString());
      setAwayScore(prediction.predicted_away_score.toString());
    } else if (hadBefore) {
      setHomeScore('');
      setAwayScore('');
      if (bolaoId) clearDraft(bolaoId, match.id);
    }
    prevPredictionRef.current = prediction;
  }, [prediction, bolaoId, match.id]);

  const persistDraft = (home: string, away: string) => {
    if (!bolaoId || locked) return;
    if (home === '' && away === '') {
      clearDraft(bolaoId, match.id);
      return;
    }
    const matchesServer =
      prediction != null
      && home === String(prediction.predicted_home_score)
      && away === String(prediction.predicted_away_score);
    if (matchesServer) {
      clearDraft(bolaoId, match.id);
      return;
    }
    writeDraft(bolaoId, match.id, home, away);
  };

  const triggerAutosave = (h: string, a: string) => {
    if (locked || match.is_finished || isClosed) return;
    if (h === '' || a === '') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus('idle');
      return;
    }
    const homeNum = Number(h);
    const awayNum = Number(a);
    if (Number.isNaN(homeNum) || Number.isNaN(awayNum)) return;
    if (homeNum < 0 || awayNum < 0 || homeNum > 20 || awayNum > 20) return;
    if (
      prediction &&
      homeNum === prediction.predicted_home_score &&
      awayNum === prediction.predicted_away_score
    ) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSaveStatus('idle');
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveStatus('pending');

    debounceRef.current = setTimeout(() => {
      setSaveStatus('saving');
      onSave(match.id, homeNum, awayNum);
      savingTimerRef.current = setTimeout(() => {
        setSaveStatus((s) => (s === 'saving' ? 'saved' : s));
        savedTimerRef.current = setTimeout(() => {
          setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
        }, SAVED_VISIBLE_MS);
      }, SAVING_VISIBLE_MS);
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const handleHomeChange = (v: string) => {
    setHomeScore(v);
    persistDraft(v, awayScore);
    triggerAutosave(v, awayScore);
  };
  const handleAwayChange = (v: string) => {
    setAwayScore(v);
    persistDraft(homeScore, v);
    triggerAutosave(homeScore, v);
  };

  const handleSuggest = () => {
    const seed = (bolaoId ?? '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) + match.id;
    const [generated] = generateQuickPickPredictions([match], 'realist', { seed });
    if (!generated) return;
    const h = String(generated.predicted_home_score);
    const a = String(generated.predicted_away_score);
    setHomeScore(h);
    setAwayScore(a);
    persistDraft(h, a);
    triggerAutosave(h, a);
  };

  const matchDate = new Date(match.match_date + 'T00:00:00');
  const dateStr = matchDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const timeStr = match.match_time_brasilia.slice(0, 5);

  const hasPrediction = prediction != null;
  const hasInputs = homeScore !== '' && awayScore !== '';

  // Status à direita (1 elemento por vez)
  const statusContent = (() => {
    if (locked) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
          <Lock className="w-3 h-3" />
          Encerrado
        </span>
      );
    }
    if (saveStatus === 'pending') {
      return <span className="text-[11px] text-ink-3">Editando...</span>;
    }
    if (saveStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Salvando
        </span>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium text-status-success animate-in fade-in"
          role="status"
        >
          <Check className="w-3 h-3" strokeWidth={3} />
          Salvo agora
        </span>
      );
    }
    if (match.is_finished && prediction?.points_earned != null) {
      return (
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
            prediction.points_earned > 0
              ? 'bg-status-success/15 text-status-success'
              : 'bg-canvas-2 text-ink-3'
          }`}
        >
          {prediction.points_earned > 0 ? `+${prediction.points_earned} pts` : '0 pts'}
        </span>
      );
    }
    if (!hasInputs && enableSuggestion) {
      return (
        <button
          type="button"
          onClick={handleSuggest}
          className="inline-flex items-center gap-1 text-[11px] text-forest hover:text-forest-2 transition-colors"
        >
          <Wand2 className="w-3 h-3" />
          Sugerir
        </button>
      );
    }
    return null;
  })();

  /** Render do stepper ou placar finalizado (reusado em ambos os times). */
  const renderScoreSlot = (
    score: string,
    onChange: (v: string) => void,
    finalScore: number | null | undefined,
    teamCode: string,
    teamSide: 'mandante' | 'visitante'
  ) => {
    if (match.is_finished) {
      return (
        <span className="w-12 h-11 flex items-center justify-center text-[18px] font-bold text-ink tabular-nums bg-canvas-2 rounded-rebrand-md">
          {finalScore}
        </span>
      );
    }
    return (
      <ScoreStepper
        value={score}
        onChange={onChange}
        disabled={locked}
        ariaLabel={`Placar ${teamCode} (${teamSide})`}
      />
    );
  };

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors ${
        match.is_finished
          ? 'opacity-60'
          : locked
            ? 'opacity-60'
            : hasPrediction
              ? 'bg-forest/[0.04]'
              : 'hover:bg-canvas-2/40'
      }`}
    >
      {/* Mobile-only header: hora/data + status (sugerir/salvo) */}
      <div className="flex sm:hidden items-center justify-between min-w-0">
        <div className="text-[11px] tabular-nums leading-tight min-w-0">
          <span className="font-medium text-ink">{timeStr}</span>
          {!hideMatchDate && <span className="text-[10px] text-ink-3 ml-1.5">{dateStr}</span>}
        </div>
        <div className="shrink-0">{statusContent}</div>
      </div>

      {/* Mobile: layout vertical estilo "score card" — cada time numa linha
          com seu próprio placar à direita. × cinza no meio indica o confronto. */}
      <div className="flex sm:hidden flex-col mt-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TeamFlag code={match.home_team_code} size="md" />
            <span className="text-[13px] font-medium text-ink truncate">{match.home_team}</span>
          </div>
          <div className="shrink-0">
            {renderScoreSlot(homeScore, handleHomeChange, match.home_score, match.home_team_code, 'mandante')}
          </div>
        </div>
        <div className="text-center text-[12px] text-ink-3 font-medium leading-none my-1.5" aria-hidden="true">
          ×
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TeamFlag code={match.away_team_code} size="md" />
            <span className="text-[13px] font-medium text-ink truncate">{match.away_team}</span>
          </div>
          <div className="shrink-0">
            {renderScoreSlot(awayScore, handleAwayChange, match.away_score, match.away_team_code, 'visitante')}
          </div>
        </div>
      </div>

      {/* Desktop layout — 1 linha: hora · time A · scores · time B · status */}
      <div className="hidden sm:block w-16 shrink-0 text-[11px] text-ink-2 tabular-nums leading-tight">
        <div className="font-medium text-ink">{timeStr}</div>
        {!hideMatchDate && <div className="text-[10px] text-ink-3">{dateStr}</div>}
      </div>

      <div className="hidden sm:flex flex-1 items-center justify-end gap-2 min-w-0">
        <span className="text-[13px] text-ink truncate">{match.home_team}</span>
        <TeamFlag code={match.home_team_code} size="sm" />
        <span className="text-[10px] font-mono text-ink-3 tabular-nums w-7">
          {match.home_team_code}
        </span>
      </div>

      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {renderScoreSlot(homeScore, handleHomeChange, match.home_score, match.home_team_code, 'mandante')}
        <span className="text-[14px] text-ink-3 font-medium px-0.5">×</span>
        {renderScoreSlot(awayScore, handleAwayChange, match.away_score, match.away_team_code, 'visitante')}
      </div>

      <div className="hidden sm:flex flex-1 items-center gap-2 min-w-0">
        <span className="text-[10px] font-mono text-ink-3 tabular-nums w-7 text-right">
          {match.away_team_code}
        </span>
        <TeamFlag code={match.away_team_code} size="sm" />
        <span className="text-[13px] text-ink truncate">{match.away_team}</span>
      </div>

      <div className="hidden sm:flex w-32 shrink-0 items-center justify-end gap-2 text-right">
        {statusContent}
        {onDelete && hasPrediction && !locked && !match.is_finished && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Mais opções"
              aria-expanded={menuOpen}
              className="w-7 h-7 flex items-center justify-center rounded-rebrand-sm text-ink-3 hover:text-ink hover:bg-canvas-2 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 z-30 w-44 rounded-rebrand-md border border-line bg-white shadow-md overflow-hidden"
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(match.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[13px] text-status-danger hover:bg-status-danger/5 focus:bg-status-danger/5 focus:outline-none transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Apagar palpite
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
