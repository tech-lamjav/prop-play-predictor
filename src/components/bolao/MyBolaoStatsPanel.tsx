import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Trophy,
  Target,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import {
  useMyBolaoPersonalStats,
  useBolaoRanking,
  useMyTeamHeatmap,
  useVersusStats,
} from '@/hooks/use-bolao';
import { TeamFlag } from './TeamFlag';
import type { PersonalPersonalityData } from '@/services/bolao.service';

interface Props {
  bolaoId: string;
  currentUserId: string | undefined;
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-rebrand-md border border-line bg-white">
      <div className="text-ink-3 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">{label}</p>
        <p className="text-lg font-bold leading-tight tabular-nums text-ink">{value}</p>
        {sub && <p className="text-[10px] text-ink-3 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function derivePersonalityLabel(data: PersonalPersonalityData | null | undefined): {
  label: string;
  description: string;
} {
  if (!data || data.total === 0) {
    return {
      label: 'Sem palpites suficientes',
      description: 'Faça palpites pra descobrir seu estilo.',
    };
  }
  const t = data.total;
  const pctDraws = data.draws / t;
  const pctHigh = data.high_scoring / t;
  const pctLow = data.low_scoring / t;
  const pctBlow = data.blowouts / t;
  const pctTight = data.tight / t;

  if (pctDraws >= 0.25) {
    return {
      label: 'Pacificador',
      description: `${Math.round(pctDraws * 100)}% dos seus palpites são empates.`,
    };
  }
  if (pctBlow >= 0.25) {
    return {
      label: 'Audaz',
      description: `${Math.round(pctBlow * 100)}% dos seus jogos terminam com goleada.`,
    };
  }
  if (pctHigh >= 0.4) {
    return {
      label: 'Otimista',
      description: `${Math.round(pctHigh * 100)}% dos jogos com 4+ gols.`,
    };
  }
  if (pctLow >= 0.4) {
    return {
      label: 'Cético',
      description: `${Math.round(pctLow * 100)}% dos seus jogos com 0 ou 1 gol.`,
    };
  }
  if (pctTight >= 0.4) {
    return {
      label: 'Equilibrista',
      description: `${Math.round(pctTight * 100)}% dos seus jogos terminam com 1 gol de diferença.`,
    };
  }
  return {
    label: 'Realista',
    description: 'Seus palpites são distribuídos sem padrão dominante.',
  };
}

export const MyBolaoStatsPanel: React.FC<Props> = ({ bolaoId, currentUserId }) => {
  const { data: personalStats, isLoading: loadingPersonal } = useMyBolaoPersonalStats(bolaoId);
  const { data: ranking } = useBolaoRanking(bolaoId);
  const { data: heatmap, isLoading: loadingHeatmap } = useMyTeamHeatmap(bolaoId);
  const [opponentId, setOpponentId] = useState<string | undefined>(undefined);
  const { data: versus, isLoading: loadingVersus } = useVersusStats(
    bolaoId,
    opponentId,
    !!opponentId
  );

  const myRankEntry = useMemo(
    () => ranking?.find((r) => r.user_id === currentUserId),
    [ranking, currentUserId]
  );

  const opponents = useMemo(
    () => (ranking || []).filter((r) => r.user_id !== currentUserId),
    [ranking, currentUserId]
  );

  if (loadingPersonal) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-rebrand-md border border-line bg-canvas-2 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!personalStats || personalStats.total_predictions === 0) {
    return (
      <div className="text-center py-8 text-ink-3">
        <Target className="w-8 h-8 mx-auto mb-2" />
        <p className="text-[13px]">Faça seus primeiros palpites para ver suas estatísticas</p>
      </div>
    );
  }

  const personality = derivePersonalityLabel(personalStats.personality_data);

  const evolutionChartData = (personalStats.evolution || []).map((p, idx) => ({
    idx: idx + 1,
    label: `${p.home}×${p.away}`,
    fullDate: p.match_date,
    cumulative: p.cumulative,
    points: p.points,
  }));

  return (
    <div className="space-y-5">
      {/* Header — current rank + points */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <StatCard
          icon={<Trophy className="w-4 h-4" />}
          label="Sua posição"
          value={myRankEntry ? `${myRankEntry.rank}º` : '—'}
          sub={ranking ? `de ${ranking.length}` : undefined}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Seus pontos"
          value={personalStats.total_points}
        />
        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="Placares exatos"
          value={personalStats.exact_scores}
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="% acerto"
          value={`${personalStats.accuracy_pct}%`}
          sub={`${personalStats.correct_results}/${personalStats.finished_with_pred} encerrados`}
        />
      </div>

      {/* Evolução */}
      {evolutionChartData.length > 0 && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 mb-3">
            Evolução de pontos
          </p>
          <div className="rounded-rebrand-md border border-line bg-white p-3">
            <div style={{ height: 180 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionChartData}>
                  <defs>
                    <linearGradient id="colorMyPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0a3d2e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0a3d2e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3e6e0" vertical={false} />
                  <XAxis
                    dataKey="idx"
                    stroke="#8a8f86"
                    tick={{ fill: '#4a4f48', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    stroke="#8a8f86"
                    tick={{ fill: '#4a4f48', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e3e6e0',
                      borderRadius: '10px',
                      color: '#1a1d1a',
                      fontSize: '11px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    itemStyle={{ color: '#0a3d2e' }}
                    formatter={(value: number, _name, ctx: any) => [
                      `${value} pts`,
                      ctx?.payload?.label ?? 'Acumulado',
                    ]}
                    labelFormatter={(_label, payload: any) =>
                      payload && payload[0]?.payload?.fullDate
                        ? payload[0].payload.fullDate
                        : ''
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#0a3d2e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorMyPoints)"
                    animationDuration={400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Personalidade */}
      <div>
        <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 mb-3">
          Seu estilo
        </p>
        <div className="p-4 rounded-rebrand-md border border-line bg-white">
          <p className="text-base font-bold text-forest">{personality.label}</p>
          <p className="text-[12px] text-ink-2 mt-1">{personality.description}</p>
        </div>
      </div>

      {/* Heatmap por seleção */}
      <div>
        <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 mb-3">
          Acerto por seleção
        </p>

        {loadingHeatmap ? (
          <div className="h-24 rounded-rebrand-md border border-line bg-canvas-2 animate-pulse" />
        ) : !heatmap || heatmap.length === 0 ? (
          <p className="text-[12px] text-ink-3 py-2">
            Sem dados ainda. Volte após os primeiros jogos finalizados.
          </p>
        ) : (
          <div className="space-y-1.5">
            {heatmap.slice(0, 12).map((t) => {
              const accuracy =
                t.matches_finished > 0
                  ? Math.round((t.correct_results / t.matches_finished) * 100)
                  : 0;
              const accuracyColor =
                accuracy >= 70
                  ? 'text-status-success'
                  : accuracy >= 40
                    ? 'text-forest'
                    : accuracy > 0
                      ? 'text-amber-2'
                      : 'text-ink-3';
              return (
                <div
                  key={t.team_code}
                  className="flex items-center gap-3 p-2.5 rounded-rebrand-md border border-line bg-white"
                >
                  <TeamFlag code={t.team_code} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-ink truncate">{t.team_name}</p>
                    <p className="text-[10px] text-ink-3">
                      {t.matches_finished} encerrados · {t.exact_scores} exatos
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[14px] font-bold tabular-nums ${accuracyColor}`}>
                      {t.matches_finished > 0 ? `${accuracy}%` : '—'}
                    </p>
                    <p className="text-[10px] text-ink-3 tabular-nums">{t.total_points} pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Versus */}
      <div>
        <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 mb-3">
          Comparar com…
        </p>

        <div className="space-y-3">
          <select
              value={opponentId ?? ''}
              onChange={(e) => setOpponentId(e.target.value || undefined)}
              className="w-full bg-white border border-line text-[13px] text-ink p-2.5 rounded-rebrand-md focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
            >
              <option value="">Escolha um participante…</option>
              {opponents.map((o) => (
                <option key={o.user_id} value={o.user_id}>
                  {o.user_name || o.user_email.split('@')[0]} — {o.total_points} pts
                </option>
              ))}
            </select>

            {opponentId && loadingVersus && (
              <div className="h-24 rounded-rebrand-md border border-line bg-canvas-2 animate-pulse" />
            )}

            {opponentId && versus && (
              <VersusGrid
                versus={versus}
                myName="Você"
                opponentName={
                  opponents.find((o) => o.user_id === opponentId)?.user_name ||
                  opponents
                    .find((o) => o.user_id === opponentId)
                    ?.user_email.split('@')[0] ||
                  'Adversário'
                }
              />
          )}
        </div>
      </div>
    </div>
  );
};

function VersusGrid({
  versus,
  myName,
  opponentName,
}: {
  versus: { me: any; opponent: any };
  myName: string;
  opponentName: string;
}) {
  const me = versus.me ?? {};
  const opp = versus.opponent ?? {};
  const rows: { label: string; key: 'total_points' | 'exact_scores' | 'correct_results' | 'total_predictions' }[] = [
    { label: 'Pontos', key: 'total_points' },
    { label: 'Placares exatos', key: 'exact_scores' },
    { label: 'Resultados certos', key: 'correct_results' },
    { label: 'Palpites', key: 'total_predictions' },
  ];

  return (
    <div className="rounded-rebrand-md border border-line bg-white overflow-hidden">
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-line text-[10px] font-bold uppercase tracking-[0.1em] text-ink-2">
        <span className="truncate">{myName}</span>
        <span className="text-center text-ink-3">vs</span>
        <span className="text-right truncate">{opponentName}</span>
      </div>
      {rows.map((r) => {
        const myVal = (me?.[r.key] ?? 0) as number;
        const oppVal = (opp?.[r.key] ?? 0) as number;
        const myWin = myVal > oppVal;
        const oppWin = oppVal > myVal;
        return (
          <div
            key={r.key}
            className="grid grid-cols-3 gap-2 p-3 border-b border-line/60 last:border-b-0"
          >
            <span
              className={`text-[14px] font-bold tabular-nums ${
                myWin ? 'text-forest' : oppWin ? 'text-ink-3' : 'text-ink'
              }`}
            >
              {myVal}
            </span>
            <span className="text-[11px] text-ink-3 text-center self-center">{r.label}</span>
            <span
              className={`text-[14px] font-bold tabular-nums text-right ${
                oppWin ? 'text-forest' : myWin ? 'text-ink-3' : 'text-ink'
              }`}
            >
              {oppVal}
            </span>
          </div>
        );
      })}
    </div>
  );
}
