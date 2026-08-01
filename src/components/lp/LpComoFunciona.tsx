import { Marcado } from "./Marcado";
import { LpBilheteReal } from "./LpBilheteReal";

// ============================================================
// Bloco 4 do roteiro: "A Smart Betting automatiza esse processo."
//
// Copy do documento: a frase do mecanismo, o "na prática" em três passos, o
// fecho sobre informação organizada, e a prova social que o documento marca no
// fim do bloco.
//
// Única troca de palavra: "convergência dos dados" virou "quantos dados apontam
// para o mesmo lado", pela régua de linguagem simples.
// ============================================================

const PASSOS = [
  {
    num: "01",
    titulo: "O sistema analisa o histórico",
    texto: "Resultado, padrão e comportamento relevantes são processados.",
  },
  {
    num: "02",
    titulo: "Os 10 filtros testam o cenário",
    texto: "Cada critério confirma, enfraquece ou contradiz a oportunidade.",
  },
  {
    num: "03",
    titulo: "Você recebe o resultado da análise",
    texto:
      "Visualiza quantos dados apontam para o mesmo lado e o que sustenta aquela leitura.",
  },
];

export function LpComoFunciona() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20">
      <div className="max-w-[720px] mx-auto text-center">
        <h2 className="font-display text-[28px] sm:text-[38px] font-black leading-[1.1] tracking-tight text-ink text-balance">
          A Smart Betting automatiza esse processo.
        </h2>
        <p className="text-[17px] text-ink-2 leading-relaxed mt-5">
          <Marcado texto="Nossa Inteligência Artificial aplica os 10 filtros, mede ==quantos dados apontam para o mesmo lado== e apresenta uma leitura objetiva da oportunidade." />
        </p>
      </div>

      <div className="max-w-[720px] mx-auto mt-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-forest mb-2">
          Na prática
        </p>
        {PASSOS.map((p) => (
          <div
            key={p.num}
            className="grid grid-cols-[52px_1fr] sm:grid-cols-[76px_1fr] gap-4 sm:gap-6 py-6 border-t border-line last:border-b"
          >
            <span className="font-mono text-3xl sm:text-[42px] font-black text-amber leading-none tabular-nums">
              {p.num}
            </span>
            <div>
              <h3 className="text-[17px] font-bold text-ink mb-1">{p.titulo}</h3>
              <p className="text-[14.5px] text-ink-2 leading-relaxed">{p.texto}</p>
            </div>
          </div>
        ))}

        <p className="text-[16px] text-ink-2 leading-relaxed mt-7 text-center">
          Em vez de reunir informação espalhada, você encontra tudo organizado para decidir com mais
          clareza.
        </p>

        {/* [PROVA SOCIAL] que o documento marca no fim deste bloco */}
        <div className="mt-9">
          <LpBilheteReal />
        </div>
      </div>
    </section>
  );
}
