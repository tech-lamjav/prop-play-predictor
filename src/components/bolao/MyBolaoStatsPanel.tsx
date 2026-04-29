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
  Lock,
  Swords,
  Map as MapIcon,
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
  isPremium: boolean;
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
    <div className="flex items-center gap-3 p-3 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20">
      <div className="opacity-50 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] opacity-40 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold leading-tight tabular-nums">{value}</p>
        {sub && <p className="text-[10px] opacity-40">{sub}</p>}
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

export const MyBolaoStatsPanel: React.FC<Props> = ({ bolaoId, currentUserId, isPremium }) => {
  const { data: personalStats, isLoading: loadingPersonal } = useMyBolaoPersonalStats(bolaoId);
  const { data: ranking } = useBolaoRanking(bolaoId);
  const { data: heatmap, isLoading: loadingHeatmap } = useMyTeamHeatmap(bolaoId, isPremium);
  const [opponentId, setOpponentId] = useState<string | undefined>(undefined);
  const { data: versus, isLoading: loadingVersus } = useVersusStats(
    bolaoId,
    opponentId,
    isPremium && !!opponentId
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
            className="h-20 rounded border border-terminal-border animate-pulse bg-terminal-dark-gray/30"
          />
        ))}
      </div>
    );
  }

  if (!personalStats || personalStats.total_predictions === 0) {
    return (
      <div className="text-center py-8 opacity-40">
        <Target className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Faça seus primeiros palpites para ver suas estatísticas</p>
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
      <div className="grid grid-cols-2 gap-2">
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
          <p className="text-[10px] uppercase font-bold tracking-wider opacity-40 mb-3">
            Evolução de pontos
          </p>
          <div className="rounded border border-terminal-border-subtle bg-terminal-dark-gray/20 p-3">
            <div style={{ height: 180 }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolutionChartData}>
                  <defs>
                    <linearGradient id="colorMyPoints" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis
                    dataKey="idx"
                    stroke="#666"
                    tick={{ fill: 'var(--terminal-text)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    stroke="#666"
                    tick={{ fill: 'var(--terminal-text)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                    itemStyle={{ color: '#14b8a6' }}
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
                    stroke="#14b8a6"
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
        <p className="text-[10px] uppercase font-bold tracking-wider opacity-40 mb-3">
          Seu estilo
        </p>
        <div className="p-4 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20">
          <p className="text-base font-bold text-terminal-blue">{personality.label}</p>
          <p className="text-xs opacity-70 mt-1">{personality.description}</p>
        </div>
      </div>

      {/* Heatmap por seleção (Premium) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase font-bold tracking-wider opacity-40">
            Acerto por seleção
          </p>
          {!isPremium && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 inline-flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> PRO
            </span>
          )}
        </div>

        {!isPremium ? (
          <div className="p-4 rounded border border-yellow-500/20 bg-yellow-500/5 text-center">
            <MapIcon className="w-6 h-6 text-yellow-400/70 mx-auto mb-2" />
            <p className="text-xs text-yellow-400/80">
              Veja seu desempenho contra cada seleção no Bolão PRO
            </p>
          </div>
        ) : loadingHeatmap ? (
          <div className="h-24 rounded border border-terminal-border animate-pulse bg-terminal-dark-gray/30" />
        ) : !heatmap || heatmap.length === 0 ? (
          <p className="text-xs opacity-40 py-2">
            Sem dados ainda. Volte após os primeiros jogos finalizados.
          </p>
        ) : (
          <div className="space-y-1">
            {heatmap.slice(0, 12).map((t) => {
              const accuracy =
                t.matches_finished > 0
                  ? Math.round((t.correct_results / t.matches_finished) * 100)
                  : 0;
              const accuracyColor =
                accuracy >= 70
                  ? 'text-terminal-green'
                  : accuracy >= 40
                    ? 'text-terminal-blue'
                    : accuracy > 0
                      ? 'text-yellow-400/80'
                      : 'opacity-40';
              return (
                <div
                  key={t.team_code}
                  className="flex items-center gap-3 p-2 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20"
                >
                  <TeamFlag code={t.team_code} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{t.team_name}</p>
                    <p className="text-[10px] opacity-50">
                      {t.matches_finished} encerrados · {t.exact_scores} exatos
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${accuracyColor}`}>
                      {t.matches_finished > 0 ? `${accuracy}%` : '—'}
                    </p>
                    <p className="text-[10px] opacity-40 tabular-nums">{t.total_points} pts</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Versus (Premium) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase font-bold tracking-wider opacity-40">
            Comparar com…
          </p>
          {!isPremium && (
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 inline-flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> PRO
            </span>
          )}
        </div>

        {!isPremium ? (
          <div className="p-4 rounded border border-yellow-500/20 bg-yellow-500/5 text-center">
            <Swords className="w-6 h-6 text-yellow-400/70 mx-auto mb-2" />
            <p className="text-xs text-yellow-400/80">
              Compare seus números 1-a-1 com qualquer participante no Bolão PRO
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <select
              value={opponentId ?? ''}
              onChange={(e) => setOpponentId(e.target.value || undefined)}
              className="w-full bg-terminal-black border border-terminal-border text-sm p-2 rounded text-terminal-text"
            >
              <option value="">Escolha um participante…</option>
              {opponents.map((o) => (
                <option key={o.user_id} value={o.user_id}>
                  {o.user_name || o.user_email.split('@')[0]} — {o.total_points} pts
                </option>
              ))}
            </select>

            {opponentId && loadingVersus && (
              <div className="h-24 rounded border border-terminal-border animate-pulse bg-terminal-dark-gray/30" />
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
        )}
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
    <div className="rounded border border-terminal-border-subtle bg-terminal-dark-gray/20 overflow-hidden">
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-terminal-border-subtle text-[10px] uppercase tracking-wider opacity-60">
        <span className="font-bold truncate">{myName}</span>
        <span className="text-center">vs</span>
        <span className="font-bold text-right truncate">{opponentName}</span>
      </div>
      {rows.map((r) => {
        const myVal = (me?.[r.key] ?? 0) as number;
        const oppVal = (opp?.[r.key] ?? 0) as number;
        const myWin = myVal > oppVal;
        const oppWin = oppVal > myVal;
        return (
          <div
            key={r.key}
            className="grid grid-cols-3 gap-2 p-3 border-b border-terminal-border-subtle/50 last:border-b-0"
          >
            <span
              className={`text-sm font-bold tabular-nums ${
                myWin ? 'text-terminal-green' : oppWin ? 'opacity-50' : ''
              }`}
            >
              {myVal}
            </span>
            <span className="text-[10px] opacity-50 text-center self-center">{r.label}</span>
            <span
              className={`text-sm font-bold tabular-nums text-right ${
                oppWin ? 'text-terminal-green' : myWin ? 'opacity-50' : ''
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
