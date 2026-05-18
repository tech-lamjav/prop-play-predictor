import React, { useMemo } from 'react';
import { Trophy, Pencil } from 'lucide-react';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { useChampionPredictions } from '@/hooks/use-bolao';
import type { WcMatch } from '@/services/bolao.service';

interface ChampionHeroCardProps {
  bolaoId: string;
  matches: WcMatch[];
  currentPick: string | null;
  championPoints: number;
  /** Abre o modal de troca de campeão (controlado pelo parent). */
  onOpenPicker: () => void;
}

/**
 * Hero card amber para o palpite de campeão. Quando o user salva o campeão
 * (via `setChampion` exposto), também auto-adiciona o time aos finalistas se
 * ainda não estiver lá e houver vaga.
 */
export const ChampionHeroCard: React.FC<ChampionHeroCardProps> = ({
  bolaoId,
  matches,
  currentPick,
  championPoints,
  onOpenPicker,
}) => {
  const { data: allChampionPicks } = useChampionPredictions(bolaoId);

  const teamMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const match of matches) {
      if (match.home_team_code && match.home_team_code !== 'TBD')
        m.set(match.home_team_code, match.home_team);
      if (match.away_team_code && match.away_team_code !== 'TBD')
        m.set(match.away_team_code, match.away_team);
    }
    return m;
  }, [matches]);

  const popularityPct = useMemo(() => {
    if (!currentPick || !allChampionPicks || allChampionPicks.length === 0) return null;
    const total = allChampionPicks.length;
    const same = allChampionPicks.filter((p) => p.predicted_team_code === currentPick).length;
    return Math.round((same / total) * 100);
  }, [currentPick, allChampionPicks]);

  const teamName = currentPick ? teamMap.get(currentPick) ?? currentPick : null;

  return (
    <div className="relative rounded-rebrand-lg border-2 border-amber/60 bg-gradient-to-br from-amber/[0.18] via-amber/[0.10] to-white p-5 overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 -translate-y-12 translate-x-8 opacity-[0.08] pointer-events-none">
        <Trophy className="w-full h-full text-amber-2" strokeWidth={1.5} />
      </div>

      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-rebrand-sm bg-amber text-white flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-2">
              Maior pontuação do bolão
            </p>
            <p className="text-[15px] font-bold tracking-tight text-ink leading-tight">
              Quem vai ser campeão?
            </p>
          </div>
          <span className="ml-auto px-2.5 py-1 rounded-rebrand-sm bg-amber text-white text-[11px] font-bold tabular-nums shrink-0">
            +{championPoints} pts
          </span>
        </div>

        {currentPick ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenPicker}
              aria-label={`Trocar palpite de campeão (atual: ${teamName})`}
              className="flex items-center gap-3 h-14 pl-3 pr-4 rounded-rebrand-md bg-white border-2 border-amber shadow-sm hover:border-amber-2 hover:shadow transition-all"
            >
              <TeamFlag code={currentPick} size="lg" />
              <div className="text-left">
                <p className="font-mono font-bold text-[14px] text-ink leading-tight">
                  {currentPick} · {teamName}
                </p>
                <p className="text-[10px] text-ink-2">Seu palpite</p>
              </div>
              <Pencil className="w-3.5 h-3.5 text-ink-3 ml-1" />
            </button>
            <div className="text-[11px] text-ink-2 leading-snug">
              {popularityPct !== null ? (
                <p>
                  <span className="font-semibold text-ink">{popularityPct}%</span> do bolão concorda
                </p>
              ) : (
                <p>Você é o primeiro a palpitar</p>
              )}
              <p className="text-ink-3">Você muda até o início da Copa</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenPicker}
              aria-label="Escolher campeão"
              className="inline-flex items-center gap-2 h-12 px-5 rounded-rebrand-md bg-amber text-white text-[13px] font-bold shadow-sm hover:bg-amber-2 transition-colors"
            >
              <Trophy className="w-4 h-4" />
              Escolher campeão
            </button>
            <p className="text-[11px] text-ink-2 leading-snug">
              Vale +{championPoints} pts se acertar.
              <br />
              <span className="text-ink-3">Já preenche finalista, semi, quarta e mata-mata.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
