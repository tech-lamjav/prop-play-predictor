import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CartaoDoGrupo } from './CartaoDoGrupo';
import { apostasEmPalavras, epPct, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { Granularidade } from './placar-evolucao';
import {
  escalaDaTirinha,
  matriz,
  type CelulaDaMatriz,
  type LinhaDaMatriz,
  type Matriz,
} from './placar-matriz';
import type { Eixo } from './placar-periodo';
import type { Quebra } from './placar-quebras';

/** O cabeçalho da lista do tempo, do jeito que se fala dela. */
const O_TEMPO_EM_LISTA: Record<Granularidade, string> = {
  mes: 'Mês a mês',
  semana: 'Semana a semana',
  dia: 'Dia a dia',
};

/** Uma ficha aberta: o caminho até ela, a linha, e o degrau que ela ainda abre. */
export type FichaAberta = {
  caminho: string;
  linha: LinhaDaMatriz;
  /** Só a ficha do primeiro nível desce: Gols · Alta aberto por mercado seria Gols de novo. */
  dentro?: Quebra;
};

/**
 * A ficha de uma linha, em tela cheia — o celular no lugar da linha da matriz.
 *
 * No desktop a linha corre o tempo para a DIREITA; aqui ele corre para BAIXO,
 * porque para baixo o celular tem espaço e para o lado não. É a mesma leitura
 * do macro para o micro, sem nenhuma rolagem lateral:
 *
 *   · o topo diz quanto a linha rendeu no período;
 *   · a lista do tempo diz em qual semana, do mais recente para o mais antigo
 *     — no celular se acompanha, e o que se quer ver primeiro é a semana que
 *     acabou de fechar;
 *   · o degrau de dentro diz de onde veio: Gols por faixa, a faixa por mercado.
 *
 * Toda linha da lista abre as apostas dela, como a célula abria.
 */
export function FichaDaLinha({
  aberta,
  gavetas,
  granularidade,
  eixo,
  podeVoltar,
  aoVoltar,
  aoFechar,
  aoAbrirApostas,
  aoAbrirDegrau,
}: {
  aberta: FichaAberta | null;
  /** As gavetas da lista de onde a ficha saiu, para as tirinhas se alinharem. */
  gavetas: Matriz['gavetas'];
  granularidade: Granularidade;
  eixo: Eixo;
  podeVoltar: boolean;
  aoVoltar: () => void;
  aoFechar: () => void;
  aoAbrirApostas: (titulo: string, celula: CelulaDaMatriz) => void;
  aoAbrirDegrau: (ficha: FichaAberta) => void;
}) {
  const sub = aberta?.dentro
    ? matriz(aberta.linha.total.linhas, aberta.dentro, granularidade, eixo)
    : null;

  return (
    <Dialog open={aberta !== null} onOpenChange={(v) => !v && aoFechar()}>
      {/* Tela cheia, e não um modal no meio: a ficha é uma tela de leitura, e
          margem em volta de lista comprida é espaço que falta à lista. O X
          padrão do Dialog some porque ele rola junto com o conteúdo; o fechar
          daqui mora no cabeçalho, que fica preso. */}
      <DialogContent
        aria-describedby={undefined}
        className="theme-bolao left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-0 bg-canvas p-0 text-ink data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:rounded-none [&>button:last-child]:hidden"
      >
        {aberta && (
          <>
            <header className="sticky top-0 z-10 border-b border-line-2 bg-white px-4 pb-4 pt-3">
              <div className="flex h-8 items-center justify-between">
                {podeVoltar ? (
                  <button
                    type="button"
                    onClick={aoVoltar}
                    className="-ml-1 flex items-center gap-0.5 py-1 text-[13px] font-bold text-ink-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Voltar
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={aoFechar}
                  aria-label="Fechar"
                  className="-mr-1 p-1 text-ink-dim"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <DialogTitle className="mt-1 font-display text-[18px] font-black leading-tight tracking-normal text-ink">
                {aberta.caminho}
              </DialogTitle>
              <p
                className={`mt-2 font-display text-[48px] font-black leading-none ${tomDoRoi(
                  aberta.linha.total.celula.roi,
                )}`}
              >
                {roiPct(aberta.linha.total.celula.roi)}
              </p>
              <p className="mt-1.5 text-[12px] text-ink-dim">
                {taxaPct(aberta.linha.total.celula.taxa)} de acerto ·{' '}
                {apostasEmPalavras(aberta.linha.total.celula.n)} · ±{' '}
                {epPct(aberta.linha.total.celula.ep)}
              </p>
            </header>

            <div className="flex flex-col gap-5 px-4 py-4">
              <button
                type="button"
                onClick={() => aoAbrirApostas(`${aberta.caminho} · período inteiro`, aberta.linha.total)}
                className="flex items-center justify-between rounded-rebrand-md border border-line-2 bg-white px-4 py-3 text-left text-[14px] font-bold text-ink"
              >
                {aberta.linha.total.celula.n === 1
                  ? 'Ver a aposta'
                  : `Ver as ${aberta.linha.total.celula.n} apostas`}
                <ChevronRight className="h-4 w-4 text-ink-dim" />
              </button>

              <section>
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
                  {O_TEMPO_EM_LISTA[granularidade]}
                </h3>
                <ul className="mt-2 divide-y divide-line-2 rounded-rebrand-md border border-line-2 bg-white">
                  {[...gavetas]
                    .reverse()
                    .filter((g) => aberta.linha.porGaveta[g.chave])
                    .map((g) => {
                      const c = aberta.linha.porGaveta[g.chave];
                      return (
                        <li key={g.chave}>
                          <button
                            type="button"
                            onClick={() => aoAbrirApostas(`${aberta.caminho} · ${g.rotulo}`, c)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left"
                          >
                            <span className="w-12 text-[13px] font-bold tabular-nums text-ink">
                              {g.rotulo}
                            </span>
                            <span className="flex-1 text-[12px] tabular-nums text-ink-dim">
                              {c.celula.n} · {taxaPct(c.celula.taxa, 0)}
                            </span>
                            <span
                              className={`text-[15px] font-black tabular-nums ${tomDoRoi(c.celula.roi)}`}
                            >
                              {roiPct(c.celula.roi)}
                            </span>
                            <ChevronRight className="h-4 w-4 text-ink-dim" />
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </section>

              {aberta.dentro && sub && sub.linhas.length > 0 && (
                <section>
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-dim">
                    {aberta.dentro.titulo}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {sub.linhas.map((s) => (
                      <li key={s.chave}>
                        <CartaoDoGrupo
                          linha={s}
                          gavetas={gavetas}
                          escala={escalaDaTirinha(sub.linhas)}
                          granularidade={granularidade}
                          aoAbrir={() =>
                            aoAbrirDegrau({ caminho: `${aberta.caminho} · ${s.rotulo}`, linha: s })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
