import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getFutebolPlayerPhotoUrl, crestInitials } from '@/utils/futebol-logos';
import type { FutebolLeaders } from '@/services/futebol-data.service';

/**
 * Artilheiros do campeonato: top 6 na tela, os 12 a um clique.
 *
 * Era top 8 com um "ver todos" que abria modal. O modal saiu junto com o da
 * classificação: pra uma lista de 12 linhas ele cobria a tela inteira e obrigava
 * a fechar pra continuar lendo o resto (protótipo "Futebol Campeonato").
 *
 * Sem coluna de jogos: `get_futebol_leaders` devolve nome, time e gols, e não
 * quantos jogos o cara fez. O protótipo mostrava essa coluna; preferi não
 * inventar número a botar um traço em toda linha.
 */

const TOPO = 6;
const TOTAL = 12;

function PlayerAvatar({ id, name, size = 26 }: { id: number; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const url = getFutebolPlayerPhotoUrl(id);
  if (url && !err) {
    return (
      <img
        src={url}
        alt=""
        onError={() => setErr(true)}
        style={{ width: size, height: size }}
        className="rounded-full object-cover bg-canvas-2 shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[8px] font-bold text-ink-2 shrink-0"
    >
      {crestInitials(name)}
    </div>
  );
}

export function ScorersCard({
  leaders,
  loading,
  vazio,
}: {
  leaders?: FutebolLeaders;
  loading: boolean;
  vazio?: { titulo: string; texto: string };
}) {
  const [tudo, setTudo] = useState(false);
  const todos = leaders?.scorers ?? [];
  const lista = todos.slice(0, tudo ? TOTAL : TOPO);

  if (loading) {
    return (
      <div className="bg-white rounded-rebrand-lg overflow-hidden p-4 space-y-2" style={{ border: '1px solid #ded2b6' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full bg-canvas-2 rounded" />
        ))}
      </div>
    );
  }

  if (!todos.length) {
    return (
      <div className="bg-white rounded-rebrand-lg px-6 py-9 text-center" style={{ border: '1px dashed #ded2b6' }}>
        <div className="text-[14px] font-semibold text-ink">{vazio?.titulo ?? 'Artilheiros não disponíveis'}</div>
        <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: '#8d8672' }}>
          {vazio?.texto ?? 'Entram assim que a competição passar pela coleta.'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-rebrand-lg overflow-hidden" style={{ border: '1px solid #ded2b6' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={{ background: '#f4eddc', borderBottom: '1px solid #ded2b6' }}
      >
        <span className="text-[10.5px] uppercase tracking-[0.16em] font-bold" style={{ color: '#6b6350' }}>
          Artilheiros
        </span>
        {todos.length > TOPO && (
          <button
            onClick={() => setTudo((v) => !v)}
            className="text-[11px] font-semibold text-forest inline-flex items-center gap-1"
          >
            {tudo ? `ver só o top ${TOPO}` : `ver os ${Math.min(TOTAL, todos.length)}`}
            <ChevronDown className={`w-3 h-3 transition-transform ${tudo ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {lista.map((s, i) => (
        <div
          key={s.player_id}
          className="px-4 py-2 flex items-center gap-2.5"
          style={{ borderTop: i === 0 ? 'none' : '1px solid #f1e9d6' }}
        >
          <span className="w-4 text-[11.5px] font-semibold tabular-nums" style={{ color: '#8d8672' }}>
            {i + 1}
          </span>
          <PlayerAvatar id={s.player_id} name={s.player_name} />
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] font-semibold text-ink truncate">{s.player_name}</span>
            <span className="block text-[10.5px] truncate" style={{ color: '#8d8672' }}>
              {s.team_name}
            </span>
          </span>
          <span className="text-[14px] font-bold tabular-nums text-forest">{s.goals}</span>
          <span className="text-[10px]" style={{ color: '#8d8672' }}>
            gols
          </span>
        </div>
      ))}
    </div>
  );
}
