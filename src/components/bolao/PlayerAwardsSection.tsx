import React, { useMemo, useState } from 'react';
import { Goal, Star, Shield, Sparkles, ChevronDown, Search, X, Check } from 'lucide-react';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { useWcPlayers, useMySpecialPredictions, useSetPlayerPrediction } from '@/hooks/use-bolao';
import { useToast } from '@/hooks/use-toast';
import type { PlayerAwardType, WcPlayer } from '@/services/bolao.service';

/** Cutoff de elegibilidade do Melhor Jovem 2026 (nascidos a partir desta data). */
const YOUNG_CUTOFF = '2005-01-01';

interface AwardMeta {
  key: PlayerAwardType;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Filtro de quais jogadores podem ser escolhidos pra este prêmio. */
  filter?: (p: WcPlayer) => boolean;
}

const AWARDS: AwardMeta[] = [
  { key: 'top_scorer', label: 'Artilheiro', sublabel: 'Quem faz mais gols · Chuteira de Ouro', icon: Goal },
  { key: 'best_player', label: 'Craque da Copa', sublabel: 'Melhor jogador · Bola de Ouro', icon: Star },
  {
    key: 'best_goalkeeper', label: 'Melhor Goleiro', sublabel: 'Luva de Ouro', icon: Shield,
    filter: (p) => p.position === 'Goalkeeper',
  },
  {
    key: 'best_young_player', label: 'Revelação', sublabel: 'Melhor jovem (≤21) · nascidos ≥ 2005', icon: Sparkles,
    filter: (p) => !!p.birth_date && p.birth_date >= YOUNG_CUTOFF,
  },
];

interface Props {
  bolaoId: string;
  /** Liga/desliga cada prêmio (config do bolão). Default: todos ligados. */
  enabled?: Partial<Record<PlayerAwardType, boolean>>;
  /** Pontos por prêmio (config do bolão). */
  pointsConfig?: Partial<Record<PlayerAwardType, number>>;
}

export const PlayerAwardsSection: React.FC<Props> = ({ bolaoId, enabled, pointsConfig }) => {
  const { data: players } = useWcPlayers();
  const { data: myPreds } = useMySpecialPredictions(bolaoId);

  /** award_type → player_id escolhido pelo user. */
  const myPicks = useMemo(() => {
    const map: Partial<Record<PlayerAwardType, number>> = {};
    for (const p of myPreds || []) {
      if (p.predicted_player_id && (p.prediction_type as PlayerAwardType)) {
        map[p.prediction_type as PlayerAwardType] = p.predicted_player_id;
      }
    }
    return map;
  }, [myPreds]);

  const playersById = useMemo(() => {
    const m = new Map<number, WcPlayer>();
    for (const p of players || []) m.set(p.player_id, p);
    return m;
  }, [players]);

  const awardsToShow = AWARDS.filter((a) => enabled?.[a.key] !== false);
  if (awardsToShow.length === 0) return null;

  return (
    <div className="space-y-3">
      {awardsToShow.map((award) => (
        <PlayerAwardCard
          key={award.key}
          award={award}
          bolaoId={bolaoId}
          players={players || []}
          pickedPlayer={myPicks[award.key] ? playersById.get(myPicks[award.key]!) ?? null : null}
          pointsLabel={pointsConfig?.[award.key] != null ? `+${pointsConfig[award.key]} pts` : undefined}
        />
      ))}
    </div>
  );
};

interface CardProps {
  award: AwardMeta;
  bolaoId: string;
  players: WcPlayer[];
  pickedPlayer: WcPlayer | null;
  pointsLabel?: string;
}

const PlayerAwardCard: React.FC<CardProps> = ({ award, bolaoId, players, pickedPlayer, pointsLabel }) => {
  const Icon = award.icon;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const setPick = useSetPlayerPrediction();
  const { toast } = useToast();

  // Jogadores elegíveis a este prêmio
  const eligible = useMemo(
    () => (award.filter ? players.filter(award.filter) : players),
    [players, award]
  );

  // Revelação fica "em breve" enquanto ninguém tem birth_date (não enriquecido)
  const youngBlocked =
    award.key === 'best_young_player' && players.length > 0 && players.every((p) => !p.birth_date);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? eligible.filter((p) => p.player_name.toLowerCase().includes(q) || p.team_code.toLowerCase().includes(q))
      : eligible;
    return base.slice(0, 60);
  }, [eligible, search]);

  const handlePick = (playerId: number | null) => {
    setPick.mutate(
      { bolaoId, predictionType: award.key, playerId },
      {
        onError: (err: any) =>
          toast({ title: 'Erro', description: err?.message ?? 'Tente novamente', variant: 'destructive' }),
      }
    );
  };

  return (
    <div className={`rounded-rebrand-md border bg-white overflow-hidden transition-colors ${open ? 'border-forest/40' : 'border-line'}`}>
      <button
        type="button"
        onClick={() => !youngBlocked && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={youngBlocked}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-canvas-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-rebrand-sm bg-canvas-2 text-ink-2 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink leading-tight">{award.label}</p>
            <p className="text-[11px] text-ink-2 leading-tight mt-0.5">
              {award.sublabel}
              {pointsLabel && <span className="text-forest font-semibold"> · {pointsLabel}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {youngBlocked ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3 bg-canvas-2 px-2 py-1 rounded-rebrand-sm">
              Em breve
            </span>
          ) : pickedPlayer ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-2 max-w-[42vw] sm:max-w-none">
              <TeamFlag code={pickedPlayer.team_code} size="sm" />
              <span className="truncate">{pickedPlayer.player_name}</span>
            </span>
          ) : (
            <span className="text-[11px] text-ink-3">Escolher</span>
          )}
          {!youngBlocked && (
            <ChevronDown className={`w-4 h-4 text-ink-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          )}
        </div>
      </button>

      {open && !youngBlocked && (
        <div className="px-4 pb-4 border-t border-line">
          {/* Pick atual com opção de remover */}
          {pickedPlayer && (
            <div className="flex items-center gap-2.5 mt-3 pb-3 border-b border-line">
              <PlayerAvatar player={pickedPlayer} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-ink truncate">{pickedPlayer.player_name}</p>
                <p className="text-[11px] text-ink-2 flex items-center gap-1.5">
                  <TeamFlag code={pickedPlayer.team_code} size="sm" /> {pickedPlayer.team_code}
                  {pickedPlayer.position && <span className="text-ink-3">· {pickedPlayer.position}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePick(null)}
                disabled={setPick.isPending}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-rebrand-sm border border-line text-[11px] font-semibold text-ink-2 hover:border-line-2 hover:bg-canvas-2 transition-colors"
              >
                <X className="w-3 h-3" /> Remover
              </button>
            </div>
          )}

          {/* Busca */}
          <div className="relative my-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-3 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar entre ${eligible.length} jogadores…`}
              aria-label={`Buscar jogador para ${award.label}`}
              className="w-full h-10 pl-9 pr-3 rounded-rebrand-md border border-line bg-canvas-2 text-[12px] text-ink placeholder:text-ink-3 focus:bg-white focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none transition-colors"
            />
          </div>

          {/* Grid de jogadores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto minimal-scrollbar pr-1">
            {filtered.map((p) => {
              const picked = pickedPlayer?.player_id === p.player_id;
              return (
                <button
                  key={p.player_id}
                  type="button"
                  onClick={() => handlePick(p.player_id)}
                  disabled={setPick.isPending}
                  aria-pressed={picked}
                  className={`relative flex items-center gap-2 p-2 rounded-rebrand-sm border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 ${
                    picked ? 'border-amber bg-amber/[0.10] ring-2 ring-amber/30' : 'border-line bg-white hover:border-line-2 hover:bg-canvas-2'
                  }`}
                >
                  <PlayerAvatar player={p} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-ink leading-tight truncate">{p.player_name}</p>
                    <p className="text-[10px] text-ink-2 flex items-center gap-1 leading-tight mt-0.5">
                      <TeamFlag code={p.team_code} size="sm" /> {p.team_code}
                    </p>
                  </div>
                  {picked && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full text-center text-[12px] text-ink-3 py-6">Nenhum jogador encontrado</p>
            )}
          </div>
          {!search && eligible.length > 60 && (
            <p className="text-[10px] text-ink-3 mt-2 text-center">
              Mostrando 60 de {eligible.length} — use a busca pra achar mais rápido.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const PlayerAvatar: React.FC<{ player: WcPlayer }> = ({ player }) => {
  const [err, setErr] = useState(false);
  if (err || !player.photo_url) {
    return (
      <div className="w-8 h-8 rounded-full bg-canvas-2 text-ink-3 flex items-center justify-center text-[10px] font-bold shrink-0">
        {player.player_name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={player.photo_url}
      alt={player.player_name}
      onError={() => setErr(true)}
      className="w-8 h-8 rounded-full object-cover bg-canvas-2 shrink-0"
      loading="lazy"
    />
  );
};
