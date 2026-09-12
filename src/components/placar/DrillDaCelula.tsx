import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { resultBadge } from '@/utils/futebol-settlement';
import { emN, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import { margemEmPalavras, placarFinal } from './placar-margem';
import { ordenadoPeloEstrago, type CelulaDaMatriz } from './placar-matriz';
import { rotuloDoMercado } from './placar-vocabulario';
import { brtDayOf } from '@/utils/futebol-datas';

/** A saída, do jeito que o produto a escreve: mercado, lado e linha. */
function saida(market: string, outcome: string, line: number | null): string {
  const linha = line == null ? '' : ` ${line > 0 ? '+' : ''}${String(line).replace('.', ',')}`;
  return `${rotuloDoMercado(market)} · ${outcome}${linha}`;
}

/**
 * O que estava dentro de uma célula.
 *
 * Existe porque a matriz mostra ONDE doeu e não diz por quê, e isso é meio
 * caminho: um −30% numa semana pode ser trinta apostas ruins ou duas apostas de
 * odd alta. A lista abre do PIOR para o melhor, porque quem clica numa célula
 * vermelha está procurando o que deu errado — a primeira linha tem de ser a
 * resposta.
 */
export function DrillDaCelula({
  titulo,
  celula,
  aoFechar,
}: {
  titulo: string;
  celula: CelulaDaMatriz | null;
  aoFechar: () => void;
}) {
  const aberto = celula !== null;
  const linhas = celula ? ordenadoPeloEstrago(celula.linhas) : [];

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="theme-bolao max-h-[85vh] max-w-3xl overflow-y-auto border-line-2 bg-white p-0 text-ink">
        <DialogTitle className="sr-only">{titulo}</DialogTitle>

        {celula && (
          <>
            <header className="sticky top-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-2 bg-white px-5 py-4">
              <h2 className="font-display text-[17px] font-black text-ink">{titulo}</h2>
              <span className={`text-[16px] font-black tabular-nums ${tomDoRoi(celula.celula.roi)}`}>
                {roiPct(celula.celula.roi)}
              </span>
              <span className="text-[12px] text-ink-dim">
                {taxaPct(celula.celula.taxa)} de acerto · {emN(celula.celula.n)} · ±{' '}
                {epPct(celula.celula.ep)}
              </span>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">
                    <th className="px-5 py-2 font-bold">Jogo</th>
                    <th className="px-3 py-2 font-bold">Saída</th>
                    <th className="px-3 py-2 text-right font-bold">Odd</th>
                    <th className="px-3 py-2 text-right font-bold">Score</th>
                    <th className="px-3 py-2 font-bold">Placar</th>
                    <th className="px-3 py-2 font-bold">Resultado</th>
                    <th className="px-5 py-2 text-right font-bold">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const selo = resultBadge(l.veredito);
                    return (
                      <tr key={l.linha.opportunity_key} className="border-b border-line-2 last:border-b-0">
                        <td className="px-5 py-2.5 text-[13px] text-ink">
                          <span className="font-bold">
                            {l.linha.home_team_name} x {l.linha.away_team_name}
                          </span>
                          <span className="ml-2 text-[11px] text-ink-dim">
                            {brtDayOf(l.linha.kickoff_utc)?.slice(8, 10)}/
                            {brtDayOf(l.linha.kickoff_utc)?.slice(5, 7)} ·{' '}
                            {l.linha.competition ?? 'sem campeonato'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[13px] text-ink-2">
                          {saida(l.linha.market, l.linha.outcome, l.linha.line_value)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-ink">
                          {l.linha.best_odd?.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[13px] tabular-nums text-ink-2">
                          {l.linha.score}
                        </td>
                        {/* O placar e a distância até a linha: sem eles, "Red"
                            não diz se faltou um gol ou quatro — e essa é a
                            diferença entre azar e leitura errada do jogo. */}
                        <td className="px-3 py-2.5 text-[13px] text-ink">
                          <span className="font-bold tabular-nums">
                            {placarFinal(l.linha) ?? '—'}
                          </span>
                          {margemEmPalavras(l.linha) && (
                            <span className="ml-1 text-[11px] text-ink-dim">
                              {margemEmPalavras(l.linha)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] font-bold text-ink-2">
                          {selo?.label ?? '—'}
                        </td>
                        {/* O lucro EFETIVO: o de uma unidade multiplicado pelo
                            tamanho que a simulação deu àquela faixa. Mostrar o
                            de uma unidade faria a coluna não fechar com o ROI da
                            célula quando a simulação está ligada. */}
                        <td
                          className={`px-5 py-2.5 text-right text-[13px] font-bold tabular-nums ${
                            l.lucro > 0 ? 'text-forest' : l.lucro < 0 ? 'text-red-600' : 'text-ink-2'
                          }`}
                        >
                          {l.lucro * l.unidades > 0 ? '+' : ''}
                          {(l.lucro * l.unidades).toFixed(2).replace('.', ',')}u
                          {l.unidades !== 1 && (
                            <span className="ml-1 block text-[10px] font-normal text-ink-dim">
                              {String(l.unidades).replace('.', ',')}u apostada
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="border-t border-line-2 px-5 py-3 text-[12px] text-ink-dim">
              Do pior para o melhor. O placar é do jogo, e a distância é até a linha da aposta —
              nos mercados que têm linha. O lucro é em unidades apostadas.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
