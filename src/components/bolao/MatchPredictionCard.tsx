import React, { useState, useEffect, useRef } from 'react';
import { Lock, Check, MoreVertical, Trash2 } from 'lucide-react';
import type { WcMatch, BolaoPrediction } from '@/services/bolao.service';
import { isMatchLocked, isMatchPredictionLocked, computeMatchDeadline } from '@/hooks/use-bolao';
import { readDraft, writeDraft, clearDraft } from '@/components/bolao/useDraftPrediction';

interface MatchPredictionCardProps {
  match: WcMatch;
  prediction?: BolaoPrediction;
  onSave: (matchId: number, homeScore: number, awayScore: number) => void;
  /** Optional — when present, shows menu with "Apagar palpite" option */
  onDelete?: (matchId: number) => void;
  isSaving?: boolean;
  // Bolão id for localStorage draft key (optional for backward compat)
  bolaoId?: string;
  // Optional — when passed, deadline is computed from bolão mode instead of kickoff
  deadlineMode?: 'per_match' | 'per_round' | 'tournament_start';
  allMatches?: WcMatch[];
  isClosed?: boolean;
}

export const MatchPredictionCard: React.FC<MatchPredictionCardProps> = ({
  match,
  prediction,
  onSave,
  onDelete,
  isSaving,
  bolaoId,
  deadlineMode,
  allMatches,
  isClosed,
}) => {
  const locked = deadlineMode
    ? isMatchPredictionLocked(match, deadlineMode, allMatches, !!isClosed)
    : isMatchLocked(match);
  const deadline = deadlineMode
    ? computeMatchDeadline(match, deadlineMode, allMatches)
    : null;

  // Initial values: server prediction first, then localStorage draft as fallback.
  const initialHome = prediction?.predicted_home_score != null
    ? prediction.predicted_home_score.toString()
    : (bolaoId ? readDraft(bolaoId, match.id)?.home ?? '' : '');
  const initialAway = prediction?.predicted_away_score != null
    ? prediction.predicted_away_score.toString()
    : (bolaoId ? readDraft(bolaoId, match.id)?.away ?? '' : '');
  const [homeScore, setHomeScore] = useState<string>(initialHome);
  const [awayScore, setAwayScore] = useState<string>(initialAway);
  const [saved, setSaved] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click + ESC
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

  // Sync from server when prediction arrives (after upsert success) OR
  // when prediction is deleted (clear inputs + draft, volta ao estado vazio).
  // Track previous prediction via ref pra distinguir "carregou agora" de "foi deletado".
  const prevPredictionRef = useRef<BolaoPrediction | undefined>(prediction);
  useEffect(() => {
    const hadBefore = !!prevPredictionRef.current;
    if (prediction) {
      setHomeScore(prediction.predicted_home_score.toString());
      setAwayScore(prediction.predicted_away_score.toString());
    } else if (hadBefore) {
      // Prediction existia e sumiu → foi deletada
      setHomeScore('');
      setAwayScore('');
      if (bolaoId) clearDraft(bolaoId, match.id);
    }
    prevPredictionRef.current = prediction;
  }, [prediction, bolaoId, match.id]);

  // Derived: there's an unsaved draft whenever the current values diverge
  // from the server (or no server value yet but user typed something).
  // Don't show "Rascunho" if locked or just-saved.
  const hasUnsavedDraft = !locked && !saved && (() => {
    if (homeScore === '' && awayScore === '') return false;
    if (!prediction) return true; // user typed without ever saving
    return homeScore !== String(prediction.predicted_home_score)
      || awayScore !== String(prediction.predicted_away_score);
  })();

  // Persist draft on every change (skip if locked or matches server)
  useEffect(() => {
    if (!bolaoId || locked) return;
    const matchesServer =
      prediction != null
      && homeScore === String(prediction.predicted_home_score)
      && awayScore === String(prediction.predicted_away_score);
    if (matchesServer) return;
    writeDraft(bolaoId, match.id, homeScore, awayScore);
  }, [bolaoId, match.id, homeScore, awayScore, locked, prediction]);

  const hasPrediction = prediction != null;
  const canSave =
    !locked &&
    homeScore !== '' &&
    awayScore !== '' &&
    Number(homeScore) >= 0 &&
    Number(awayScore) >= 0;

  const isDirty =
    !hasPrediction ||
    homeScore !== prediction?.predicted_home_score.toString() ||
    awayScore !== prediction?.predicted_away_score.toString();

  const handleSave = () => {
    if (!canSave || !isDirty) return;
    onSave(match.id, Number(homeScore), Number(awayScore));
    if (bolaoId) clearDraft(bolaoId, match.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const matchDate = new Date(match.match_date + 'T00:00:00');
  const dateStr = matchDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  const timeStr = match.match_time_brasilia.slice(0, 5);

  // Points display for finished matches
  const pointsDisplay =
    match.is_finished && prediction?.points_earned != null ? (
      <span
        className={`text-xs font-bold px-2 py-0.5 rounded ${
          prediction.points_earned > 0
            ? 'bg-terminal-green/20 text-terminal-green'
            : 'bg-terminal-dark-gray text-terminal-text/50'
        }`}
      >
        {prediction.points_earned > 0 ? `+${prediction.points_earned} pts` : '0 pts'}
      </span>
    ) : null;

  return (
    <div
      className={`border rounded p-3 transition-colors ${
        match.is_finished
          ? 'border-terminal-border-subtle bg-terminal-dark-gray/20 opacity-80'
          : locked
          ? 'border-terminal-border-subtle bg-terminal-dark-gray/10 opacity-60'
          : hasPrediction
          ? 'border-terminal-green/30 bg-terminal-green/5'
          : 'border-terminal-border hover:border-terminal-border/80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] opacity-50 uppercase">
            {match.group_name ? `Grupo ${match.group_name}` : match.stage}
          </span>
          {locked && <Lock className="w-3 h-3 opacity-40" />}
          {hasUnsavedDraft && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-yellow/15 text-terminal-yellow border border-terminal-yellow/30 font-medium"
              title="Rascunho não salvo — clique em Salvar"
            >
              Rascunho
            </span>
          )}
          {saved && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-green/20 text-terminal-green border border-terminal-green/40 font-medium flex items-center gap-1 animate-in fade-in"
              role="status"
            >
              <Check className="w-3 h-3" />
              Salvo
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pointsDisplay}
          <span className="text-[10px] opacity-50">
            {dateStr} {timeStr}
          </span>
          {onDelete && hasPrediction && !locked && !match.is_finished && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Mais opções do palpite"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="w-8 h-8 flex items-center justify-center rounded text-terminal-text/40 hover:text-terminal-text/90 hover:bg-terminal-gray/30 transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 z-30 w-44 rounded-lg border border-terminal-border bg-terminal-dark-gray shadow-xl overflow-hidden"
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(match.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-terminal-red hover:bg-terminal-red/10 focus:bg-terminal-red/10 focus:outline-none transition-colors"
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
      {/* Custom deadline indicator — only show when deadline differs from kickoff */}
      {!match.is_finished && deadline && deadlineMode && deadlineMode !== 'per_match' && (() => {
        const kickoff = new Date(`${match.match_date}T${match.match_time_brasilia}-03:00`);
        if (deadline.getTime() === kickoff.getTime()) return null;
        const d = deadline;
        const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        return (
          <p className="text-[10px] text-terminal-yellow/80 mb-2">
            Palpites até {label}
          </p>
        );
      })()}

      {/* Match */}
      <div className="flex items-center gap-2">
        {/* Home team */}
        <div className="flex-1 text-right">
          <span className="text-sm font-medium">{match.home_team}</span>
          <span className="text-[10px] opacity-40 ml-1">{match.home_team_code}</span>
        </div>

        {/* Score inputs or result */}
        {match.is_finished ? (
          <div className="flex items-center gap-1 px-2">
            <span className="w-8 text-center text-sm font-bold">{match.home_score}</span>
            <span className="text-xs opacity-40">x</span>
            <span className="w-8 text-center text-sm font-bold">{match.away_score}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-1">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="20"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              disabled={locked}
              aria-label={`Placar ${match.home_team_code} (mandante)`}
              className="w-12 h-11 text-center text-base font-bold bg-terminal-dark-gray border border-terminal-border rounded focus:border-terminal-green focus:outline-none focus:ring-1 focus:ring-terminal-green/40 disabled:opacity-40 text-terminal-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="-"
            />
            <span className="text-xs opacity-40">x</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="20"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              disabled={locked}
              aria-label={`Placar ${match.away_team_code} (visitante)`}
              className="w-12 h-11 text-center text-base font-bold bg-terminal-dark-gray border border-terminal-border rounded focus:border-terminal-green focus:outline-none focus:ring-1 focus:ring-terminal-green/40 disabled:opacity-40 text-terminal-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="-"
            />
          </div>
        )}

        {/* Away team */}
        <div className="flex-1">
          <span className="text-[10px] opacity-40 mr-1">{match.away_team_code}</span>
          <span className="text-sm font-medium">{match.away_team}</span>
        </div>
      </div>

      {/* Prediction display for finished matches */}
      {match.is_finished && hasPrediction && (
        <div className="mt-2 text-center">
          <span className="text-[10px] opacity-50">
            Seu palpite: {prediction.predicted_home_score} x {prediction.predicted_away_score}
          </span>
        </div>
      )}

      {/* Save button */}
      {!locked && !match.is_finished && isDirty && canSave && (
        <div className="mt-2 flex justify-center">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded hover:bg-terminal-green/30 transition-colors disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check className="w-3 h-3" /> Salvo
              </>
            ) : isSaving ? (
              'Salvando...'
            ) : (
              'Salvar palpite'
            )}
          </button>
        </div>
      )}

      {/* Venue */}
      <div className="mt-2 text-center">
        <span className="text-[10px] opacity-30">
          {match.venue} — {match.city}
        </span>
      </div>
    </div>
  );
};
