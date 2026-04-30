import React from 'react';
import {
  BarChart3,
  Target,
  Trophy,
  Users,
  Zap,
  CheckCircle,
  Star,
  Flame,
  Crown,
  User,
} from 'lucide-react';
import { useBolaoStats, useBolaoRoundRanking } from '@/hooks/use-bolao';
import { BolaoRankingTable } from './BolaoRankingTable';
import { MyBolaoStatsPanel } from './MyBolaoStatsPanel';

const STAGES = [
  { key: 'group',        label: 'Fase de Grupos' },
  { key: 'round_of_32',  label: 'R32' },
  { key: 'round_of_16',  label: 'Oitavas' },
  { key: 'quarter',      label: 'Quartas' },
  { key: 'semi',         label: 'Semifinal' },
  { key: 'final',        label: 'Final' },
] as const;

type SubTab = 'geral' | 'voce';

interface Props {
  bolaoId: string;
  currentUserId: string | undefined;
}

function StatCard({ icon, label, value, sub }: {
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

function DestaqueBadge({ icon, label, name, value }: {
  icon: React.ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-rebrand-md border border-line bg-white">
      <div className="shrink-0 text-forest">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">{label}</p>
        <p className="text-[13px] font-bold text-ink truncate">{name}</p>
      </div>
      <span className="shrink-0 text-[12px] font-bold text-forest tabular-nums">{value}</span>
    </div>
  );
}

const GeneralStatsView: React.FC<Props> = ({ bolaoId, currentUserId }) => {
  const [activeStage, setActiveStage] = React.useState<string | undefined>(undefined);
  const { data: stats, isLoading: loadingStats } = useBolaoStats(bolaoId);
  const { data: roundRanking, isLoading: loadingRound } = useBolaoRoundRanking(
    bolaoId,
    activeStage
  );

  if (loadingStats) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 rounded-rebrand-md border border-line bg-canvas-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-ink-3">
        <BarChart3 className="w-8 h-8 mx-auto mb-2" />
        <p className="text-[13px]">Estatísticas disponíveis após os primeiros jogos</p>
      </div>
    );
  }

  const totalPossible = stats.finished_games > 0
    ? `de ${stats.finished_games} jogos encerrados`
    : 'nenhum jogo encerrado';

  const accuracy = stats.total_predictions > 0
    ? Math.round(((stats.exact_scores + stats.correct_results) / stats.total_predictions) * 100)
    : 0;

  // Compute destaques from general ranking (activeStage === undefined)
  const generalRanking = activeStage === undefined ? (roundRanking ?? []) : [];
  const topScorer    = generalRanking.reduce<typeof generalRanking[0] | null>((best, m) =>
    !best || m.total_points > best.total_points ? m : best, null);
  const topExact     = generalRanking.reduce<typeof generalRanking[0] | null>((best, m) =>
    !best || m.exact_scores > best.exact_scores ? m : best, null);
  const topEngaged   = generalRanking.reduce<typeof generalRanking[0] | null>((best, m) =>
    !best || m.total_predictions > best.total_predictions ? m : best, null);

  const hasDestaques = generalRanking.length > 1 && stats.finished_games > 0;

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Participantes"
          value={stats.total_members}
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Palpites"
          value={stats.total_predictions}
          sub={totalPossible}
        />
        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="Placares exatos"
          value={stats.exact_scores}
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Resultados certos"
          value={stats.correct_results}
        />
        <StatCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="% acerto geral"
          value={`${accuracy}%`}
        />
        {stats.top_team_champion && (
          <StatCard
            icon={<Trophy className="w-4 h-4" />}
            label="Favorito ao título"
            value={stats.top_team_champion}
            sub={`${stats.champion_pick_count} palpites`}
          />
        )}
      </div>

      {/* Destaques automáticos */}
      {hasDestaques && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 mb-3">Destaques</p>
          <div className="space-y-2">
            {topScorer && topScorer.total_points > 0 && (
              <DestaqueBadge
                icon={<Crown className="w-4 h-4" />}
                label="Líder"
                name={topScorer.user_name || topScorer.user_email.split('@')[0]}
                value={`${topScorer.total_points} pts`}
              />
            )}
            {topExact && topExact.exact_scores > 0 && (
              <DestaqueBadge
                icon={<Star className="w-4 h-4" />}
                label="Mais placares exatos"
                name={topExact.user_name || topExact.user_email.split('@')[0]}
                value={`${topExact.exact_scores} exatos`}
              />
            )}
            {topEngaged && topEngaged.total_predictions > 0 && (
              <DestaqueBadge
                icon={<Flame className="w-4 h-4" />}
                label="Mais engajado"
                name={topEngaged.user_name || topEngaged.user_email.split('@')[0]}
                value={`${topEngaged.total_predictions} palpites`}
              />
            )}
          </div>
        </div>
      )}

      {/* Round ranking */}
      <div>
        <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 mb-3">
          Ranking por fase
        </p>

        {/* Stage tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button
            type="button"
            onClick={() => setActiveStage(undefined)}
            className={`px-3 h-8 text-[12px] font-medium rounded-rebrand-sm transition-colors shrink-0 ${
              activeStage === undefined
                ? 'bg-forest text-white'
                : 'border border-line bg-white text-ink-2 hover:text-ink hover:bg-canvas-2 hover:border-line-2'
            }`}
          >
            Geral
          </button>
          {STAGES.filter((s) => stats.finished_games > 0 || s.key === 'group').map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveStage(s.key)}
              className={`px-3 h-8 text-[12px] font-medium rounded-rebrand-sm transition-colors shrink-0 ${
                activeStage === s.key
                  ? 'bg-forest text-white'
                  : 'border border-line bg-white text-ink-2 hover:text-ink hover:bg-canvas-2 hover:border-line-2'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loadingRound ? (
          <div className="h-32 rounded-rebrand-md border border-line bg-canvas-2 animate-pulse" />
        ) : (
          <>
            {activeStage && (
              <p className="text-[11px] text-ink-3 mb-3 text-center">
                Pontos acumulados apenas nos jogos da fase selecionada
              </p>
            )}
            <BolaoRankingTable ranking={roundRanking || []} currentUserId={currentUserId} />
          </>
        )}
      </div>
    </div>
  );
};

export const BolaoStatsPanel: React.FC<Props> = ({ bolaoId, currentUserId }) => {
  const [subTab, setSubTab] = React.useState<SubTab>('geral');

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Geral / Você */}
      <div role="tablist" className="flex items-center gap-1 border-b border-line">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'geral'}
          onClick={() => setSubTab('geral')}
          className={`inline-flex items-center gap-2 px-4 h-10 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors border-b-2 -mb-px ${
            subTab === 'geral'
              ? 'border-forest text-forest'
              : 'border-transparent text-ink-3 hover:text-ink-2'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Geral
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'voce'}
          onClick={() => setSubTab('voce')}
          className={`inline-flex items-center gap-2 px-4 h-10 text-[12px] font-bold uppercase tracking-[0.08em] transition-colors border-b-2 -mb-px ${
            subTab === 'voce'
              ? 'border-forest text-forest'
              : 'border-transparent text-ink-3 hover:text-ink-2'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Você
        </button>
      </div>

      {subTab === 'geral' ? (
        <GeneralStatsView
          bolaoId={bolaoId}
          currentUserId={currentUserId}
        />
      ) : (
        <MyBolaoStatsPanel
          bolaoId={bolaoId}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};
