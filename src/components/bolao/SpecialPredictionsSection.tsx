import React, { useMemo, useState } from 'react';
import { Crown, ChevronDown, Check, Lock, Search, X, Trophy, Flag, Target } from 'lucide-react';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { useAchievement } from '@/components/bolao/AchievementProvider';
import {
  useMySpecialPredictions,
  useSpecialSummary,
  useToggleSpecialPrediction,
  useBolaoPredictions,
  useSetRoundOf32FromProjection,
  useBracketAdvance,
  useUpsertChampionPrediction,
} from '@/hooks/use-bolao';
import { computeGroupProjection, type PredictionMap } from '@/components/bolao/group-projection';
import { isSpecialLocked, formatDeadlineLabel } from '@/components/bolao/special-deadlines';
import { KnockoutBracket } from '@/components/bolao/KnockoutBracket';
import { nextStageOf, type BracketPicks, type ResolvedMatch } from '@/components/bolao/bracket';
import { List, GitFork } from 'lucide-react';
import type { WcMatch, SpecialDeadlinesConfig } from '@/services/bolao.service';
import { useToast } from '@/hooks/use-toast';

type SpecialType = 'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_16' | 'round_of_32';

interface PointsConfig {
  finalist: number;
  semifinalist: number;
  quarterfinalist: number;
  round_of_16: number;
  round_of_32: number;
}

interface Props {
  bolaoId: string;
  isPremium: boolean;
  matches: WcMatch[];
  /** Usuário logado — pra projetar os grupos a partir dos palpites de jogo DELE. */
  currentUserId?: string;
  enabledTypes?: Record<string, boolean>;
  pointsConfig?: PointsConfig;
  /** Time já escolhido como campeão — pinned como finalista (não removível por aqui). */
  championPick?: string | null;
  /**
   * Callback disparado quando o user faz seu primeiro pick (em qualquer fase) e ainda
   * não tem campeão definido. Parent pode auto-sugerir esse time como campeão.
   */
  onSuggestChampion?: (teamCode: string) => void;
  /** Config de prazo dos especiais (preset + overrides) — pra badges e lock. */
  specialDeadlines?: SpecialDeadlinesConfig | null;
  /**
   * Modo "mata-mata por jogo real" ligado: esconde o funil de projeção. O
   * palpite de placar dos jogos reais vai pra aba de Jogos. O palpite de
   * Campeão continua (é renderizado pelo Modal, fora desta seção).
   */
  knockoutRealMode?: boolean;
}

const TYPE_META: Record<
  SpecialType,
  { label: string; sublabel: string; max: number; icon: React.ComponentType<{ className?: string }> }
> = {
  // Ordem de funil: 16 avos (mais inclusivo) → Final. Cada fase filtra pra anterior.
  round_of_32: { label: '16 avos de final', sublabel: 'Escolha 32 seleções', max: 32, icon: Target },
  round_of_16: { label: 'Oitavas de final', sublabel: 'Escolha 16 das suas 32', max: 16, icon: Flag },
  quarterfinalist: { label: 'Quartas de final', sublabel: 'Escolha 8 das suas 16', max: 8, icon: Flag },
  semifinalist: { label: 'Semifinalistas', sublabel: 'Escolha 4 das suas 8', max: 4, icon: Flag },
  finalist: { label: 'Finalistas', sublabel: 'Escolha 2 das suas 4', max: 2, icon: Trophy },
};

/** Fase "pai" (mais inclusiva) — o seletor de cada fase mostra só os picks do pai. */
const PARENT_STAGE: Partial<Record<SpecialType, SpecialType>> = {
  round_of_16: 'round_of_32',
  quarterfinalist: 'round_of_16',
  semifinalist: 'quarterfinalist',
  finalist: 'semifinalist',
};

function extractTeams(matches: WcMatch[]) {
  const map = new Map<string, string>();
  for (const m of matches) {
    if (m.home_team_code && m.home_team_code !== 'TBD') map.set(m.home_team_code, m.home_team);
    if (m.away_team_code && m.away_team_code !== 'TBD') map.set(m.away_team_code, m.away_team);
  }
  return Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const ProgressIndicator: React.FC<{ filled: number; total: number }> = ({ filled, total }) => {
  if (total > 12) {
    // Mata-mata (32) — barra horizontal
    return (
      <div className="w-28 h-1.5 rounded-full bg-canvas-2 overflow-hidden">
        <div className="h-full bg-forest transition-all" style={{ width: `${(filled / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full border ${
            i < filled ? 'bg-forest border-forest' : 'border-line bg-transparent'
          }`}
        />
      ))}
    </div>
  );
};

interface BracketCardProps {
  type: SpecialType;
  bolaoId: string;
  myPicks: string[];
  summaryCounts: Map<string, number>;
  teams: { code: string; name: string }[];
  pointsLabel: string;
  /** Times bloqueados aqui porque já estão em fase posterior (campeão / finalista / etc). */
  pinnedCodes?: string[];
  /** Time que é especificamente o campeão — recebe ícone de coroa em vez de cadeado. */
  championCode?: string | null;
  defaultOpen?: boolean;
  /** Callback chamado após adicionar um pick (não chamado em remoção). Parent cascateia pra fases anteriores. */
  onAfterAdd?: (teamCode: string) => void;
  /** Label da fase "pai" — mostrado quando o seletor está vazio (pai não preenchido). */
  parentLabel?: string;
  /** Prazo já encerrado — trava os toggles deste card. */
  locked?: boolean;
  /** Rótulo do prazo, ex "fecha 28/06 16h" ou "encerrado". */
  deadlineLabel?: string | null;
}

const BracketCard: React.FC<BracketCardProps> = ({
  type,
  bolaoId,
  myPicks,
  summaryCounts,
  teams,
  pointsLabel,
  parentLabel,
  pinnedCodes,
  championCode,
  defaultOpen,
  onAfterAdd,
  locked: cardLocked,
  deadlineLabel,
}) => {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(defaultOpen ?? false);
  const toggle = useToggleSpecialPrediction();
  const { toast } = useToast();
  const { unlock } = useAchievement();

  const filtered = useMemo(() => {
    if (!search) return teams;
    const q = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [teams, search]);

  const isLocked = (code: string) => (pinnedCodes ?? []).includes(code);

  const handleToggle = (code: string) => {
    if (cardLocked) {
      toast({ title: 'Prazo encerrado', description: `Os palpites de ${meta.label.toLowerCase()} já fecharam.` });
      return;
    }
    const isPicked = myPicks.includes(code);
    if (isPicked && isLocked(code)) {
      toast({
        title: code === championCode ? 'Esse é seu palpite de campeão' : 'Esse time está em fase posterior',
        description: code === championCode
          ? 'Pra remover daqui, troque o campeão antes.'
          : 'Pra remover, primeiro tire ele da fase posterior (campeão/finalista/semi/quarta).',
      });
      return;
    }
    if (!isPicked && myPicks.length >= meta.max) {
      toast({ title: `Máximo de ${meta.max} seleções para ${meta.label}`, variant: 'destructive' });
      return;
    }
    const wasFirstAnyPick = myPicks.length === 0;
    const willCompleteFinalists =
      type === 'finalist' && !isPicked && myPicks.length + 1 >= meta.max;
    toggle.mutate(
      { bolaoId, predictionType: type, teamCode: code },
      {
        onSuccess: () => {
          if (wasFirstAnyPick) unlock('first-special-pick', bolaoId);
          if (willCompleteFinalists) unlock('all-finalists-picked', bolaoId);
          if (!isPicked) onAfterAdd?.(code);
        },
        onError: (err: any) =>
          toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const filled = myPicks.length;

  return (
    <div
      className={`rounded-rebrand-md border bg-white overflow-hidden transition-colors ${
        open ? 'border-forest/40' : 'border-line'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-canvas-2 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-rebrand-sm bg-canvas-2 text-ink-2 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink leading-tight">{meta.label}</p>
            <p className="text-[11px] text-ink-2 leading-tight mt-0.5">
              {meta.sublabel} · <span className="text-forest font-semibold">{pointsLabel}</span>
              {deadlineLabel && (
                <>
                  {' · '}
                  <span className={cardLocked ? 'text-status-danger font-semibold' : 'text-ink-3'}>
                    {cardLocked ? 'encerrado' : deadlineLabel}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ProgressIndicator filled={filled} total={meta.max} />
          <span className="text-[12px] tabular-nums text-ink-2 font-semibold">
            {filled}/{meta.max}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-ink-3 shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-line">
          {myPicks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pb-3 border-b border-line">
              {myPicks.map((code) => {
                const t = teams.find((x) => x.code === code);
                if (!t) return null;
                const locked = isLocked(code);
                const isChampion = code === championCode;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => handleToggle(code)}
                    disabled={locked}
                    aria-label={
                      locked
                        ? `${t.name} (fixo por fase posterior)`
                        : `Remover ${t.name} dos meus palpites`
                    }
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-rebrand-sm border text-[11px] font-semibold transition-colors ${
                      locked
                        ? 'border-amber bg-amber/[0.20] text-amber-2 cursor-not-allowed'
                        : 'border-amber/50 bg-amber/[0.12] text-amber-2 hover:border-amber hover:bg-amber/[0.22]'
                    }`}
                  >
                    <TeamFlag code={t.code} size="sm" />
                    {t.code}
                    {locked ? (
                      isChampion ? <Crown className="w-3 h-3" /> : <Lock className="w-3 h-3" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {teams.length === 0 ? (
            <p className="text-[12px] text-ink-2 text-center py-6 leading-snug">
              {parentLabel ? (
                <>Preencha primeiro os times de <span className="font-semibold text-ink">{parentLabel}</span> — eles aparecem aqui pra você afunilar.</>
              ) : (
                'Nenhuma seleção disponível.'
              )}
            </p>
          ) : (
          <>
          <div className="relative my-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-3 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar entre as ${teams.length} seleções…`}
              aria-label={`Buscar seleção em ${meta.label}`}
              className="w-full h-10 pl-9 pr-3 rounded-rebrand-md border border-line bg-canvas-2 text-[12px] text-ink placeholder:text-ink-3 focus:bg-white focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-72 overflow-y-auto minimal-scrollbar pr-1">
            {filtered.map((team) => {
              const picked = myPicks.includes(team.code);
              const locked = picked && isLocked(team.code);
              const isChampion = team.code === championCode;
              const count = summaryCounts.get(team.code) ?? 0;
              return (
                <button
                  key={team.code}
                  type="button"
                  onClick={() => handleToggle(team.code)}
                  disabled={toggle.isPending || cardLocked}
                  aria-label={`${picked ? 'Remover' : 'Escolher'} ${team.name} para ${meta.label}`}
                  aria-pressed={picked}
                  className={`relative flex flex-col items-center gap-1 p-2.5 min-h-[78px] rounded-rebrand-sm border text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 ${
                    picked
                      ? 'border-amber bg-amber/[0.10] ring-2 ring-amber/30'
                      : 'border-line bg-white hover:border-line-2 hover:bg-canvas-2'
                  }`}
                >
                  {picked && (
                    <span
                      className={`absolute top-1 right-1 w-4 h-4 rounded-full text-white flex items-center justify-center ${
                        locked ? 'bg-amber-2' : 'bg-amber'
                      }`}
                    >
                      {locked ? (
                        isChampion ? (
                          <Crown className="w-2.5 h-2.5" />
                        ) : (
                          <Lock className="w-2.5 h-2.5" />
                        )
                      ) : (
                        <Check className="w-2.5 h-2.5" />
                      )}
                    </span>
                  )}
                  <TeamFlag code={team.code} size="md" />
                  <span className="font-mono font-bold text-[11px] text-ink mt-0.5">{team.code}</span>
                  <span className="text-[10px] text-ink-2 leading-tight line-clamp-1">{team.name}</span>
                  {count > 0 && (
                    <span className="text-[9px] text-ink-3 tabular-nums">
                      {count} pick{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-[12px] text-ink-3 py-6">
                Nenhuma seleção encontrada
              </p>
            )}
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
};

export const SpecialPredictionsSection: React.FC<Props> = ({
  bolaoId,
  isPremium,
  matches,
  currentUserId,
  enabledTypes,
  pointsConfig,
  championPick,
  onSuggestChampion,
  specialDeadlines,
  knockoutRealMode,
}) => {
  const { data: myPreds } = useMySpecialPredictions(bolaoId);
  const { data: summary } = useSpecialSummary(bolaoId);
  const cascadeToggle = useToggleSpecialPrediction();

  // Projeção dos grupos a partir dos palpites de JOGO do usuário → auto-fill dos 16 avos.
  const { data: myMatchPreds } = useBolaoPredictions(bolaoId, currentUserId);
  const setR32 = useSetRoundOf32FromProjection();
  const { toast: projToast } = useToast();
  const [confirmingR32, setConfirmingR32] = useState(false);
  const projection = useMemo(() => {
    if (!matches || !currentUserId) return null;
    const predMap: PredictionMap = {};
    for (const p of myMatchPreds || []) {
      if (p.predicted_home_score != null && p.predicted_away_score != null) {
        predMap[p.match_id] = { home: p.predicted_home_score, away: p.predicted_away_score };
      }
    }
    return computeGroupProjection(matches, predMap);
  }, [matches, myMatchPreds, currentUserId]);

  const handleApplyProjection = () => {
    if (!projection?.qualifiers.length) return;
    setR32.mutate(
      { bolaoId, codes: projection.qualifiers },
      {
        onSuccess: (r) => {
          setConfirmingR32(false);
          projToast({ title: `16 avos preenchidos`, description: `${r.count} seleções a partir da sua projeção.` });
        },
        onError: (err: any) =>
          projToast({ title: 'Erro', description: err?.message ?? 'Tente novamente', variant: 'destructive' }),
      }
    );
  };

  // Visualização: lista (cards por fase) ou chaveamento (bracket clicável).
  const [view, setView] = useState<'lista' | 'bracket'>('lista');
  const bracketAdvance = useBracketAdvance();
  const upsertChampion = useUpsertChampionPrediction();

  const teams = useMemo(() => extractTeams(matches), [matches]);

  // Prazos por fase (rolável por rodada). Servidor é a autoridade; aqui só
  // mostramos o prazo e travamos a UI quando passa.
  const deadlineInfo = useMemo(() => {
    const types: SpecialType[] = ['round_of_32', 'round_of_16', 'quarterfinalist', 'semifinalist', 'finalist'];
    const locked: Record<string, boolean> = {};
    const label: Record<string, string | null> = {};
    for (const t of types) {
      locked[t] = isSpecialLocked(t, matches, specialDeadlines, Date.now(), knockoutRealMode);
      label[t] = formatDeadlineLabel(t, matches, specialDeadlines, Date.now(), knockoutRealMode);
    }
    return { locked, label };
  }, [matches, specialDeadlines, knockoutRealMode]);

  const myPicksByType = useMemo(() => {
    const map: Record<string, string[]> = {
      finalist: [],
      semifinalist: [],
      quarterfinalist: [],
      round_of_16: [],
      round_of_32: [],
    };
    for (const p of myPreds || []) {
      if (p.prediction_type in map && p.predicted_team_code) map[p.prediction_type].push(p.predicted_team_code);
    }
    return map;
  }, [myPreds]);

  /** Times bloqueados em cada fase porque já estão em fase posterior. */
  const pinnedByStage = useMemo(() => {
    const ch = championPick ? [championPick] : [];
    const fi = myPicksByType.finalist || [];
    const se = myPicksByType.semifinalist || [];
    const qu = myPicksByType.quarterfinalist || [];
    const r16 = myPicksByType.round_of_16 || [];
    const dedup = (arr: string[]) => Array.from(new Set(arr));
    return {
      finalist: dedup(ch),
      semifinalist: dedup([...ch, ...fi]),
      quarterfinalist: dedup([...ch, ...fi, ...se]),
      round_of_16: dedup([...ch, ...fi, ...se, ...qu]),
      round_of_32: dedup([...ch, ...fi, ...se, ...qu, ...r16]),
    };
  }, [championPick, myPicksByType]);

  /**
   * Quando o user adiciona X numa fase, cascateia X pra todas as fases
   * anteriores (mais inclusivas). Ex: adicionou X nas semis → também vai pras
   * quartas e mata-mata 32 se houver vaga e a fase estiver habilitada.
   */
  const handleAfterAdd = (type: SpecialType, teamCode: string) => {
    const HIERARCHY: SpecialType[] = ['finalist', 'semifinalist', 'quarterfinalist', 'round_of_16', 'round_of_32'];
    const idx = HIERARCHY.indexOf(type);
    if (idx === -1) return;
    const stagesBelow = HIERARCHY.slice(idx + 1);
    for (const lower of stagesBelow) {
      if (enabledTypes?.[lower] === false) continue;
      const currentPicks = myPicksByType[lower] || [];
      const max = TYPE_META[lower].max;
      if (!currentPicks.includes(teamCode) && currentPicks.length < max) {
        cascadeToggle.mutate({ bolaoId, predictionType: lower, teamCode });
      }
    }
    // Sem campeão definido? Sugere esse time. Parent decide se aceita.
    if (!championPick) {
      onSuggestChampion?.(teamCode);
    }
  };

  const summaryByType = useMemo(() => {
    const map: Record<string, Map<string, number>> = {
      finalist: new Map(),
      semifinalist: new Map(),
      quarterfinalist: new Map(),
      round_of_16: new Map(),
      round_of_32: new Map(),
    };
    for (const s of summary || []) {
      if (s.prediction_type in map) map[s.prediction_type].set(s.predicted_team_code, s.pick_count);
    }
    return map;
  }, [summary]);

  // Merge com defaults — bolões criados antes das Oitavas não têm round_of_16 no points.
  const pts: PointsConfig = { finalist: 10, semifinalist: 5, quarterfinalist: 3, round_of_16: 2, round_of_32: 1, ...(pointsConfig ?? {}) };
  const POINTS_LABEL: Record<SpecialType, string> = {
    finalist: `+${pts.finalist} pts cada`,
    semifinalist: `+${pts.semifinalist} pts cada`,
    quarterfinalist: `+${pts.quarterfinalist} pts cada`,
    round_of_16: `+${pts.round_of_16} pts cada`,
    round_of_32: `+${pts.round_of_32} pt cada`,
  };

  // Picks no formato do bracket + handler de avanço (clicar no vencedor).
  const bracketPicks: BracketPicks = {
    round_of_16: myPicksByType.round_of_16 || [],
    quarterfinalist: myPicksByType.quarterfinalist || [],
    semifinalist: myPicksByType.semifinalist || [],
    finalist: myPicksByType.finalist || [],
    champion: championPick ?? null,
  };
  const bracketBusy = bracketAdvance.isPending || upsertChampion.isPending;
  const handleAdvance = (match: ResolvedMatch, winnerCode: string) => {
    const ns = nextStageOf(match.stage);
    if (!ns) return;
    // No modo real, o campeão é mantido como o pessoal escolheu no início — o
    // clique na final NÃO altera o campeão (ele segue no card lá em cima).
    if (knockoutRealMode && ns === 'champion') return;
    if (isSpecialLocked(ns, matches, specialDeadlines, Date.now(), knockoutRealMode)) {
      projToast({ title: 'Prazo encerrado', description: 'Os palpites desta fase já fecharam.' });
      return;
    }
    const loser = match.home.code === winnerCode ? match.away.code : match.home.code;
    const onError = (err: any) =>
      projToast({ title: 'Erro', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
    if (ns === 'champion') {
      upsertChampion.mutate({ bolaoId, teamCode: winnerCode }, { onError });
    } else {
      bracketAdvance.mutate({ bolaoId, winner: winnerCode, loser: loser ?? '', nextStage: ns }, { onError });
    }
  };
  const canBracket = !!projection?.complete;

  // Modo "chaveamento com times reais": os 16 avos já saem com os times REAIS
  // que se classificaram. O jogador clica em quem avança em cada confronto, dos
  // 16 avos até a final + campeão. Janela curta — trava no início do mata-mata.
  if (knockoutRealMode) {
    const koLabel = deadlineInfo.label.round_of_32;
    const koLocked = deadlineInfo.locked.round_of_32;
    return (
      <div className="space-y-3">
        <div className="rounded-rebrand-md border border-line bg-canvas-2 p-3">
          <p className="text-[12px] text-ink leading-snug">
            <span className="font-semibold">Chaveamento com times reais.</span>{' '}
            Clique no time que avança em cada confronto, dos 16 avos até a final.
            O campeão segue o que você já escolheu lá em cima.{' '}
            {koLocked ? (
              <span className="font-semibold text-status-danger">Prazo encerrado.</span>
            ) : koLabel ? (
              <>Você palpita até o início do mata-mata (<span className="font-semibold">{koLabel.replace('fecha ', '')}</span>).</>
            ) : null}
          </p>
        </div>
        <KnockoutBracket
          matches={matches}
          projection={projection}
          picks={bracketPicks}
          onAdvance={koLocked ? undefined : handleAdvance}
          busy={bracketBusy}
          realMode
        />
      </div>
    );
  }

  // Palpites Especiais agora são liberados pra todo bolão (Free e Premium).
  // A diferença Premium vs Free é APENAS quantidade de participantes (>20).
  return (
    <div className="space-y-3">
      {/* Auto-preenchimento dos 16 avos a partir da projeção dos palpites de grupo */}
      {projection && (enabledTypes?.round_of_32 !== false) && (
        projection.complete ? (
          <div className="rounded-rebrand-md border border-forest/30 bg-forest/[0.06] p-3">
            {!confirmingR32 ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[12px] text-ink leading-snug min-w-0">
                  <span className="font-semibold">Seus palpites de grupo classificam 32 seleções.</span>{' '}
                  <span className="text-ink-2">Preencher os 16 avos com elas?</span>
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmingR32(true)}
                  disabled={deadlineInfo.locked.round_of_32}
                  title={deadlineInfo.locked.round_of_32 ? 'Prazo dos 16 avos encerrado' : undefined}
                  className="shrink-0 h-9 px-3.5 rounded-rebrand-md bg-forest text-white text-[12px] font-semibold hover:bg-forest-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deadlineInfo.locked.round_of_32 ? '16 avos encerrados' : 'Usar projeção nos 16 avos'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[12px] text-ink-2 leading-snug min-w-0">
                  Isso <span className="font-semibold text-ink">substitui</span> seus 16 avos atuais pelas 32 da projeção.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmingR32(false)}
                    className="h-9 px-3 rounded-rebrand-md border border-line text-[12px] font-semibold text-ink-2 hover:bg-canvas-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyProjection}
                    disabled={setR32.isPending}
                    className="h-9 px-3.5 rounded-rebrand-md bg-forest text-white text-[12px] font-semibold hover:bg-forest-2 disabled:opacity-50"
                  >
                    {setR32.isPending ? 'Aplicando…' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-ink-3 px-1 leading-snug">
            Palpite todos os jogos de grupo pra preencher os 16 avos automaticamente a partir da projeção.
          </p>
        )
      )}

      {/* Toggle Lista | Chaveamento (bracket só com a projeção completa) */}
      <div className="flex items-center gap-1 p-0.5 rounded-rebrand-md bg-canvas-2 w-fit">
        <button
          type="button"
          onClick={() => setView('lista')}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-rebrand-sm text-[12px] font-semibold transition-colors ${
            view === 'lista' ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <List className="w-3.5 h-3.5" /> Lista
        </button>
        <button
          type="button"
          onClick={() => canBracket && setView('bracket')}
          disabled={!canBracket}
          title={canBracket ? undefined : 'Complete os palpites de grupo pra montar o chaveamento'}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-rebrand-sm text-[12px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            view === 'bracket' ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <GitFork className="w-3.5 h-3.5 rotate-90" /> Chaveamento
        </button>
      </div>

      {view === 'bracket' && canBracket && projection ? (
        <KnockoutBracket
          matches={matches}
          projection={projection}
          picks={bracketPicks}
          onAdvance={handleAdvance}
          busy={bracketBusy}
        />
      ) : (
      <>
      {(Object.keys(TYPE_META) as SpecialType[])
        .filter((type) => !enabledTypes || enabledTypes[type] !== false)
        .map((type, idx) => {
          // Funil: cada fase só lista os times escolhidos na fase anterior (pai).
          // União com os picks próprios garante que picks legados sempre apareçam.
          //
          // Pai EFETIVO = ancestral HABILITADO mais próximo. Se o dono desligou a
          // fase-pai estrutural, sobe na cadeia até achar uma habilitada; se nenhuma
          // estiver habilitada, a fase abre para todas as seleções (parent = null).
          // Sem isso, desligar uma fase do meio deixava as de baixo sem pool de
          // candidatos — deadlock em "preencha primeiro X" apontando pra fase oculta.
          let parent = PARENT_STAGE[type];
          while (parent && enabledTypes && enabledTypes[parent] === false) {
            parent = PARENT_STAGE[parent];
          }
          const stageTeams = parent
            ? teams.filter((t) => {
                const pool = new Set([...(myPicksByType[parent] || []), ...(myPicksByType[type] || [])]);
                return pool.has(t.code);
              })
            : teams;
          return (
            <BracketCard
              key={type}
              type={type}
              bolaoId={bolaoId}
              myPicks={myPicksByType[type] || []}
              summaryCounts={summaryByType[type] || new Map()}
              teams={stageTeams}
              pointsLabel={POINTS_LABEL[type]}
              pinnedCodes={pinnedByStage[type]}
              championCode={championPick ?? null}
              defaultOpen={idx === 0}
              onAfterAdd={(teamCode) => handleAfterAdd(type, teamCode)}
              parentLabel={parent ? TYPE_META[parent].label : undefined}
              locked={deadlineInfo.locked[type]}
              deadlineLabel={deadlineInfo.label[type]}
            />
          );
        })}
      </>
      )}
    </div>
  );
};
