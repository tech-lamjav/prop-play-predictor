import { ArrowRight } from "lucide-react";
import { Marcado } from "./Marcado";
import { LpMockOportunidade } from "./LpMockOportunidade";
import { NUMEROS_PRODUTO } from "./lp-provas";
import type { LpVariant } from "@/pages/lp/variants";

/**
 * Passo 1 do roteiro: o título, o texto de apoio e o [PROVA SOCIAL] que o
 * documento marca logo abaixo. A copy vem do registry, então o mesmo componente
 * serve os quatro títulos.
 *
 * A prova social daqui é a faixa de números reais do mart. Depois dela, o mock
 * do produto vaza pra baixo da dobra: o roteiro é de copy e não fala de imagem,
 * mas alguma hora a página precisa mostrar o que está vendendo, e este é o
 * ponto onde isso não atrapalha a leitura.
 */
export function LpHero({ variant, onCta }: { variant: LpVariant; onCta: () => void }) {
  return (
    <section className="px-4 sm:px-6 pt-12 sm:pt-16">
      <div className="max-w-[720px] mx-auto text-center">
        <h1 className="font-display text-[32px] sm:text-[46px] font-black leading-[1.08] tracking-tight text-ink text-balance">
          <Marcado texto={variant.hero.titulo} />
        </h1>
        {variant.hero.lead && (
          <p className="text-[17px] sm:text-[19px] text-ink-2 leading-relaxed mt-6">
            <Marcado texto={variant.hero.lead} />
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onCta}
            className="inline-flex items-center justify-center gap-2 h-[52px] px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-base shadow-md transition-colors"
          >
            {variant.cta.label}
            <ArrowRight className="h-5 w-5 shrink-0" />
          </button>
          <p className="text-[13px] text-ink-3">{variant.cta.microcopy}</p>
        </div>

        {/* [PROVA SOCIAL] do topo: número real do mart, não depoimento */}
        <div className="mt-9 border-y border-line py-3.5 flex flex-col sm:flex-row items-center justify-center gap-y-1.5 sm:gap-x-7 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          {NUMEROS_PRODUTO.map((n, i) => (
            <span key={n.rotulo} className="flex items-center gap-2">
              {i > 0 && <span className="hidden sm:inline text-amber-2">·</span>}
              <span>
                <b className="font-bold text-ink">{n.valor}</b> {n.rotulo}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-[900px] mx-auto mt-10 sm:mt-12">
        <LpMockOportunidade />
      </div>
    </section>
  );
}
