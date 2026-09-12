import type { Celula } from './placar-agregacao';
import { comparar, type Comparacao } from './placar-comparacao';
import { emN, epPct, roiPct, taxaPct } from './placar-formato';

/** O par de números de um lado, empilhado para caber no celular. */
function Lado({ celula }: { celula: Celula | null }) {
  if (!celula) {
    return <span className="text-[13px] text-ink-dim">sem aposta</span>;
  }

  return (
    <span className="flex flex-col">
      <span
        className={`text-[14px] font-bold tabular-nums ${
          celula.roi > 0 ? 'text-forest' : celula.roi < 0 ? 'text-red-600' : 'text-ink'
        }`}
      >
        {roiPct(celula.roi)}
      </span>
      <span className="text-[12px] text-ink-dim">
        {taxaPct(celula.taxa)} · {emN(celula.n)} · ± {epPct(celula.ep)}
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
        <span className="text-[12px] text-ink-dim tabular-nums">
          {roiPct(c.diferencaRoi)} ± {epPct(c.erroDaDiferenca ?? 0)}
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span
        className={`text-[14px] font-bold tabular-nums ${
          c.diferencaRoi > 0 ? 'text-forest' : 'text-red-600'
        }`}
      >
        {roiPct(c.diferencaRoi)}
      </span>
      <span className="text-[12px] text-ink-dim tabular-nums">
        ± {epPct(c.erroDaDiferenca ?? 0)}
      </span>
    </span>
  );
}

/**
 * Uma quebra do placar com dois períodos lado a lado.
 *
 * Cada lado mostra ROI, taxa e denominador, porque comparar dois números sem os
 * dois denominadores é como a comparação engana: "subiu de -30% para +10%" com
 * quatro apostas de cada lado não é notícia.
 *
 * A coluna da diferença só mostra número quando ele passa do próprio erro. Não
 * passando, ela diz DENTRO DO RUÍDO — e o número fica pequeno, embaixo, para
 * quem quiser olhar. Essa é a única forma de a tabela não convidar à conclusão
 * que ela mesma não sustenta.
 */
export function TabelaComparada({
  titulo,
  explicacao,
  a,
  b,
  ordem,
  rotulo = (chave) => chave,
  marca,
  rotuloDeA,
  rotuloDeB,
}: {
  titulo: string;
  explicacao?: string;
  a: Celula[];
  b: Celula[];
  ordem?: readonly string[];
  rotulo?: (chave: string) => string;
  marca?: (chave: string) => string | null;
  rotuloDeA: string;
  rotuloDeB: string;
}) {
  const linhas = comparar(a, b, ordem);

  return (
    <section className="rounded-rebrand-md border border-line-2 bg-white">
      <header className="border-b border-line-2 px-5 py-3">
        <h2 className="font-display text-[17px] font-black text-ink">{titulo}</h2>
        {explicacao && <p className="mt-1 text-[13px] text-ink-2">{explicacao}</p>}
      </header>

      {linhas.length === 0 ? (
        <p className="px-5 py-8 text-[14px] text-ink-2">
          Nenhuma oportunidade liquidada em nenhum dos dois períodos.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                <th className="px-5 py-2.5 font-bold">Grupo</th>
                <th className="px-5 py-2.5 font-bold">{rotuloDeA}</th>
                <th className="px-5 py-2.5 font-bold">{rotuloDeB}</th>
                <th className="px-5 py-2.5 font-bold">Diferença</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => {
                const selo = marca?.(c.chave) ?? null;

                return (
                  <tr key={c.chave} className="border-b border-line-2 last:border-b-0">
                    <td className="px-5 py-3 text-[14px] font-bold text-ink">
                      {rotulo(c.chave)}
                      {selo && (
                        <span className="ml-2 rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-forest">
                          {selo}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Lado celula={c.a} />
                    </td>
                    <td className="px-5 py-3">
                      <Lado celula={c.b} />
                    </td>
                    <td className="px-5 py-3">
                      <Diferenca c={c} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
