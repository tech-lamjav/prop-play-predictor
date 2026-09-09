import { BILHETES_GREEN } from "./lp-bilhetes-green";

/**
 * Bilhetes ganhos, em imagem, abrindo o fecho da página.
 *
 * Fica depois do corpo da LP, quando o argumento já foi feito, e antes de "O
 * que dizem nossos usuários": prova de resultado primeiro, prova de gente
 * depois. O topo da página já tem a faixa de números do mart.
 *
 * O título e a ressalva falam de aposta da própria operação porque é isso que
 * os bilhetes são: nenhum deles corresponde a uma oportunidade publicada, e
 * isso foi conferido no banco (ver o cabeçalho de lp-bilhetes-green.ts, que
 * lista jogo por jogo). Enquanto for assim, esta seção não cita o Score.
 *
 * A REDAÇÃO do título e da ressalva é provisória: ficou de ser decidida depois
 * (08/09/2026). O que não é provisório é o limite — sem citar a metodologia e
 * sem taxa de acerto, enquanto os bilhetes não vierem de picks publicados.
 */
export function LpBilhetesGreen() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-20 bg-canvas-2/50 border-y border-line">
      <div className="max-w-[900px] mx-auto">
        <h2 className="font-display text-[26px] sm:text-[34px] font-black leading-[1.1] tracking-tight text-ink text-center">
          Apostas da nossa operação que deram green
        </h2>

        <div className="mt-9 grid md:grid-cols-3 gap-4 sm:gap-5">
          {BILHETES_GREEN.map((b) => (
            <figure
              key={b.src}
              className="rounded-rebrand-lg border border-line bg-white overflow-hidden flex flex-col shadow-sm"
            >
              {/* O recorte é escuro e vem da casa. O escuro do sistema atrás
                  dele evita a borda clara aparecendo por baixo enquanto carrega. */}
              <div className="bg-ink">
                <img
                  src={b.src}
                  alt={b.alt}
                  width={b.largura}
                  height={b.altura}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto block"
                />
              </div>
              <figcaption className="px-4 py-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-bold text-ink leading-tight">
                  {b.jogo} · {b.placar}
                </span>
                <span className="text-[11.5px] text-ink-3 leading-tight">
                  {b.competicao} · {b.data}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="text-[12.5px] text-ink-3 mt-5 leading-snug text-center max-w-[640px] mx-auto">
          Bilhetes de apostas nossas, escolhidos entre os que ganharam. Não são todas as apostas do
          período, não são uma média e não são recomendação de aposta.
        </p>
      </div>
    </section>
  );
}
