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
  Lock,
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
  isPremium: boolean;
}

function StatCard({ icon, label, value, sub }: {
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

function DestaqueBadge({ icon, label, name, value }: {
  icon: React.ReactNode;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20">
      <div className="shrink-0 text-terminal-blue opacity-70">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] opacity-40 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold truncate">{name}</p>
      </div>
      <span className="shrink-0 text-xs font-bold text-terminal-blue tabular-nums">{value}</span>
    </div>
  );
}

const GeneralStatsView: React.FC<Props> = ({ bolaoId, currentUserId, isPremium }) => {
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
          <div key={i} className="h-20 rounded border border-terminal-border animate-pulse bg-terminal-dark-gray/30" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 opacity-40">
        <BarChart3 className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Estatísticas disponíveis após os primeiros jogos</p>
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
      <div className="grid grid-cols-2 gap-2">
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

      {/* Destaques automáticos — Premium only */}
      {isPremium && hasDestaques && (
        <div>
          <p className="text-[10px] uppercase font-bold tracking-wider opacity-40 mb-3">Destaques</p>
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

      {!isPremium && hasDestaques && (
        <div className="p-4 rounded border border-yellow-500/20 bg-yellow-500/5 text-center">
          <Lock className="w-5 h-5 text-yellow-400/70 mx-auto mb-1.5" />
          <p className="text-xs text-yellow-400/80">
            Destaques automáticos (líder, mais exatos, mais engajado) no Bolão PRO
          </p>
        </div>
      )}

      {/* Round ranking */}
      <div>
        <p className="text-[10px] uppercase font-bold tracking-wider opacity-40 mb-3">
          Ranking por Fase
        </p>

        {/* Stage tabs */}
        <div className="flex gap-1 flex-wrap mb-4">
          <button
            onClick={() => setActiveStage(undefined)}
            className={`px-3 py-1 text-xs rounded border transition-colors shrink-0 ${
              activeStage === undefined
                ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
                : 'border-terminal-border opacity-50 hover:opacity-80'
            }`}
          >
            Geral
          </button>
          {STAGES.filter((s) => stats.finished_games > 0 || s.key === 'group').map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`px-3 py-1 text-xs rounded border transition-colors shrink-0 ${
                activeStage === s.key
                  ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
                  : 'border-terminal-border opacity-50 hover:opacity-80'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loadingRound ? (
          <div className="h-32 rounded border border-terminal-border animate-pulse bg-terminal-dark-gray/30" />
        ) : (
          <>
            {activeStage && (
              <p className="text-[10px] opacity-40 mb-3 text-center">
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

export const BolaoStatsPanel: React.FC<Props> = ({ bolaoId, currentUserId, isPremium }) => {
  const [subTab, setSubTab] = React.useState<SubTab>('geral');

  return (
    <div className="space-y-4">
      {/* Sub-tabs: Geral / Você */}
      <div role="tablist" className="flex gap-1 border-b border-terminal-border-subtle">
        <button
          role="tab"
          aria-selected={subTab === 'geral'}
          onClick={() => setSubTab('geral')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
            subTab === 'geral'
              ? 'border-terminal-green text-terminal-green'
              : 'border-transparent opacity-50 hover:opacity-80'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Geral
        </button>
        <button
          role="tab"
          aria-selected={subTab === 'voce'}
          onClick={() => setSubTab('voce')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
            subTab === 'voce'
              ? 'border-terminal-green text-terminal-green'
              : 'border-transparent opacity-50 hover:opacity-80'
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
          isPremium={isPremium}
        />
      ) : (
        <MyBolaoStatsPanel
          bolaoId={bolaoId}
          currentUserId={currentUserId}
          isPremium={isPremium}
        />
      )}
    </div>
  );
};
