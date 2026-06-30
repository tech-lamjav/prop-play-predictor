import React, { useMemo } from 'react';
import { ChevronRight, Clock, Check, AlertCircle, Circle, Target, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { computeMatchDeadline, useMySpecialPredictions } from '@/hooks/use-bolao';
import { specialDeadline, type SpecialDeadlineType } from '@/components/bolao/special-deadlines';
import type { Bolao, BolaoPrediction, WcMatch } from '@/services/bolao.service';

interface BolaoStatsTopCardsProps {
  bolao: Bolao;
  matches: WcMatch[] | undefined;
  predictions: BolaoPrediction[] | undefined;
  onContinuarPalpites: () => void;
  /** Abre o modal de Palpites Especiais (seleções). */
  onSpecialPicks?: () => void;
  /** Abre o modal de Palpites de Jogador. */
  onPlayerPicks?: () => void;
}

// Tiers de seleção do mata-mata — cada um fecha no início da rodada que o decide.
const TIER_FRONTS: { key: string; type: SpecialDeadlineType; label: string; max: number }[] = [
  { key: 'round_of_32', type: 'round_of_32', label: '16 avos', max: 32 },
  { key: 'round_of_16', type: 'round_of_16', label: 'Oitavas', max: 16 },
  { key: 'quarterfinalist', type: 'quarterfinalist', label: 'Quartas', max: 8 },
  { key: 'semifinalist', type: 'semifinalist', label: 'Semis', max: 4 },
  { key: 'finalist', type: 'finalist', label: 'Finalistas', max: 2 },
];

const PLAYER_AWARD_KEYS: SpecialDeadlineType[] = ['top_scorer', 'best_player', 'best_goalkeeper', 'best_young_player'];

/** Uma "frente" de palpite que fecha num prazo (jogos / jogador / um tier). */
interface PredictionFront {
  key: string;
  label: string;
  done: number;
  total: number;
  deadline: Date;
  cta: 'jogos' | 'especiais' | 'jogador';
}

const STAGE_LABELS: { key: WcMatch['stage']; label: string }[] = [
  { key: 'group', label: 'Fase de grupos' },
  { key: 'round_of_32', label: '16 avos' },
  { key: 'round_of_16', label: 'Oitavas' },
  { key: 'quarter', label: 'Quartas' },
  { key: 'semi', label: 'Semis' },
  { key: 'final', label: 'Final' },
];

/** Date → { day: 'Sáb 14/06', time: '16:00' } em BRT (pra âncora do prazo). */
function formatAnchorHeadline(d: Date): { day: string; time: string } {
  const dayRaw = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit',
  }).format(d).replace(/\./g, '');
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  }).format(d);
  return { day: dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1), time };
}

function countdownLabel(deadline: Date): string {
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return 'encerrado';
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) {
    const min = Math.max(1, Math.floor(diffMs / 60_000));
    return `em ${min}min`;
  }
  if (hours < 24) return `em ${hours}h`;
  const days = Math.floor(hours / 24);
  return `em ${days}d`;
}

export const BolaoStatsTopCards: React.FC<BolaoStatsTopCardsProps> = ({
  bolao,
  matches,
  predictions,
  onContinuarPalpites,
  onSpecialPicks,
  onPlayerPicks,
}) => {
  const { data: specialPreds } = useMySpecialPredictions(bolao.id);
  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  // Total palpitados / disponíveis no bolão inteiro
  const totalAvailable = useMemo(
    () => (matches || []).filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length,
    [matches]
  );
  const totalDone = useMemo(
    () =>
      (predictions || []).filter((p) => {
        const match = matches?.find((m) => m.id === p.match_id);
        return match && !match.is_finished && match.home_team_code !== 'TBD';
      }).length,
    [predictions, matches]
  );
  const pct = totalAvailable > 0 ? Math.round((totalDone / totalAvailable) * 100) : 0;

  // Breakdown por fase
  const stageBreakdown = useMemo(() => {
    if (!matches) return [];
    return STAGE_LABELS.map(({ key, label }) => {
      const stageMatches = matches.filter(
        (m) => m.stage === key && !m.is_finished && m.home_team_code !== 'TBD'
      );
      const total = stageMatches.length;
      const done = stageMatches.filter((m) => predictionsByMatch.has(m.id)).length;
      return { label, done, total };
    }).filter((s) => s.total > 0);
  }, [matches, predictionsByMatch]);

  // Próximo prazo + jogos.
  // Encerrar inscricoes (is_closed) NAO afeta palpites — quem ja entrou
  // continua palpitando ate o prazo de cada jogo. Por isso o calculo
  // ignora is_closed.
  const nextDeadlineGroup = useMemo(() => {
    if (!matches) return null;
    const mode = bolao.prediction_deadline_mode ?? 'per_match';
    const now = Date.now();

    // Pra cada match aberto (não finalizado, com times definidos), calcula o deadline
    type Entry = { match: WcMatch; deadline: Date };
    const upcoming: Entry[] = [];
    for (const m of matches) {
      if (m.is_finished) continue;
      if (m.home_team_code === 'TBD' || m.away_team_code === 'TBD') continue;
      const deadline = computeMatchDeadline(m, mode, matches);
      if (deadline.getTime() <= now) continue;
      upcoming.push({ match: m, deadline });
    }
    if (upcoming.length === 0) return null;

    // Encontra o menor deadline e agrupa todos os matches com mesmo deadline
    upcoming.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    const minDeadline = upcoming[0].deadline;
    const sameDeadline = upcoming.filter(
      (e) => Math.abs(e.deadline.getTime() - minDeadline.getTime()) < 60_000
    );

    // Quantos desses já foram palpitados pelo user
    const palpitated = sameDeadline.filter((e) => predictionsByMatch.has(e.match.id)).length;

    return {
      deadline: minDeadline,
      matches: sameDeadline.map((e) => e.match),
      palpitated,
    };
  }, [matches, bolao.prediction_deadline_mode, predictionsByMatch]);

  // Todas as frentes (jogos + jogador + tiers de mata-mata) que fecham no
  // MESMO instante do próximo prazo — pra o card dizer o QUE precisa ser
  // preenchido até cada data, não só "tem que palpitar".
  const nextDeadline = useMemo(() => {
    const now = Date.now();
    const cfg = bolao.special_deadlines ?? null;
    const ms = matches || [];

    // Contagem dos picks do usuário por tipo.
    const teamCounts: Record<string, number> = {};
    let playerPicked = 0;
    for (const p of specialPreds || []) {
      if (p.predicted_team_code) teamCounts[p.prediction_type] = (teamCounts[p.prediction_type] ?? 0) + 1;
      if (p.predicted_player_id && PLAYER_AWARD_KEYS.includes(p.prediction_type as SpecialDeadlineType)) playerPicked += 1;
    }

    const fronts: PredictionFront[] = [];

    // Jogos — frente do próximo deadline de jogo (já calculado).
    if (nextDeadlineGroup) {
      fronts.push({
        key: 'jogos',
        label: nextDeadlineGroup.matches.length > 1 ? 'Jogos da rodada' : 'Jogo',
        done: nextDeadlineGroup.palpitated,
        total: nextDeadlineGroup.matches.length,
        deadline: nextDeadlineGroup.deadline,
        cta: 'jogos',
      });
    }

    // Tiers de seleção do mata-mata (habilitados).
    if (bolao.special_predictions_enabled ?? true) {
      const sc = bolao.special_predictions_config as Record<string, boolean> | null | undefined;
      for (const t of TIER_FRONTS) {
        if (sc && sc[t.key] === false) continue;
        const d = specialDeadline(t.type, ms, cfg);
        if (!d || d.getTime() <= now) continue;
        fronts.push({ key: t.key, label: t.label, done: teamCounts[t.key] ?? 0, total: t.max, deadline: d, cta: 'especiais' });
      }
    }

    // Prêmios de jogador — agrupados numa frente só (0/N).
    const pae = bolao.player_awards_enabled as Record<string, boolean> | null | undefined;
    const enabledAwards = PLAYER_AWARD_KEYS.filter((k) => !pae || pae[k] !== false);
    if (enabledAwards.length > 0) {
      let earliest: Date | null = null;
      for (const k of enabledAwards) {
        const d = specialDeadline(k, ms, cfg);
        if (d && (!earliest || d.getTime() < earliest.getTime())) earliest = d;
      }
      if (earliest && earliest.getTime() > now) {
        fronts.push({
          key: 'jogador',
          label: 'Palpites de jogador',
          done: Math.min(playerPicked, enabledAwards.length),
          total: enabledAwards.length,
          deadline: earliest,
          cta: 'jogador',
        });
      }
    }

    if (fronts.length === 0) return null;

    // Âncora = menor prazo aberto; lista só as frentes que fecham nesse instante.
    const anchor = fronts.reduce((min, f) => (f.deadline.getTime() < min.getTime() ? f.deadline : min), fronts[0].deadline);
    const atAnchor = fronts.filter((f) => Math.abs(f.deadline.getTime() - anchor.getTime()) < 60_000);
    return { anchor, fronts: atAnchor };
  }, [bolao, matches, specialPreds, nextDeadlineGroup]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
      {/* ─── Esquerda: SEUS PALPITES ─── */}
      <div className="bg-white border border-line rounded-rebrand-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2">
            Seus palpites
          </p>
          <Button
            variant={totalDone >= totalAvailable && totalAvailable > 0 ? 'outline-forest' : 'forest'}
            size="sm"
            onClick={onContinuarPalpites}
            className="rounded-rebrand-md gap-1 h-8 px-3 text-[12px]"
          >
            {totalAvailable === 0
              ? 'Fazer palpites'
              : totalDone === 0
                ? 'Começar palpites'
                : totalDone < totalAvailable
                  ? 'Continuar palpites'
                  : 'Revisar palpites'}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-baseline gap-2 mb-3 tabular-nums">
          <span className="font-display text-[36px] sm:text-[40px] font-extrabold leading-none text-ink">
            {totalDone}
          </span>
          <span className="text-[16px] text-ink-2 font-medium">/ {totalAvailable}</span>
          <span className="text-[14px] text-ink-2 ml-1">· {pct}%</span>
        </div>

        <div className="h-2 bg-canvas-2 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full ${pct === 100 ? 'bg-status-success' : 'bg-forest'} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {stageBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stageBreakdown.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-rebrand-sm bg-canvas border border-line text-ink"
              >
                <span className="text-ink-2">{s.label}</span>
                <span className="font-semibold tabular-nums">
                  {s.done}/{s.total}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Direita: PRÓXIMO PRAZO ─── */}
      <div className="bg-forest text-white rounded-rebrand-xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-amber/10 pointer-events-none" />
        <div className="absolute right-16 top-12 w-20 h-20 rounded-full bg-amber/10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-60">
              Próximo prazo
            </p>
            {nextDeadline &&
              (() => {
                const pending = nextDeadline.fronts.filter((f) => f.done < f.total).length;
                if (pending === 0) {
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-status-success text-white shadow-sm">
                      <Check className="w-3 h-3" strokeWidth={3} />
                      Tudo certo
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber text-forest shadow-sm">
                    <AlertCircle className="w-3 h-3" />
                    {pending} pendente{pending !== 1 ? 's' : ''}
                  </span>
                );
              })()}
          </div>

          {nextDeadline ? (
            <>
              {(() => {
                const h = formatAnchorHeadline(nextDeadline.anchor);
                return (
                  <h3 className="font-display text-[28px] sm:text-[32px] font-extrabold leading-tight mb-2">
                    {h.day}
                    {' · '}
                    <span className="text-amber">{h.time}</span>
                  </h3>
                );
              })()}

              <div className="flex items-center gap-2 text-[12px] opacity-80 mb-4">
                <Clock className="w-3.5 h-3.5" />
                <span>{countdownLabel(nextDeadline.anchor)}</span>
                <span className="opacity-50">·</span>
                <span>fecha nessa data</span>
              </div>

              <ul className="space-y-2">
                {nextDeadline.fronts.map((f) => {
                  const done = f.done >= f.total;
                  const FrontIcon = f.cta === 'jogador' ? Star : Target;
                  const onCta =
                    f.cta === 'jogos' ? onContinuarPalpites : f.cta === 'jogador' ? onPlayerPicks : onSpecialPicks;
                  return (
                    <li key={f.key}>
                      <div className="flex items-center gap-2 text-[13px]">
                        {done ? (
                          <Check className="w-4 h-4 text-status-success shrink-0" strokeWidth={3} />
                        ) : (
                          <Circle className="w-4 h-4 text-amber shrink-0" />
                        )}
                        <FrontIcon className="w-3.5 h-3.5 opacity-70 shrink-0" />
                        <span className="font-semibold">{f.label}</span>
                        <span className="tabular-nums opacity-80">
                          {f.done}/{f.total}
                        </span>
                        {!done && onCta && (
                          <button
                            type="button"
                            onClick={onCta}
                            className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber text-forest hover:bg-amber/90 transition-colors"
                          >
                            Palpitar
                          </button>
                        )}
                      </div>

                      {/* Jogos: mini-lista dos confrontos da rodada */}
                      {f.cta === 'jogos' && nextDeadlineGroup && (
                        <ul className="mt-1.5 ml-6 space-y-1">
                          {nextDeadlineGroup.matches.slice(0, 4).map((m) => (
                            <li key={m.id} className="flex items-center gap-2 text-[12px] tabular-nums opacity-90">
                              <span className="opacity-60 w-11 shrink-0">{m.match_time_brasilia.slice(0, 5)}</span>
                              <TeamFlag code={m.home_team_code} size="sm" />
                              <span className="font-mono font-semibold w-9">{m.home_team_code}</span>
                              <span className="opacity-30 mx-0.5">×</span>
                              <span className="font-mono font-semibold w-9">{m.away_team_code}</span>
                              <TeamFlag code={m.away_team_code} size="sm" />
                            </li>
                          ))}
                          {nextDeadlineGroup.matches.length > 4 && (
                            <li className="text-[11px] opacity-60">
                              +{nextDeadlineGroup.matches.length - 4} jogo
                              {nextDeadlineGroup.matches.length - 4 !== 1 ? 's' : ''}
                            </li>
                          )}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-[14px] opacity-70">Sem prazos abertos no momento.</p>
          )}
        </div>
      </div>
    </div>
  );
};
