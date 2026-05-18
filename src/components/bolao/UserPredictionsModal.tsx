import React, { useMemo, useState } from 'react';
import {
  Trophy,
  Target,
  CheckCircle,
  Crosshair,
  Award,
  Medal,
  Crown,
  Flag,
  ListChecks,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import {
  useBolaoPredictions,
  useWcMatches,
  useChampionPredictions,
  useUserSpecialPredictions,
} from '@/hooks/use-bolao';
import type {
  BolaoRankingEntry,
  WcMatch,
  BolaoPrediction,
} from '@/services/bolao.service';

interface UserPredictionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bolaoId: string;
  user: BolaoRankingEntry | null;
  isCurrentUser?: boolean;
}

type TabId = 'jogos' | 'especiais';

const SPECIAL_META: Record<
  'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_32',
  { label: string; icon: React.ComponentType<{ className?: string }>; max: number }
> = {
  finalist:        { label: 'Finalistas',          icon: Trophy, max: 2 },
  semifinalist:    { label: 'Semifinalistas',      icon: Flag,   max: 4 },
  quarterfinalist: { label: 'Quartas de final',    icon: Flag,   max: 8 },
  round_of_32:     { label: 'Mata-mata (16 avos)', icon: Target, max: 32 },
};

function formatRichDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const formatted = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="w-4 h-4 text-amber" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-ink-3" />;
  if (rank === 3) return <Award className="w-4 h-4 text-status-warning" />;
  return null;
}

/**
 * Modal "Boletim do jogador" — exibe palpites de um usuário no bolão.
 * Tabs: Jogos (palpites por data) e Especiais (campeão, finalistas, semis...).
 */
export const UserPredictionsModal: React.FC<UserPredictionsModalProps> = ({
  open,
  onOpenChange,
  bolaoId,
  user,
  isCurrentUser,
}) => {
  const [tab, setTab] = useState<TabId>('jogos');

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 flex flex-col rounded-rebrand-xl">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-4 shrink-0 border-b border-line bg-white">
          <div className="flex items-start gap-3 pr-8 min-w-0">
            <div className="w-10 h-10 rounded-rebrand-md bg-canvas-2 border border-line flex items-center justify-center shrink-0">
              <RankIcon rank={Number(user.rank)} />
              {Number(user.rank) > 3 && (
                <span className="text-[13px] font-bold text-ink-2 tabular-nums">
                  {user.rank}º
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3 mb-0.5">
                {user.rank}º lugar · Boletim de palpites
              </p>
              <DialogTitle className="font-display text-[18px] sm:text-[22px] font-bold text-ink leading-tight truncate">
                {user.user_name}
                {isCurrentUser && (
                  <span className="text-[12px] sm:text-[13px] text-ink-2 font-normal ml-1.5">
                    (você)
                  </span>
                )}
              </DialogTitle>
            </div>
          </div>

          {/* Stats agregadas — 2 cols no mobile, 4 cols em desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            <StatPill label="Pontos" value={user.total_points ?? 0} highlight />
            <StatPill label="Palpites" value={user.total_predictions ?? 0} />
            <StatPill
              label="Exatos"
              value={user.exact_scores ?? 0}
              icon={<Crosshair className="w-3 h-3" />}
            />
            <StatPill
              label="Acertos"
              value={user.correct_results ?? 0}
              icon={<Target className="w-3 h-3" />}
            />
          </div>

          {/* Tabs */}
          <div role="tablist" className="flex items-center gap-1 mt-4 -mb-px">
            <TabButton
              active={tab === 'jogos'}
              onClick={() => setTab('jogos')}
              icon={<ListChecks className="w-3.5 h-3.5" />}
            >
              Jogos
            </TabButton>
            <TabButton
              active={tab === 'especiais'}
              onClick={() => setTab('especiais')}
              icon={<Crown className="w-3.5 h-3.5" />}
            >
              Especiais
            </TabButton>
          </div>
        </DialogHeader>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto minimal-scrollbar px-5 sm:px-6 py-5">
          {tab === 'jogos' ? (
            <JogosTab bolaoId={bolaoId} userId={user.user_id} />
          ) : (
            <EspeciaisTab bolaoId={bolaoId} userId={user.user_id} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 px-3.5 h-9 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors border-b-2 ${
      active
        ? 'border-forest text-forest'
        : 'border-transparent text-ink-3 hover:text-ink-2'
    }`}
  >
    {icon}
    {children}
  </button>
);

const StatPill: React.FC<{
  label: string;
  value: number;
  highlight?: boolean;
  icon?: React.ReactNode;
}> = ({ label, value, highlight, icon }) => (
  <div
    className={`rounded-rebrand-sm border px-2.5 py-1.5 text-center ${
      highlight ? 'border-forest/30 bg-forest/[0.06]' : 'border-line bg-canvas-2'
    }`}
  >
    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-2 inline-flex items-center gap-1 justify-center">
      {icon}
      {label}
    </p>
    <p
      className={`text-[16px] font-bold tabular-nums leading-tight ${
        highlight ? 'text-forest' : 'text-ink'
      }`}
    >
      {value}
    </p>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// Tab: Jogos
// ─────────────────────────────────────────────────────────────────

const JogosTab: React.FC<{ bolaoId: string; userId: string }> = ({ bolaoId, userId }) => {
  const { data: predictions, isLoading: loadingPreds } = useBolaoPredictions(bolaoId, userId);
  const { data: matches } = useWcMatches();

  const predsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  const visibleGroups = useMemo(() => {
    if (!matches) return [] as { date: string; items: { match: WcMatch; pred: BolaoPrediction | undefined }[] }[];
    const grouped: Record<string, { match: WcMatch; pred: BolaoPrediction | undefined }[]> = {};
    for (const match of matches) {
      const pred = predsByMatch.get(match.id);
      // Mostra só jogos com palpite OU jogo finalizado
      if (!pred && !match.is_finished) continue;
      if (match.home_team_code === 'TBD' && !pred) continue;
      if (!grouped[match.match_date]) grouped[match.match_date] = [];
      grouped[match.match_date].push({ match, pred });
    }
    return Object.keys(grouped)
      .sort()
      .map((date) => ({ date, items: grouped[date] }));
  }, [matches, predsByMatch]);

  if (loadingPreds) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-rebrand-md bg-canvas-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (visibleGroups.length === 0) {
    return (
      <div className="text-center py-12 text-ink-3">
        <Trophy className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-[13px]">Nenhum palpite registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {visibleGroups.map((group) => (
        <div key={group.date}>
          <h3 className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-2 mb-2">
            {formatRichDate(group.date)}
          </h3>
          <div className="bg-white border border-line rounded-rebrand-md divide-y divide-line overflow-hidden">
            {group.items.map(({ match, pred }) => (
              <PredictionRow key={match.id} match={match} pred={pred} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const PredictionRow: React.FC<{ match: WcMatch; pred: BolaoPrediction | undefined }> = ({
  match,
  pred,
}) => {
  const time = match.match_time_brasilia.slice(0, 5);
  const finished = match.is_finished;
  const hasPred = !!pred;
  const points = pred?.points_earned ?? null;

  const pointsBadge = (() => {
    if (!finished) return null;
    if (!hasPred) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-rebrand-sm bg-canvas-2 text-ink-3 font-medium whitespace-nowrap">
          Não palpitou
        </span>
      );
    }
    if (points == null || points === 0) {
      return (
        <span className="text-[10px] px-2 py-0.5 rounded-rebrand-sm bg-canvas-2 text-ink-3 font-bold tabular-nums whitespace-nowrap">
          0 pts
        </span>
      );
    }
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-rebrand-sm bg-status-success/[0.12] text-status-success font-bold tabular-nums inline-flex items-center gap-1 whitespace-nowrap">
        <CheckCircle className="w-2.5 h-2.5" strokeWidth={3} />+{points} pts
      </span>
    );
  })();

  return (
    <div className="px-3 sm:px-4 py-3">
      {/* ── Mobile: layout vertical empilhado ───────────────────── */}
      <div className="flex sm:hidden flex-col gap-2">
        {/* Topo: hora + pts/status */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink tabular-nums">{time}</span>
          {pointsBadge}
        </div>

        {/* Time A (palpite + real) */}
        <TeamScoreRow
          flagCode={match.home_team_code}
          name={match.home_team}
          predicted={hasPred ? pred.predicted_home_score : null}
          real={finished ? match.home_score : null}
        />

        {/* Time B */}
        <TeamScoreRow
          flagCode={match.away_team_code}
          name={match.away_team}
          predicted={hasPred ? pred.predicted_away_score : null}
          real={finished ? match.away_score : null}
        />

        {!hasPred && !finished && (
          <p className="text-[11px] text-ink-3 italic text-center">— sem palpite —</p>
        )}
      </div>

      {/* ── Desktop: 1 linha (layout original) ──────────────────── */}
      <div className="hidden sm:flex items-center gap-3">
        <div className="w-14 shrink-0 text-[11px] text-ink-2 tabular-nums leading-tight">
          <div className="font-medium text-ink">{time}</div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
          <span className="text-[13px] text-ink truncate">{match.home_team}</span>
          <TeamFlag code={match.home_team_code} size="sm" />
        </div>

        <div className="flex flex-col items-center shrink-0 min-w-[70px]">
          {hasPred ? (
            <span className="text-[14px] font-bold text-ink tabular-nums leading-none">
              {pred.predicted_home_score}
              <span className="text-ink-3 mx-1">×</span>
              {pred.predicted_away_score}
            </span>
          ) : (
            <span className="text-[12px] text-ink-3 italic">— sem palpite —</span>
          )}
          {finished && match.home_score != null && match.away_score != null && (
            <span className="text-[10px] text-ink-3 tabular-nums leading-none mt-1">
              real:{' '}
              <span className="font-semibold text-ink-2">
                {match.home_score}×{match.away_score}
              </span>
            </span>
          )}
        </div>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <TeamFlag code={match.away_team_code} size="sm" />
          <span className="text-[13px] text-ink truncate">{match.away_team}</span>
        </div>

        <div className="shrink-0 w-20 text-right">{pointsBadge}</div>
      </div>
    </div>
  );
};

/** Linha "Time + bandeira + palpite (e real, se finalizado)" — usado no mobile. */
const TeamScoreRow: React.FC<{
  flagCode: string;
  name: string;
  predicted: number | null;
  real: number | null | undefined;
}> = ({ flagCode, name, predicted, real }) => {
  const realDiffersFromPred = real != null && predicted != null && real !== predicted;
  return (
    <div className="flex items-center gap-2.5">
      <TeamFlag code={flagCode} size="sm" />
      <span className="flex-1 text-[13px] text-ink truncate">{name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {predicted != null ? (
          <span className="w-8 h-8 inline-flex items-center justify-center text-[15px] font-bold text-ink tabular-nums bg-canvas-2 rounded-rebrand-sm border border-line">
            {predicted}
          </span>
        ) : (
          <span className="w-8 h-8 inline-flex items-center justify-center text-[14px] text-ink-3 bg-canvas-2 rounded-rebrand-sm border border-line">
            —
          </span>
        )}
        {real != null && (
          <span
            className={`text-[10px] tabular-nums shrink-0 w-8 text-center ${
              realDiffersFromPred ? 'text-ink-3' : 'text-status-success font-bold'
            }`}
          >
            real {real}
          </span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Tab: Especiais
// ─────────────────────────────────────────────────────────────────

const EspeciaisTab: React.FC<{ bolaoId: string; userId: string }> = ({ bolaoId, userId }) => {
  const { data: championPicks } = useChampionPredictions(bolaoId);
  const { data: specialPreds, isLoading } = useUserSpecialPredictions(bolaoId, userId);
  const { data: matches } = useWcMatches();

  const championPick = useMemo(
    () => championPicks?.find((p) => p.user_id === userId)?.predicted_team_code ?? null,
    [championPicks, userId]
  );

  const championPoints = useMemo(
    () => championPicks?.find((p) => p.user_id === userId)?.points_earned ?? null,
    [championPicks, userId]
  );

  const teamMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!matches) return m;
    for (const match of matches) {
      if (match.home_team_code && match.home_team_code !== 'TBD')
        m.set(match.home_team_code, match.home_team);
      if (match.away_team_code && match.away_team_code !== 'TBD')
        m.set(match.away_team_code, match.away_team);
    }
    return m;
  }, [matches]);

  const picksByType = useMemo(() => {
    const map: Record<
      'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_32',
      { code: string; points: number | null }[]
    > = {
      finalist: [],
      semifinalist: [],
      quarterfinalist: [],
      round_of_32: [],
    };
    for (const p of specialPreds || []) {
      if (p.prediction_type in map) {
        map[p.prediction_type as keyof typeof map].push({
          code: p.predicted_team_code,
          points: p.points_earned,
        });
      }
    }
    return map;
  }, [specialPreds]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-rebrand-md bg-canvas-2 animate-pulse" />
        ))}
      </div>
    );
  }

  const hasAnything =
    championPick ||
    Object.values(picksByType).some((arr) => arr.length > 0);

  if (!hasAnything) {
    return (
      <div className="text-center py-12 text-ink-3">
        <Crown className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-[13px]">
          Nenhum palpite especial registrado ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Campeão */}
      {championPick && (
        <div className="rounded-rebrand-lg border-2 border-amber/50 bg-amber/[0.10] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-rebrand-md bg-amber text-white flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-2">
                Palpite de campeão
              </p>
              <p className="text-[13px] font-semibold text-ink leading-tight">
                Quem ele acha que ganha a Copa
              </p>
            </div>
            <PointsBadge points={championPoints} variant="big" />
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-rebrand-md bg-white border-2 border-amber">
            <TeamFlag code={championPick} size="lg" />
            <div className="min-w-0">
              <p className="font-mono font-bold text-[14px] text-ink leading-tight">
                {championPick} · {teamMap.get(championPick) ?? championPick}
              </p>
              <p className="text-[10px] text-ink-2">Selecionado como campeão</p>
            </div>
          </div>
        </div>
      )}

      {/* Brackets */}
      {(Object.keys(SPECIAL_META) as Array<keyof typeof SPECIAL_META>).map((stage) => {
        const meta = SPECIAL_META[stage];
        const picks = picksByType[stage];
        if (picks.length === 0) return null;
        const Icon = meta.icon;
        return (
          <div
            key={stage}
            className="rounded-rebrand-md border border-line bg-white overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
              <div className="w-9 h-9 rounded-rebrand-sm bg-canvas-2 text-ink-2 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink leading-tight">
                  {meta.label}
                </p>
                <p className="text-[11px] text-ink-2 leading-tight mt-0.5">
                  {picks.length} de {meta.max}
                </p>
              </div>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {picks.map(({ code, points }) => (
                <SpecialPickCard
                  key={code}
                  code={code}
                  name={teamMap.get(code) ?? code}
                  points={points}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Aviso quando nenhum stage tem ainda */}
      {!championPick &&
        Object.values(picksByType).every((arr) => arr.length === 0) && (
          <p className="text-[12px] text-ink-3 text-center py-4">
            Sem palpites especiais ainda.
          </p>
        )}
    </div>
  );
};

const SpecialPickCard: React.FC<{ code: string; name: string; points: number | null }> = ({
  code,
  name,
  points,
}) => {
  const earned = points != null && points > 0;
  return (
    <div
      className={`flex items-center gap-2 p-2.5 rounded-rebrand-sm border ${
        earned ? 'border-status-success/30 bg-status-success/[0.06]' : 'border-line bg-canvas-2/40'
      }`}
    >
      <TeamFlag code={code} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-ink truncate font-mono">{code}</p>
        <p className="text-[10px] text-ink-2 truncate leading-tight">{name}</p>
      </div>
      {earned && (
        <span className="text-[9px] font-bold text-status-success tabular-nums whitespace-nowrap">
          +{points}
        </span>
      )}
    </div>
  );
};

const PointsBadge: React.FC<{ points: number | null; variant?: 'big' | 'small' }> = ({
  points,
  variant = 'small',
}) => {
  if (points == null || points === 0) return null;
  return (
    <span
      className={`shrink-0 ml-auto rounded-rebrand-sm bg-status-success/[0.12] text-status-success font-bold tabular-nums inline-flex items-center gap-1 ${
        variant === 'big' ? 'text-[12px] px-2.5 py-1' : 'text-[10px] px-2 py-0.5'
      }`}
    >
      <CheckCircle className={variant === 'big' ? 'w-3 h-3' : 'w-2.5 h-2.5'} strokeWidth={3} />
      +{points} pts
    </span>
  );
};
