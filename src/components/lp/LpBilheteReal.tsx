import { Check } from "lucide-react";
import { BILHETE_REAL } from "./lp-provas";

/**
 * Prova social em forma de oportunidade real já liquidada: os campos são
 * exatamente os que estavam no mart no dia, incluindo o Score que o sistema deu
 * na época. Entra nos pontos onde o documento de copy marca [PROVA SOCIAL].
 *
 * A ressalva embaixo não é enfeite: um exemplo não é média, e a gente não
 * publica taxa de acerto. No mesmo recorte existem oportunidades de Score alto
 * que não bateram.
 */
export function LpBilheteReal({ comRessalva = true }: { comRessalva?: boolean }) {
  const b = BILHETE_REAL;
  return (
    <div>
      <div className="rounded-rebrand-lg border border-line-2 bg-white overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-2.5 bg-ink text-white flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.16em] font-bold">
            Oportunidade real, já liquidada
          </p>
          <span className="font-mono text-[9px] uppercase tracking-wider text-white/50 whitespace-nowrap">
            {b.data}
          </span>
        </div>

        <div className="p-4 sm:p-5 grid sm:grid-cols-[1fr_170px] gap-5">
          <div className="min-w-0">
            <p className="text-[11px] text-ink-3">
              {b.casa} x {b.fora} · {b.competicao}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">
                {b.mercado}
              </span>
              <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-forest text-white">
                Faixa {b.faixa}
              </span>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold tracking-tight mt-2 text-ink leading-tight">
              {b.pick}
            </div>

            <dl className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-line">
              <div>
                <dt className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">
                  Chance estimada
                </dt>
                <dd className="text-[16px] font-semibold tabular-nums text-ink mt-0.5">
                  {b.chance}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">
                  Odd
                </dt>
                <dd className="text-[16px] font-semibold tabular-nums text-ink mt-0.5">{b.odd}</dd>
              </div>
              <div>
                <dt className="text-[9px] uppercase tracking-[0.14em] font-semibold text-ink-3">
                  Casas comparadas
                </dt>
                <dd className="text-[16px] font-semibold tabular-nums text-ink mt-0.5">
                  {b.nCasas}
                </dd>
              </div>
            </dl>
          </div>

          <div className="sm:pl-5 sm:border-l sm:border-line flex flex-col gap-3">
            <div
              className="rounded-rebrand-md p-4 text-white"
              style={{ background: "linear-gradient(135deg, #0a3d2e, #08321f)" }}
            >
              <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">
                Score na época
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span
                  className="text-[40px] font-bold tabular-nums tracking-tight leading-none"
                  style={{ color: "#fbbf24" }}
                >
                  {b.score}
                </span>
                <span className="text-[13px] text-white/40">/100</span>
              </div>
            </div>
            <div className="rounded-rebrand-md border border-forest/30 bg-forest/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-forest shrink-0" strokeWidth={3} />
                <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-forest">
                  {b.resultado}
                </span>
              </div>
              <p className="text-[12px] text-ink-2 mt-1">Terminou {b.placar}</p>
            </div>
          </div>
        </div>
      </div>

      {comRessalva && (
        <p className="text-[12.5px] text-ink-3 mt-3 leading-snug">
          Este é um exemplo real, não uma média. A gente não publica taxa de acerto, e no mesmo
          período existem oportunidades de Score alto que não bateram.
        </p>
      )}
    </div>
  );
}
