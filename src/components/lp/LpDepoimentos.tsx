import { Quote } from "lucide-react";
import { DEPOIMENTOS_FICTICIOS } from "./lp-depoimentos-ficticios";

/**
 * "O que dizem nossos usuários", bloco do documento de copy.
 *
 * Os depoimentos são FICTÍCIOS e existem só pra aprovar o layout: têm que ser
 * trocados por depoimento real com autorização antes de qualquer anúncio
 * apontar pra cá (ver o aviso em lp-depoimentos-ficticios.ts).
 */
export function LpDepoimentos() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-[900px] mx-auto">
        <h2 className="font-display text-[26px] sm:text-[34px] font-black leading-[1.1] tracking-tight text-ink text-center">
          O que dizem nossos usuários
        </h2>

        <div className="mt-9 grid md:grid-cols-3 gap-3 sm:gap-4">
          {DEPOIMENTOS_FICTICIOS.map((d) => (
            <figure
              key={d.nome}
              className="rounded-rebrand-lg border border-line bg-white p-5 flex flex-col"
            >
              <Quote className="w-5 h-5 text-amber shrink-0 mb-3" strokeWidth={2.5} />
              <blockquote className="text-[14.5px] text-ink leading-relaxed flex-1">
                {d.texto}
              </blockquote>
              <figcaption className="flex items-center gap-2.5 mt-4 pt-4 border-t border-line">
                <span className="grid place-items-center w-8 h-8 rounded-full bg-forest text-white text-[13px] font-bold shrink-0">
                  {d.nome.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-ink leading-tight">
                    {d.nome}
                  </span>
                  <span className="block text-[11.5px] text-ink-3 leading-tight mt-0.5">
                    {d.contexto}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
