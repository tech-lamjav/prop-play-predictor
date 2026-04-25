import React, { useState, useEffect } from 'react';
import { Lock, Check } from 'lucide-react';
import type { WcMatch, BolaoPrediction } from '@/services/bolao.service';
import { isMatchLocked, isMatchPredictionLocked, computeMatchDeadline } from '@/hooks/use-bolao';

interface MatchPredictionCardProps {
  match: WcMatch;
  prediction?: BolaoPrediction;
  onSave: (matchId: number, homeScore: number, awayScore: number) => void;
  isSaving?: boolean;
  // Optional — when passed, deadline is computed from bolão mode instead of kickoff
  deadlineMode?: 'per_match' | 'per_round' | 'tournament_start';
  allMatches?: WcMatch[];
  isClosed?: boolean;
}

export const MatchPredictionCard: React.FC<MatchPredictionCardProps> = ({
  match,
  prediction,
  onSave,
  isSaving,
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
  const [homeScore, setHomeScore] = useState<string>(
    prediction?.predicted_home_score?.toString() ?? ''
  );
  const [awayScore, setAwayScore] = useState<string>(
    prediction?.predicted_away_score?.toString() ?? ''
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (prediction) {
      setHomeScore(prediction.predicted_home_score.toString());
      setAwayScore(prediction.predicted_away_score.toString());
    }
  }, [prediction]);

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
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        </div>
        <div className="flex items-center gap-2">
          {pointsDisplay}
          <span className="text-[10px] opacity-50">
            {dateStr} {timeStr}
          </span>
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
