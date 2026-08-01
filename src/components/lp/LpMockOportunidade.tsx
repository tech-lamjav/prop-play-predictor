import { useState } from "react";
import { getFutebolTeamLogoUrl } from "@/utils/futebol-logos";

// ============================================================
// Mock fiel da tela de oportunidade do Futebol, dentro de moldura de navegador.
// Mesma convenção das LPs aprovadas: dados de exemplo declarados no selo, e o
// que aparece aqui é o que o produto realmente mostra (Score de 0 a 100,
// chance, odd, por quê e pontos de atenção). Os 10 filtros NÃO entram neste
// mock: eles são linguagem da página, explicada no diagrama, não uma tela.
// ============================================================

function Escudo({ teamId, nome, size = 20 }: { teamId: number; nome: string; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={nome}
        onError={() => setErr(true)}
        style={{ width: size, height: size }}
        className="object-contain shrink-0"
        loading="lazy"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-canvas-2 border border-line grid place-items-center text-[9px] font-bold text-ink-2 shrink-0"
    >
      {nome.slice(0, 3).toUpperCase()}
    </div>
  );
}

// As premissas aqui são as que sobreviveram à recalibragem
// (docs/premissas-recalibragem.md). Nada de confronto direto nem de ritmo de
// jogo: as duas foram medidas, deram ganho zero ou negativo contra o preço e
// saíram da metodologia.
const PORQUE = [
  "Os dois somam muitos gols jogando em casa e fora",
  "Ataques entre os melhores do campeonato",
  "A defesa do visitante vem sendo vazada com frequência",
];

const ATENCAO = [
  "O Palmeiras tem segurado o placar fora de casa",
  "Se o Flamengo sair na frente cedo, pode controlar o jogo",
];

export function LpMockOportunidade() {
  return (
    <div className="rounded-rebrand-xl overflow-hidden shadow-2xl border border-line-2 bg-canvas">
      {/* Barra de janela */}
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        </div>
        <span className="font-mono text-[10px] sm:text-[11px] text-white/50 truncate">
          smartbetting.app/futebol/oportunidades
        </span>
        <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber bg-amber/15 border border-amber/40 rounded-full px-2 py-0.5 whitespace-nowrap">
          dados de exemplo
        </span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="rounded-rebrand-lg overflow-hidden bg-white border border-line">
          <div className="px-4 sm:px-5 py-3 flex items-center justify-between bg-canvas-2 border-b border-line">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">
              O que olhar neste jogo
            </div>
            <span className="text-[11px] font-semibold text-forest">Valor forte</span>
          </div>

          <div className="p-4 sm:p-5 grid sm:grid-cols-[1fr_200px] gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[11px] text-ink-3 mb-2">
                <Escudo teamId={127} nome="Flamengo" size={18} />
                <Escudo teamId={121} nome="Palmeiras" size={18} />
                <span className="ml-1 truncate">Flamengo x Palmeiras · Brasileirão</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">
                  Gols (mais ou menos)
                </span>
                <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] bg-forest text-white">
                  Faixa Alta
                </span>
              </div>
              <div className="text-2xl sm:text-[28px] font-bold tracking-tight mt-2 text-ink leading-tight">
                Mais de 2,5 gols
              </div>

              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-forest">
                  Por quê
                </div>
                <ul className="flex flex-col gap-1.5">
                  {PORQUE.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-forest" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-amber-2">
                  Pontos de atenção
                </div>
                <ul className="flex flex-col gap-1.5">
                  {ATENCAO.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Painel de confiabilidade: os 10 filtros terminam nesta nota */}
            <div className="sm:pl-5 sm:border-l sm:border-line flex flex-col gap-3">
              <div
                className="rounded-rebrand-md p-4 text-white"
                style={{ background: "linear-gradient(135deg, #0a3d2e, #08321f)" }}
              >
                <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">
                  Confiabilidade
                </div>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span
                    className="text-[44px] font-bold tabular-nums tracking-tight leading-none"
                    style={{ color: "#fbbf24" }}
                  >
                    71
                  </span>
                  <span className="text-[13px] text-white/40">/100</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">
                      Chance
                    </div>
                    <div className="text-[18px] font-semibold tabular-nums leading-none mt-1">58%</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">
                      Odd
                    </div>
                    <div className="text-[18px] font-semibold tabular-nums leading-none mt-1">1.95</div>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-ink-3 leading-snug">
                Leitura de risco, não recomendação de aposta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
