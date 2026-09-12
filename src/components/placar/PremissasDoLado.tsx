import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { LadoMedido } from './placar-por-premissa';

/** A diferença entre acesa e apagada, com o veredito. */
function Diferenca({ valor, erro, ruido }: { valor: number | null; erro: number | null; ruido: boolean }) {
  if (valor == null) return <span className="text-[13px] text-ink-dim">—</span>;

  if (ruido) {
    return (
      <span className="flex flex-col">
        <span className="text-[12px] text-ink-2">ruído</span>
        <span className="text-[11px] tabular-nums text-ink-dim">
          {roiPct(valor)} ± {epPct(erro ?? 0)}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span className={`text-[15px] font-black tabular-nums ${tomDoRoi(valor)}`}>
        {roiPct(valor)}
      </span>
      <span className="text-[11px] tabular-nums text-ink-dim">± {epPct(erro ?? 0)}</span>
    </span>
  );
}

/**
 * Um lado de um mercado, com as premissas dele.
 *
 * O cabeçalho é o ROI DO LADO, e ele não é enfeite: é a linha de base contra a
 * qual cada premissa é lida. Uma premissa que rende 15% num lado que rende 15%
 * não informa nada, e sem o número do lado à vista essa leitura não acontece.
 *
 * A coluna que decide é a última — a diferença entre acesa e apagada. As duas do
 * meio estão lá para mostrar de onde ela veio e sobre quantas apostas.
 */
export function PremissasDoLado({ lado }: { lado: LadoMedido }) {
  return (
    <section className="rounded-rebrand-md border border-line-2 bg-white">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-2 px-5 py-3">
        <h3 className="font-display text-[16px] font-black text-ink">{lado.rotulo}</h3>
        <span className={`text-[15px] font-black tabular-nums ${tomDoRoi(lado.total.roi)}`}>
          {roiPct(lado.total.roi)}
        </span>
        <span className="text-[12px] text-ink-dim">
          {taxaPct(lado.total.taxa)} de acerto · {emN(lado.total.n)} · ± {epPct(lado.total.ep)}
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
              <th className="px-5 py-2 font-bold">Premissa</th>
              <th className="px-3 py-2 text-right font-bold">Peso</th>
              <th className="px-3 py-2 text-right font-bold">Acesa</th>
              <th className="px-3 py-2 text-right font-bold">Apagada</th>
              <th className="px-5 py-2 text-right font-bold">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {lado.premissas.map((p) => (
              <tr
                key={p.slug}
                className={`border-b border-line-2 last:border-b-0 ${
                  p.acesa.n === 0 ? 'opacity-60' : ''
                }`}
              >
                <td className="px-5 py-2.5 text-[13px] font-bold text-ink">{p.label}</td>
                <td className="px-3 py-2.5 text-right text-[12px] tabular-nums text-ink-2">
                  {p.peso == null ? '—' : p.peso}
                </td>
                <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                  {p.acesa.n === 0 ? (
                    <span className="text-[12px] text-ink-dim">nunca acendeu</span>
                  ) : (
                    <>
                      <span className={tomDoRoi(p.acesa.roi)}>{roiPct(p.acesa.roi)}</span>
                      <span className="ml-1 text-[11px] text-ink-dim">{emN(p.acesa.n)}</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right text-[13px] tabular-nums">
                  {p.apagada.n === 0 ? (
                    <span className="text-[12px] text-ink-dim">—</span>
                  ) : (
                    <>
                      <span className={tomDoRoi(p.apagada.roi)}>{roiPct(p.apagada.roi)}</span>
                      <span className="ml-1 text-[11px] text-ink-dim">{emN(p.apagada.n)}</span>
                    </>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <Diferenca valor={p.diferenca} erro={p.erro} ruido={p.dentroDoRuido} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
