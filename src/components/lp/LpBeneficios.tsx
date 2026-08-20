import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { getFutebolTeamLogoUrl } from "@/utils/futebol-logos";

// ============================================================
// "Mais clareza para analisar. Mais segurança para decidir."
// Benefícios dimensionados (o "você consegue" da copy) com o board de
// oportunidades do lado, pra provar que existe tela por trás da promessa.
//
// PENDENTE: trocar este board por print real do /futebol/oportunidades.
// ============================================================

// Verbos do documento de copy, na ordem: identificar, entender, comparar,
// evitar, tomar.
const CONSEGUE = [
  { verbo: "Identificar", resto: "quando diferentes dados apontam para o mesmo lado" },
  { verbo: "Entender", resto: "por que uma oportunidade foi destacada" },
  { verbo: "Comparar", resto: "jogos com mais rapidez" },
  { verbo: "Evitar", resto: "apostas baseadas apenas em impulso" },
  { verbo: "Tomar", resto: "decisões com critérios mais claros" },
];

const BOARD = [
  { score: 71, casa: "Flamengo", fora: "Palmeiras", casaId: 127, foraId: 121, pick: "Mais de 2,5 gols", odd: "1.95", faixa: "alta" },
  { score: 63, casa: "Grêmio", fora: "Internacional", casaId: 130, foraId: 119, pick: "Grêmio ou empate", odd: "1.58", faixa: "alta" },
  { score: 49, casa: "São Paulo", fora: "Corinthians", casaId: 126, foraId: 131, pick: "Ambos marcam: sim", odd: "1.85", faixa: "media" },
  { score: 34, casa: "Bahia", fora: "Fluminense", casaId: 118, foraId: 124, pick: "Bahia", odd: "2.30", faixa: "baixa" },
] as const;

function badge(faixa: string): string {
  if (faixa === "alta") return "bg-forest text-white";
  if (faixa === "media") return "bg-amber/15 text-amber-2 border border-amber/40";
  return "bg-canvas-2 text-ink-3 border border-line";
}

function Escudo({ teamId, nome }: { teamId: number; nome: string }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={nome}
        onError={() => setErr(true)}
        className="w-[18px] h-[18px] object-contain shrink-0"
        loading="lazy"
      />
    );
  }
  return <span className="w-[18px] h-[18px] rounded-full bg-canvas-2 border border-line shrink-0" />;
}

/**
 * `semCabecalho` = a LP já abriu com este gancho no hero, então o bloco entra
 * direto na lista, sem repetir título e lead.
 */
export function LpBeneficios({ semCabecalho = false }: { semCabecalho?: boolean }) {
  return (
    <section
      className={`px-4 sm:px-6 bg-canvas-2/50 ${semCabecalho ? "pt-10 pb-16 sm:pt-12 sm:pb-24" : "py-16 sm:py-24"}`}
    >
      <div className="max-w-[900px] mx-auto">
        {!semCabecalho && (
          <div className="max-w-[640px]">
            <h2 className="font-display text-[28px] sm:text-[40px] font-black leading-[1.1] tracking-tight text-ink text-balance">
              Mais clareza para analisar. Mais segurança para decidir.
            </h2>
            <p className="text-[17px] text-ink-2 leading-relaxed mt-5">
              Com a Smart Betting você não precisa depender apenas de palpite, de opinião ou de uma
              estatística isolada.
            </p>
          </div>
        )}

        <div
          className={`grid lg:grid-cols-[1fr_minmax(0,340px)] gap-8 lg:gap-10 items-start ${semCabecalho ? "" : "mt-9"}`}
        >
          <div>
            <p className="text-[15px] font-semibold text-ink mb-1">Você consegue:</p>
            <ul className="flex flex-col">
              {CONSEGUE.map((item) => (
                <li
                  key={item.verbo}
                  className="flex items-start gap-3 py-3.5 border-b border-line text-[16px] text-ink-2 leading-snug"
                >
                  <span className="grid place-items-center w-6 h-6 rounded-full bg-forest/10 shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-forest" strokeWidth={3} />
                  </span>
                  <span>
                    <b className="font-bold text-ink">{item.verbo}</b> {item.resto}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Board de oportunidades */}
          <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden shadow-sm">
            <div className="px-4 pt-3.5 pb-2.5 border-b border-line flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">
                  Oportunidades de hoje
                </p>
                <p className="text-[11px] text-ink-3 mt-0.5">Ranqueadas por confiabilidade</p>
              </div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber bg-amber/15 border border-amber/40 rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
                exemplo
              </span>
            </div>
            {BOARD.map((o) => (
              <div
                key={o.pick}
                className="flex items-center gap-2.5 px-4 py-3 border-b border-line last:border-b-0"
              >
                <span
                  className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-[15px] w-9 h-8 shrink-0 ${badge(o.faixa)}`}
                >
                  {o.score}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <Escudo teamId={o.casaId} nome={o.casa} />
                  <Escudo teamId={o.foraId} nome={o.fora} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold tracking-tight text-ink truncate">
                    {o.pick}
                  </div>
                  <div className="text-[10px] text-ink-3 truncate">
                    {o.casa} x {o.fora}
                  </div>
                </div>
                <span className="text-[12px] font-semibold tabular-nums text-ink shrink-0">
                  {o.odd}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-ink-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
