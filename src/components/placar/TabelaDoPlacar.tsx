import type { Celula } from './placar-agregacao';
import { emN, epPct, roiPct, taxaPct } from './placar-formato';

/**
 * Uma tabela de quebra do placar.
 *
 * Sempre as mesmas colunas, em toda quebra: o grupo, o tamanho da base, a taxa
 * de acerto, o ROI e o erro-padrão dele. A repetição é de propósito — o sócio
 * aprende a ler uma tabela e lê todas.
 *
 * O denominador anda junto do número, e não num rodapé: 4 acertos em 6 e 400 em
 * 600 dão a mesma taxa e não dão a mesma informação, e a tabela que esconde o
 * denominador convida a decidir peso de premissa em cima de seis apostas.
 *
 * O erro-padrão tem coluna própria pelo mesmo motivo. Ele não é enfeite: com uma
 * semana de amostra, quase toda diferença entre duas linhas cabe dentro dele.
 */
export function TabelaDoPlacar({
  titulo,
  explicacao,
  celulas,
  rotulo = (chave) => chave,
  marca,
  vazio = 'Nenhuma oportunidade liquidada no período.',
}: {
  titulo: string;
  explicacao?: string;
  celulas: Celula[];
  /** Como o nome do grupo aparece na tela. O padrão é a própria chave. */
  rotulo?: (chave: string) => string;
  /** Um selo ao lado do nome do grupo, quando ele precisa de aviso. */
  marca?: (chave: string) => string | null;
  vazio?: string;
}) {
  return (
    <section className="rounded-rebrand-md border border-line-2 bg-white">
      <header className="border-b border-line-2 px-5 py-3">
        <h2 className="font-display text-[17px] font-black text-ink">{titulo}</h2>
        {explicacao && <p className="mt-1 text-[13px] text-ink-2">{explicacao}</p>}
      </header>

      {celulas.length === 0 ? (
        <p className="px-5 py-8 text-[14px] text-ink-2">{vazio}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                <th className="px-5 py-2.5 font-bold">Grupo</th>
                <th className="px-5 py-2.5 text-right font-bold">Apostas</th>
                <th className="px-5 py-2.5 text-right font-bold">Acerto</th>
                <th className="px-5 py-2.5 text-right font-bold">ROI</th>
                <th className="px-5 py-2.5 text-right font-bold">Erro-padrão</th>
              </tr>
            </thead>
            <tbody>
              {celulas.map((c) => {
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
                    <td className="px-5 py-3 text-right text-[14px] tabular-nums text-ink">
                      {c.n}
                      {c.anuladas > 0 && (
                        <span className="ml-1 text-[12px] text-ink-dim">
                          ({c.anuladas} anulada{c.anuladas > 1 ? 's' : ''})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-[14px] tabular-nums text-ink">
                      {taxaPct(c.taxa)}
                      <span className="ml-1 text-[12px] text-ink-dim">
                        {emN(c.n - c.anuladas)}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3 text-right text-[14px] font-bold tabular-nums ${
                        c.roi > 0 ? 'text-forest' : c.roi < 0 ? 'text-red-600' : 'text-ink'
                      }`}
                    >
                      {roiPct(c.roi)}
                      <span className="ml-1 font-normal text-[12px] text-ink-dim">{emN(c.n)}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums text-ink-2">
                      ± {epPct(c.ep)}
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
