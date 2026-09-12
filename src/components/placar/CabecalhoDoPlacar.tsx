import { AbasDaArea } from '@/components/socios/AbasDaArea';

/**
 * A faixa de identidade do placar, irmã da do CRM.
 *
 * Mesma forma da faixa do CRM de propósito: os dois andares são a mesma área, e
 * mudar a moldura entre eles faria parecer que o sócio trocou de produto. O que
 * muda é o nome e o resumo.
 */
export function CabecalhoDoPlacar({ resumo }: { resumo: string }) {
  return (
    <div className="border-b border-line-2 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
        <h1 className="font-display text-2xl font-black text-ink">Metodologia</h1>
        <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
          Uso interno
        </span>
        <p className="text-[13px] text-ink-2">{resumo}</p>
      </div>

      {/* Em linha própria e à esquerda, igual à faixa do CRM: no canto direito
          da linha de cima as abas ficavam embaixo do menu de perfil, que abre
          por cima delas. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3">
        <AbasDaArea />
      </div>
    </div>
  );
}
