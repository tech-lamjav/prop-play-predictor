import { ChevronRight } from 'lucide-react';
import { apostasEmPalavras, roiPct, taxaPct, tomDoRoi } from './placar-formato';
import type { Granularidade } from './placar-evolucao';
import type { LinhaDaMatriz, Matriz } from './placar-matriz';
import { TirinhaDoTempo } from './TirinhaDoTempo';

/**
 * Uma linha da matriz, do jeito que ela cabe num celular.
 *
 * Três coisas, na ordem em que se lê: quem é o grupo, quanto ele rendeu no
 * período e o formato disso ao longo do tempo. O cartão inteiro é UM alvo de
 * toque, e ele abre a ficha da linha — no desktop a linha tinha dois (a seta
 * e a célula), e dois alvos pequenos na mesma linha é como o dedo erra.
 */
export function CartaoDoGrupo({
  linha,
  selo,
  gavetas,
  escala,
  granularidade,
  aoAbrir,
}: {
  linha: LinhaDaMatriz;
  selo?: string | null;
  gavetas: Matriz['gavetas'];
  escala: number;
  granularidade: Granularidade;
  aoAbrir: () => void;
}) {
  const { celula } = linha.total;

  return (
    <button
      type="button"
      onClick={aoAbrir}
      className="flex w-full flex-col gap-2.5 rounded-rebrand-md border border-line-2 bg-white px-4 py-3 text-left transition active:bg-canvas"
    >
      <span className="flex w-full items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold text-ink">
            {linha.rotulo}
            {selo && (
              <span className="rounded-full bg-forest/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-forest">
                {selo}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-dim">
            {apostasEmPalavras(celula.n)} · {taxaPct(celula.taxa, 0)} de acerto
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1">
          <span className={`font-display text-[22px] font-black leading-none ${tomDoRoi(celula.roi)}`}>
            {roiPct(celula.roi)}
          </span>
          <ChevronRight className="h-4 w-4 text-ink-dim" />
        </span>
      </span>

      <TirinhaDoTempo
        gavetas={gavetas}
        porGaveta={linha.porGaveta}
        escala={escala}
        granularidade={granularidade}
      />
    </button>
  );
}
