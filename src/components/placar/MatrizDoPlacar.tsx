import { useState } from 'react';
import type { LinhaLiquidada } from './placar-agregacao';
import { CelulaDoGrupo } from './CelulaDoGrupo';
import { DrillDaCelula } from './DrillDaCelula';
import { epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { Granularidade } from './placar-evolucao';
import { matriz, type CelulaDaMatriz } from './placar-matriz';
import { linhasDa } from './placar-quebras';
import type { Eixo } from './placar-periodo';
import type { Quebra } from './placar-quebras';

/** O conteúdo de uma célula: o ROI grande, a base pequena. */
function Conteudo({ celula }: { celula: CelulaDaMatriz | undefined }) {
  if (!celula) return <span className="text-[12px] text-ink-dim">—</span>;

  return (
    <span className="flex flex-col items-end">
      <span className={`text-[13px] font-bold tabular-nums ${tomDoRoi(celula.celula.roi)}`}>
        {roiPct(celula.celula.roi)}
      </span>
      <span className="text-[10px] tabular-nums text-ink-dim">
        {celula.celula.n} · {taxaPct(celula.celula.taxa, 0)}
      </span>
    </span>
  );
}

/**
 * Uma quebra com o tempo nas colunas, e cada célula clicável.
 *
 * Substituiu a tabela de uma coluna por pedido do sócio, e a razão dele era
 * boa: com o ROI do período só, a resposta a "por que está ruim" é sempre
 * "abre outra tela". Aqui a linha inteira conta a história — caiu sempre ou caiu
 * num dia — e a célula abre o que estava dentro dela.
 *
 * O total fica à direita, como régua da linha, e não à esquerda: o olho corre o
 * tempo primeiro e chega no total como conclusão.
 */
export function MatrizDoPlacar({
  quebra,
  liquidadas,
  granularidade,
  eixo,
  selo,
}: {
  quebra: Quebra;
  liquidadas: LinhaLiquidada[];
  granularidade: Granularidade;
  eixo: Eixo;
  selo?: (chave: string) => string | null;
}) {
  const [aberta, setAberta] = useState<{ titulo: string; celula: CelulaDaMatriz } | null>(null);
  const { gavetas, linhas } = matriz(liquidadas, quebra, granularidade, eixo);
  const fora = liquidadas.length - linhasDa(quebra, liquidadas).length;

  const abrir = (titulo: string, celula: CelulaDaMatriz | undefined) => {
    if (!celula || celula.linhas.length === 0) return;
    setAberta({ titulo, celula });
  };

  return (
    <section className="rounded-rebrand-md border border-line-2 bg-white">
      <header className="border-b border-line-2 px-5 py-3">
        <h2 className="font-display text-[17px] font-black text-ink">{quebra.titulo}</h2>
        <p className="mt-1 text-[13px] text-ink-2">{quebra.explicacao}</p>
      </header>

      {linhas.length === 0 ? (
        <p className="px-5 py-8 text-[14px] text-ink-2">
          Nenhuma oportunidade liquidada no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                <th className="sticky left-0 bg-white px-5 py-2 font-bold">Grupo</th>
                {gavetas.map((g) => (
                  <th key={g.chave} className="px-3 py-2 text-right font-bold">
                    {g.rotulo}
                  </th>
                ))}
                <th className="px-5 py-2 text-right font-bold text-ink">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave} className="border-b border-line-2 last:border-b-0">
                  <CelulaDoGrupo nome={l.rotulo} selo={selo?.(l.chave) ?? null} />

                  {gavetas.map((g) => {
                    const celula = l.porGaveta[g.chave];
                    return (
                      <td
                        key={g.chave}
                        onClick={() => abrir(`${l.rotulo} · ${g.rotulo}`, celula)}
                        className={`px-3 py-2.5 text-right ${
                          celula ? 'cursor-pointer hover:bg-forest/[0.06]' : ''
                        }`}
                      >
                        <Conteudo celula={celula} />
                      </td>
                    );
                  })}

                  <td
                    onClick={() => abrir(`${l.rotulo} · período inteiro`, l.total)}
                    className="border-l border-line-2 px-5 py-2.5 text-right cursor-pointer hover:bg-forest/[0.06]"
                  >
                    <span className="flex flex-col items-end">
                      <span
                        className={`text-[14px] font-black tabular-nums ${tomDoRoi(l.total.celula.roi)}`}
                      >
                        {roiPct(l.total.celula.roi)}
                      </span>
                      <span className="text-[10px] tabular-nums text-ink-dim">
                        {l.total.celula.n} · {taxaPct(l.total.celula.taxa, 0)} · ±{' '}
                        {epPct(l.total.celula.ep)}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-line-2 px-5 py-2 text-[11px] text-ink-dim">
        Cada célula traz ROI, apostas e acerto. Clique para ver o que está dentro dela.
        {fora > 0 && quebra.notaDosFora && (
          <>
            {' '}
            <strong className="font-bold text-ink-2">
              {fora} aposta{fora > 1 ? 's' : ''} fora desta tabela:
            </strong>{' '}
            {quebra.notaDosFora}
          </>
        )}
      </p>

      <DrillDaCelula
        titulo={aberta?.titulo ?? ''}
        celula={aberta?.celula ?? null}
        aoFechar={() => setAberta(null)}
      />
    </section>
  );
}
