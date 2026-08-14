import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Crest } from './Crest';
import type { FutebolStandingRow } from '@/services/futebol-data.service';

/**
 * As tabelas da fase de grupos, uma por grupo.
 *
 * Enquanto a copa está nos grupos, a pergunta não é "quem enfrenta quem na
 * final", é "como está o meu grupo". A chave só passa a valer quando o
 * mata-mata começa; antes disso ela é um monte de "a definir".
 *
 * O grupo vem de fact_standings_snapshot.group_name (migration 096). São 8
 * grupos na Libertadores e na Sul-Americana e 12 na Copa do Mundo, então a
 * lista rola dentro do próprio card, sem empurrar o resto da página.
 */

/** 'Group A' → 'Grupo A'. Nome de liga (sem grupo de verdade) passa direto. */
function nomeDoGrupo(g: string): string {
  const m = g.match(/^group\s+(.+)$/i);
  return m ? `Grupo ${m[1].toUpperCase()}` : g;
}

export function GruposFase({
  rows,
  loading,
  onTeam,
  /** Quantos passam de fase. Só pinta a barra verde, não inventa critério. */
  classificados = 2,
}: {
  rows?: FutebolStandingRow[];
  loading: boolean;
  onTeam: (id: number) => void;
  classificados?: number;
}) {
  const grupos = useMemo(() => {
    const m = new Map<string, FutebolStandingRow[]>();
    (rows ?? []).forEach((r) => {
      const g = r.group_name ?? '—';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    });
    return [...m.entries()]
      .map(([g, linhas]) => ({ grupo: g, linhas: [...linhas].sort((a, b) => a.rank - b.rank) }))
      .sort((a, b) => a.grupo.localeCompare(b.grupo));
  }, [rows]);

  if (loading) {
    return (
      <div className="bg-white rounded-rebrand-lg overflow-hidden p-4 space-y-2" style={{ border: '1px solid #ded2b6' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full bg-canvas-2 rounded" />
        ))}
      </div>
    );
  }

  if (!grupos.length) {
    return (
      <div className="bg-white rounded-rebrand-lg px-6 py-9 text-center" style={{ border: '1px dashed #ded2b6' }}>
        <div className="text-[14px] font-semibold text-ink">Grupos ainda não coletados</div>
        <div className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: '#8d8672' }}>
          Entram assim que a competição passar pela coleta.
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
          Fase de grupos
        </span>
        <span className="text-[10.5px]" style={{ color: '#8d8672' }}>
          {grupos.length} grupos
        </span>
      </div>

      <div className="max-h-[560px] overflow-y-auto minimal-scrollbar">
        {grupos.map(({ grupo, linhas }, iG) => (
          <div key={grupo}>
            <div
              className="px-4 py-1.5 flex items-center justify-between"
              style={{
                background: '#f8f4ea',
                borderTop: iG === 0 ? 'none' : '1px solid #f1e9d6',
                borderBottom: '1px solid #f1e9d6',
              }}
            >
              <span className="text-[9px] uppercase tracking-[0.12em] font-bold" style={{ color: '#0a3d2e' }}>
                {nomeDoGrupo(grupo)}
              </span>
              <span className="text-[9px] uppercase tracking-[0.1em]" style={{ color: '#8d8672' }}>
                J · SG · Pts
              </span>
            </div>

            {linhas.map((r) => {
              const passa = r.rank <= classificados;
              const sg = r.goals_diff > 0 ? `+${r.goals_diff}` : r.goals_diff < 0 ? `−${Math.abs(r.goals_diff)}` : '0';
              return (
                <button
                  key={r.team_id}
                  onClick={() => onTeam(r.team_id)}
                  className="w-full text-left px-4 py-1.5 grid grid-cols-[22px_1fr_22px_30px_30px] gap-2 items-center hover:bg-canvas-2 transition"
                  style={{ borderTop: '1px solid #f1e9d6' }}
                >
                  <span className="flex items-center gap-1">
                    <span
                      className="w-[3px] h-3.5 rounded-full shrink-0"
                      style={{ background: passa ? '#0a3d2e' : 'transparent' }}
                    />
                    <span className="text-[11px] font-semibold tabular-nums" style={{ color: '#6b6350' }}>
                      {r.rank}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <Crest name={r.team_name} id={r.team_id} size={18} />
                    <span className={`truncate text-[11.5px] ${passa ? 'font-bold text-ink' : 'font-medium text-ink'}`}>
                      {r.team_name}
                    </span>
                  </span>
                  <span className="text-center text-[11px] tabular-nums" style={{ color: '#6b6350' }}>
                    {r.played}
                  </span>
                  <span
                    className="text-center text-[11px] tabular-nums"
                    style={{ color: r.goals_diff > 0 ? '#0a3d2e' : r.goals_diff < 0 ? '#be123c' : '#6b6350' }}
                  >
                    {sg}
                  </span>
                  <span className="text-center text-[12.5px] font-bold tabular-nums text-ink">{r.points}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
