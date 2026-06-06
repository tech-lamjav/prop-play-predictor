import React from 'react';
import { TeamFlag } from './TeamFlag';
import type { GroupProjection, QualifyStatus } from './group-projection';

/**
 * Tabela projetada de UM grupo, a partir dos palpites do usuário.
 * Verde = 1º/2º (classificado direto), âmbar = 3º entre os 8 melhores,
 * âmbar claro = 3º fora, apagado = 4º.
 */
const ACCENT: Record<QualifyStatus, string> = {
  direct: 'bg-forest',
  third_in: 'bg-amber',
  third_out: 'bg-amber/30',
  out: 'bg-transparent',
};

export const GroupProjectionTable: React.FC<{ projection: GroupProjection }> = ({ projection }) => {
  const { standings, complete } = projection;

  return (
    <div className="rounded-rebrand-md border border-line bg-canvas-2/50 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2">
          Projeção do grupo
        </p>
        {!complete && (
          <span className="text-[9px] uppercase tracking-wide text-ink-3">parcial</span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_22px_30px_26px] gap-1 text-[9px] uppercase text-ink-3 pb-1 border-b border-line mb-1 text-center">
        <span className="text-left">Seleção</span>
        <span>J</span>
        <span>SG</span>
        <span className="font-bold">Pts</span>
      </div>

      {standings.map((s) => {
        const strong = s.status === 'direct' || s.status === 'third_in';
        return (
          <div
            key={s.code}
            className={`grid grid-cols-[1fr_22px_30px_26px] gap-1 py-1 text-[12px] text-center items-center ${
              strong ? 'text-ink' : 'text-ink-3'
            }`}
          >
            <div className="flex items-center gap-1.5 text-left min-w-0">
              <span className={`w-1 h-3.5 rounded-sm shrink-0 ${ACCENT[s.status]}`} />
              <span className="text-[10px] text-ink-3 w-3 shrink-0 tabular-nums">{s.position}</span>
              <TeamFlag code={s.code} />
              <span className="font-mono font-bold text-[10px] truncate">{s.code}</span>
              {s.status === 'third_in' && (
                <span className="text-[8px] font-bold uppercase text-amber-2 shrink-0">melhor 3º</span>
              )}
            </div>
            <span className="tabular-nums">{s.played}</span>
            <span className="tabular-nums">{s.gd > 0 ? `+${s.gd}` : s.gd}</span>
            <span
              className={`font-bold tabular-nums ${
                s.status === 'direct' ? 'text-forest' : s.status === 'third_in' ? 'text-amber-2' : 'text-ink-2'
              }`}
            >
              {s.pts}
            </span>
          </div>
        );
      })}

      <p className="text-[9px] text-ink-3 mt-1.5 pt-1.5 border-t border-line leading-snug">
        <span className="text-forest font-semibold">Verde</span> classifica ·{' '}
        <span className="text-amber-2 font-semibold">âmbar</span> melhor 3º · com base nos seus palpites
        {!complete && ' (faltam jogos)'}
      </p>
    </div>
  );
};
