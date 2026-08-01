import { ArrowRight } from "lucide-react";
import { LP_FAQ } from "./lp-faq-data";

/**
 * "Ainda está em dúvida?" Quebra de objeção, no padrão <details> que a
 * /futebol/comecar já usa. As perguntas ficam em lp-faq-data.ts, porque a
 * página também usa a lista pra montar o JSON-LD.
 */
export function LpFaq() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 bg-canvas-2/50">
      <div className="max-w-[680px] mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display text-[26px] sm:text-[34px] font-black leading-[1.1] tracking-tight text-ink">
            Ainda está em dúvida?
          </h2>
        </div>

        <div className="space-y-3">
          {LP_FAQ.map((item) => (
            /* O padding fica no <summary>, não no <details>: só o summary
               alterna, então é ele que precisa ter área de toque. Com o padding
               no cartão, o alvo tinha 23px de altura no celular. */
            <details
              key={item.q}
              className="group rounded-rebrand-md border border-line bg-white overflow-hidden hover:border-line-2 transition-colors"
            >
              <summary className="flex items-center justify-between gap-3 list-none font-bold text-[15px] text-ink px-5 py-4 cursor-pointer min-h-[56px]">
                {item.q}
                <ArrowRight className="w-4 h-4 text-ink-3 group-open:rotate-90 transition-transform shrink-0" />
              </summary>
              <p className="text-[14px] text-ink-2 px-5 pb-4 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>

        <p className="text-[16px] text-ink font-semibold text-center mt-8 leading-snug">
          Você continua no controle da decisão, mas agora com mais informação trabalhando a seu
          favor.
        </p>
      </div>
    </section>
  );
}
