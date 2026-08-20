import { Marcado } from "./Marcado";

// ============================================================
// Bloco da LP 3: "Analisar sem método resulta em RED."
//
// Copy do documento, sem acréscimo: o título e a frase do trabalho manual. No
// documento a prova social entra entre os dois, e na página ela é a faixa de
// números do hero.
//
// As abas são só a tradução visual de "abrir vários sites", com nome genérico
// pra não citar site de terceiro.
// ============================================================

const ABAS = [
  "tabela do campeonato",
  "estatísticas do time da casa",
  "estatísticas do visitante",
  "escalações e desfalques",
  "histórico do confronto",
  "odds da casa 1",
  "odds da casa 2",
  "planilha própria",
];

/** `semCabecalho` = esta LP abriu por este título, então ele não se repete aqui. */
export function LpTrabalhoManual({ semCabecalho = false }: { semCabecalho?: boolean }) {
  return (
    <section className="bg-forest text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(212,160,23,0.12),transparent_55%)] pointer-events-none" />
      <div className="relative px-4 sm:px-6 py-16 sm:py-20">
        {!semCabecalho && (
          <h2 className="max-w-[720px] mx-auto text-center font-display text-[28px] sm:text-[40px] font-black leading-[1.1] tracking-tight text-balance mb-8">
            <Marcado
              tema="escuro"
              texto="Analisar sem método resulta em !!RED!!. A Smart Betting dá método baseado em fato."
            />
          </h2>
        )}

        <p className="max-w-[680px] mx-auto text-[17px] sm:text-[19px] text-white/80 leading-relaxed text-center">
          Para analisar um jogo sozinho, você teria que abrir vários sites, conferir estatística,
          comparar informação e ainda tentar entender o que realmente importa antes de apostar.
        </p>

        <div className="max-w-[620px] mx-auto mt-9">
          <div className="flex flex-wrap justify-center gap-2">
            {ABAS.map((aba) => (
              <span
                key={aba}
                className="inline-flex items-center gap-1.5 rounded-t-[6px] rounded-b-[2px] bg-white/[0.07] border border-white/15 px-2.5 py-1.5 text-[12px] text-white/70"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white/25" />
                {aba}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
