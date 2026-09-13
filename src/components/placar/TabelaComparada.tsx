import type { Celula } from './placar-agregacao';
import { comparar, type Comparacao } from './placar-comparacao';
import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { Quebra } from './placar-quebras';
import { CelulaDoGrupo } from './CelulaDoGrupo';

/** O par de números de um lado, empilhado para caber no celular. */
function Lado({ celula }: { celula: Celula | null }) {
  if (!celula) {
    return <span className="text-[13px] text-ink-dim">sem aposta</span>;
  }

  return (
    <span className="flex flex-col">
      <span className={`text-[14px] font-bold tabular-nums ${tomDoRoi(celula.roi)}`}>
        {roiPct(celula.roi)}
      </span>
      <span className="text-[12px] text-ink-dim">
        {taxaPct(celula.taxa)} · {emN(celula.n)} · ± {epPct(celula.ep)}
        {celula.anuladas > 0 && ` · ${celula.anuladas} anulada${celula.anuladas > 1 ? 's' : ''}`}
      </span>
    </span>
  );
}

/** O veredito da diferença: um número, ou a frase que impede a conclusão. */
function Diferenca({ c }: { c: Comparacao }) {
  if (c.diferencaRoi === null) {
    return <span className="text-[13px] text-ink-dim">—</span>;
  }

  if (c.dentroDoRuido) {
    return (
      <span className="flex flex-col">
        <span className="text-[13px] text-ink-2">dentro do ruído</span>
        <span className="text-[12px] tabular-nums text-ink-dim">
          {roiPct(c.diferencaRoi)} ± {epPct(c.erroDaDiferenca ?? 0)}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span className={`text-[14px] font-bold tabular-nums ${tomDoRoi(c.diferencaRoi)}`}>
        {roiPct(c.diferencaRoi)}
      </span>
      <span className="text-[12px] tabular-nums text-ink-dim">
        ± {epPct(c.erroDaDiferenca ?? 0)}
      </span>
    </span>
  );
}

/**
 * Uma quebra do placar com dois períodos lado a lado.
 *
 * Cada lado mostra ROI, taxa, denominador, erro-padrão e anuladas, porque
 * comparar dois números sem os dois denominadores é como a comparação engana:
 * "subiu de -30% para +10%" com quatro apostas de cada lado não é notícia.
 *
 * A coluna da diferença só mostra número quando ele passa do próprio erro e os
 * dois lados têm base para sustentá-lo. Fora disso ela diz DENTRO DO RUÍDO — e o
 * número fica pequeno, embaixo, para quem quiser olhar. Essa é a única forma de
 * a tabela não convidar à conclusão que ela mesma não sustenta.
 */
export function TabelaComparada({
  quebra,
  a,
  b,
  selo,
  rotuloDeA,
  rotuloDeB,
}: {
  quebra: Quebra;
  a: Celula[];
  b: Celula[];
  selo?: (chave: string) => string | null;
  rotuloDeA: string;
  rotuloDeB: string;
}) {
  const linhas = comparar(a, b, quebra.ordem);
  const rotulo = quebra.rotulo ?? ((chave: string) => chave);

  return (
    <section className="rounded-rebrand-md border border-line-2 bg-white">
      <header className="border-b border-line-2 px-4 py-3 sm:px-5">
        <h2 className="font-display text-[17px] font-black text-ink">{quebra.titulo}</h2>
        <p className="mt-1 text-[13px] text-ink-2">{quebra.explicacao}</p>
      </header>

      {linhas.length === 0 ? (
        <p className="px-4 py-8 text-[14px] text-ink-2 sm:px-5">
          Nenhuma oportunidade liquidada em nenhum dos dois períodos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                <th className="sticky left-0 z-10 border-r border-line-2 bg-white px-4 py-2.5 font-bold sm:border-r-0 sm:px-5">Grupo</th>
                <th className="whitespace-nowrap px-4 py-2.5 font-bold sm:px-5">{rotuloDeA}</th>
                <th className="whitespace-nowrap px-4 py-2.5 font-bold sm:px-5">{rotuloDeB}</th>
                <th className="whitespace-nowrap px-4 py-2.5 font-bold sm:px-5">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr key={c.chave} className="border-b border-line-2 last:border-b-0">
                  <CelulaDoGrupo nome={rotulo(c.chave)} selo={selo?.(c.chave) ?? null} />
                  <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                    <Lado celula={c.a} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                    <Lado celula={c.b} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                    <Diferenca c={c} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
