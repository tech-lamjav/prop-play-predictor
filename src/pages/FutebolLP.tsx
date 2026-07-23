import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { faqPageSchema, type FaqItem } from "@/lib/structured-data";
import { useAuth } from "@/hooks/use-auth";
import { PlayCircle, ArrowRight, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { getFutebolTeamLogoUrl } from "@/utils/futebol-logos";

// ============================================================
// FutebolLP — landing page pública do módulo de Futebol (Aposta de Valor).
// Mesma fórmula/voz das LPs aprovadas (/nba, /bolao): hero product-led →
// mock fiel emoldurado (board de Oportunidades → card "O que olhar") →
// faixa de fatos → lista editorial → manifesto anti-tipster → FAQ → CTA.
// Sem prova social inventada. Tema rebrand (theme-bolao).
// ============================================================

type Faixa = "Alta" | "Média" | "Baixa";

interface MockOpp {
  id: string;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  comp: string;
  hora: string;
  market: string;
  pick: string;
  faixa: Faixa;
  score: number;
  chance: number; // %
  odd: number;
  edge: number; // 0..1
  porque: string[];
  atencao: string[];
}

// Dados de exemplo (fictícios, internamente coerentes) — espelham o board real.
const OPPS: MockOpp[] = [
  {
    id: "fla-pal", home: "Flamengo", away: "Palmeiras", homeId: 127, awayId: 121, comp: "Brasileirão", hora: "16:00",
    market: "Gols (Over/Under)", pick: "Mais de 2,5 gols", faixa: "Alta", score: 71,
    chance: 58, odd: 1.95, edge: 0.043,
    porque: ["Os dois somam muitos gols (casa + fora)", "Ataques entre os melhores do campeonato", "Confronto recente com 3+ gols na maioria das vezes"],
    atencao: ["Palmeiras às vezes segura o ritmo fora de casa", "Se o Flamengo sair na frente cedo, pode controlar"],
  },
  {
    id: "gre-int", home: "Grêmio", away: "Internacional", homeId: 130, awayId: 119, comp: "Brasileirão", hora: "18:30",
    market: "Dupla chance", pick: "Grêmio ou empate", faixa: "Alta", score: 63,
    chance: 68, odd: 1.58, edge: 0.034,
    porque: ["Grêmio forte como mandante", "Internacional oscila longe de casa", "Clássico equilibrado — o empate protege a aposta"],
    atencao: ["Inter vem em sequência melhor de resultados", "Em clássico, o mando pesa menos"],
  },
  {
    id: "sao-cor", home: "São Paulo", away: "Corinthians", homeId: 126, awayId: 131, comp: "Brasileirão", hora: "21:00",
    market: "Ambos marcam", pick: "Sim", faixa: "Média", score: 49,
    chance: 55, odd: 1.85, edge: 0.018,
    porque: ["Os dois balançam a rede com frequência", "Defesas vazadas nas últimas rodadas"],
    atencao: ["São Paulo costuma jogar mais fechado em casa", "Clássico tende a ser truncado no começo"],
  },
  {
    id: "bah-flu", home: "Bahia", away: "Fluminense", homeId: 118, awayId: 124, comp: "Brasileirão", hora: "19:00",
    market: "Resultado (1X2)", pick: "Bahia", faixa: "Baixa", score: 34,
    chance: 44, odd: 2.30, edge: 0.011,
    porque: ["Leve vantagem do mando"],
    atencao: ["A odd está perto do justo — valor magro", "Fluminense reage bem fora de casa"],
  },
];

function faixaBadge(faixa: Faixa): string {
  if (faixa === "Alta") return "bg-forest text-white";
  if (faixa === "Média") return "bg-amber/15 text-amber-2 border border-amber/40";
  return "bg-canvas-2 text-ink-3 border border-line";
}

function verdict(edge: number): { label: string; color: string } {
  const e = edge * 100;
  if (e >= 4) return { label: "Valor forte", color: "text-forest" };
  if (e >= 2) return { label: "Valor", color: "text-amber-2" };
  return { label: "Valor leve", color: "text-amber-2" };
}

function crestInitials(name: string): string {
  return name.replace(/[^A-Za-zÀ-ÿ\s]/g, "").trim().slice(0, 3).toUpperCase() || "?";
}

function Crest({ teamId, name, size = 22 }: { teamId: number; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={name}
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
      {crestInitials(name)}
    </div>
  );
}

const FutebolLP = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(OPPS[0].id);
  const selected = useMemo(() => OPPS.find((o) => o.id === selectedId) ?? OPPS[0], [selectedId]);
  const v = verdict(selected.edge);

  const comValor = OPPS.filter((o) => o.score >= 40);
  const semValor = OPPS.filter((o) => o.score < 40);

  const goAuth = () => navigate("/auth");
  const goProduct = () => navigate("/futebol");

  const FAQ: FaqItem[] = [
    {
      q: "O que é uma aposta de 'valor'?",
      a: "É quando a odd paga mais do que a chance real do evento. Se algo acontece em ~55% das vezes, a odd justa é ~1.82; se a casa paga 2.00, tem valor. A gente acha essas diferenças e ranqueia por confiabilidade.",
    },
    {
      q: "Vocês dão dica de aposta?",
      a: "A gente mapeia onde a odd paga mais do que o risco e mostra com o porquê do lado. O que não fazemos é mandar 'entrada garantida' nem dizer quanto apostar. Quem bate o martelo é você.",
    },
    {
      q: "É grátis pra testar?",
      a: "São 7 dias de Premium completo, sem cartão. Depois segue free: você continua vendo o Score, a leitura do jogo, a classificação e os times — só o pick de valor de cada oportunidade fica bloqueado.",
    },
    {
      q: "Preciso entender de estatística?",
      a: "Não. Cada oportunidade vem mastigada: o lado, a odd, a chance estimada e o porquê. O Score (0–100) resume o quanto dá pra confiar naquela aposta.",
    },
    {
      q: "De onde vêm os dados?",
      a: "Estatísticas oficiais dos jogos e odds pré-jogo das principais casas, do Brasileirão e da Copa do Mundo, atualizadas ao longo do dia.",
    },
    {
      q: "Qual a taxa de acerto de vocês?",
      a: "Não publicamos taxa de acerto. O que você recebe é o dado e o porquê antes de apostar — a chance estimada, a odd e as premissas. Quem avalia se a oportunidade vale é você, com o número na frente.",
    },
  ];

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo
        jsonLd={faqPageSchema(FAQ)}
        path="/futebol/comecar"
        title="Aposta de Valor no Futebol — Brasileirão e Copa | Smart Betting"
        description="Um Score de Confiabilidade que compara a chance real com a odd da casa e mostra onde a odd paga mais do que o risco. Brasileirão e Copa do Mundo. 7 dias grátis, sem cartão."
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <img src="/logo.png" alt="Smart Betting" className="h-9 invert hue-rotate-180" />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(user ? "/futebol" : "/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              {user ? "Acessar" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={goAuth}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              Começar Grátis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-forest text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-forest via-forest-2 to-forest pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(212,160,23,0.16),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-40 sm:pb-56">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-5">
            Futebol · Aposta de Valor
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
            Não precisa cravar o placar.<br />
            <span className="text-amber">Só achar a odd que paga demais.</span>
          </h1>
          <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
            Pra cada jogo, a gente estima a chance real e compara com a odd da casa.
            Quando a odd paga mais do que o risco, tem valor — e a gente ranqueia por um
            Score de Confiabilidade de 0 a 100. Testa num jogo real:{" "}
            <span className="text-white font-semibold">clica numa oportunidade aí embaixo.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={goAuth}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5 shrink-0" />
              Criar conta — 7 dias grátis
            </button>
            <button
              type="button"
              onClick={goProduct}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-white text-forest hover:bg-white/90 font-bold text-[15px] shadow-md transition-colors"
            >
              Espiar sem login
            </button>
          </div>
          <p className="text-[12px] text-white/55 mt-4">
            7 dias de Premium, sem cartão · Depois segue free com a análise toda · Sem promessa de lucro, a decisão é sua
          </p>
        </div>
      </section>

      {/* Produto vazando a dobra — board → card "O que olhar" */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 -mt-28 sm:-mt-40">
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
            <div className="grid lg:grid-cols-[340px_1fr] gap-3">
              {/* Board de oportunidades */}
              <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
                <div className="px-4 pt-3.5 pb-2.5 border-b border-line">
                  <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Oportunidades de hoje</p>
                  <p className="text-[11px] text-ink-3 mt-0.5">Ranqueadas por confiabilidade · clique pra abrir</p>
                </div>
                {comValor.map((o) => {
                  const active = o.id === selectedId;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className={`w-full text-left flex items-center gap-2.5 px-4 py-3 border-b border-line transition-colors ${active ? "bg-forest/[0.06]" : "hover:bg-canvas-2"}`}
                    >
                      <span className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-[15px] w-9 h-8 shrink-0 ${faixaBadge(o.faixa)}`}>{o.score}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Crest teamId={o.homeId} name={o.home} size={18} />
                        <Crest teamId={o.awayId} name={o.away} size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold tracking-tight text-ink truncate">{o.pick}</div>
                        <div className="text-[10px] text-ink-3 truncate">{o.home} × {o.away} · {o.hora}</div>
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums text-ink shrink-0">{o.odd.toFixed(2)}</span>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${active ? "text-forest" : "text-ink-3"}`} />
                    </button>
                  );
                })}
                {/* Régua */}
                <div className="px-4 py-2 flex items-center gap-2 bg-canvas-2">
                  <span className="flex-1 h-px bg-line" />
                  <span className="text-[10px] text-ink-3">abaixo: sem valor claro</span>
                  <span className="flex-1 h-px bg-line" />
                </div>
                {semValor.map((o) => {
                  const active = o.id === selectedId;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedId(o.id)}
                      className={`w-full text-left flex items-center gap-2.5 px-4 py-3 border-b border-line last:border-b-0 opacity-60 transition-colors ${active ? "bg-forest/[0.06]" : "hover:bg-canvas-2"}`}
                    >
                      <span className={`inline-flex items-center justify-center rounded-md font-bold tabular-nums text-[15px] w-9 h-8 shrink-0 ${faixaBadge(o.faixa)}`}>{o.score}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Crest teamId={o.homeId} name={o.home} size={18} />
                        <Crest teamId={o.awayId} name={o.away} size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold tracking-tight text-ink truncate">{o.pick}</div>
                        <div className="text-[10px] text-ink-3 truncate">{o.home} × {o.away} · {o.hora}</div>
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums text-ink shrink-0">{o.odd.toFixed(2)}</span>
                      <ChevronRight className="w-4 h-4 shrink-0 text-ink-3" />
                    </button>
                  );
                })}
              </div>

              {/* Card "O que olhar" do selecionado */}
              <div className="rounded-rebrand-lg overflow-hidden bg-white border border-line min-w-0">
                <div className="px-4 sm:px-5 py-3 flex items-center justify-between bg-canvas-2 border-b border-line">
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">O que olhar neste jogo</div>
                  <span className={`text-[11px] font-semibold ${v.color}`}>{v.label}</span>
                </div>
                <div className="p-4 sm:p-5 grid sm:grid-cols-[1fr_200px] gap-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-ink-3 mb-2">
                      <Crest teamId={selected.homeId} name={selected.home} size={18} />
                      <Crest teamId={selected.awayId} name={selected.away} size={18} />
                      <span className="ml-1 truncate">{selected.home} × {selected.away} · {selected.comp}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{selected.market}</span>
                      <span className={`px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] ${faixaBadge(selected.faixa)}`}>Faixa {selected.faixa}</span>
                    </div>
                    <div className="text-2xl sm:text-[28px] font-bold tracking-tight mt-2 text-ink leading-tight">{selected.pick}</div>
                    <div className="mt-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-forest">Por quê</div>
                      <ul className="flex flex-col gap-1.5">
                        {selected.porque.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-forest" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {selected.atencao.length > 0 && (
                      <div className="mt-4">
                        <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-amber-2">Pontos de atenção</div>
                        <ul className="flex flex-col gap-1.5">
                          {selected.atencao.map((p, i) => (
                            <li key={i} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* Painel de confiabilidade */}
                  <div className="sm:pl-5 sm:border-l sm:border-line flex flex-col gap-3">
                    <div className="rounded-rebrand-md p-4 text-white" style={{ background: "linear-gradient(135deg, #0a3d2e, #08321f)" }}>
                      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">Confiabilidade</div>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-[44px] font-bold tabular-nums tracking-tight leading-none" style={{ color: "#fbbf24" }}>{selected.score}</span>
                        <span className="text-[13px] text-white/40">/100</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">Chance</div>
                          <div className="text-[18px] font-semibold tabular-nums leading-none mt-1">{selected.chance}%</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">Odd</div>
                          <div className="text-[18px] font-semibold tabular-nums leading-none mt-1">{selected.odd.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-ink-3 leading-snug">Leitura de risco, não recomendação de aposta.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA abaixo do produto */}
        <div className="text-center mt-8 sm:mt-10">
          <button
            type="button"
            onClick={goProduct}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
          >
            <PlayCircle className="h-5 w-5" />
            Ver as oportunidades de verdade
          </button>
          <p className="text-sm text-ink-3 mt-3">
            Sem login pra olhar · 7 dias de Premium ao criar a conta
          </p>
        </div>
      </section>

      {/* Faixa de fatos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 sm:mt-20">
        <div className="border-y border-line py-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span>5 mercados de valor</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Score 0–100</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Odds pré-jogo (não ao vivo)</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Brasileirão + Copa do Mundo</span>
        </div>
      </section>

      {/* O que tem dentro — lista editorial numerada */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="grid md:grid-cols-[minmax(220px,300px)_1fr] gap-10 md:gap-16">
          <div className="md:sticky md:top-24 self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">O que tem dentro</p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
              O valor não tá na cara. A gente acha pra você.
            </h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Achar uma aposta de valor na mão dá trabalho: estimar a chance real, tirar a margem da casa,
              comparar com a melhor odd. A plataforma faz essa conta em todo jogo.
            </p>
          </div>

          <div>
            {[
              {
                num: "01",
                title: "Oportunidades de valor",
                text: "A cada jogo, comparamos a chance real com a odd da casa. Onde a odd paga mais do que o risco, vira oportunidade — e ela chega ranqueada por confiabilidade, como no exemplo lá em cima.",
              },
              {
                num: "02",
                title: "Score de Confiabilidade",
                text: "De 0 a 100. Junta o tamanho do valor, as premissas do jogo (ataque, defesa, mando, forma), se a odd não é exagerada e se as casas vêm concordando. Não é chance de acerto — é o quanto dá pra confiar.",
              },
              {
                num: "03",
                title: "O porquê de cada pick",
                text: "Toda oportunidade vem com as premissas que sustentam a tese e os pontos de atenção, mastigados. Sem 'entrada garantida', sem mandar quanto apostar.",
              },
              {
                num: "04",
                title: "A leitura do jogo inteira",
                text: "Modelo de gols, escalação provável, desfalques, confrontos diretos e estatísticas da temporada — pra você bater o martelo com o jogo na frente, não no escuro.",
              },
            ].map((f) => (
              <div key={f.num} className="grid grid-cols-[56px_1fr] sm:grid-cols-[88px_1fr] gap-4 sm:gap-8 py-7 border-t border-line last:border-b">
                <span className="font-mono text-3xl sm:text-5xl font-black text-amber leading-none tabular-nums">{f.num}</span>
                <div>
                  <h3 className="text-lg font-bold text-ink mb-1.5">{f.title}</h3>
                  <p className="text-[14px] text-ink-2 leading-relaxed max-w-xl">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* O combinado — manifesto anti-tipster */}
      <section className="bg-forest text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(212,160,23,0.10),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-3">Transparência</p>
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-10 sm:mb-12 max-w-2xl">
            O combinado que a gente assina
          </h2>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 pb-3 border-b border-white/15">
                O que você nunca vai ver aqui
              </h3>
              {[
                "Promessa de lucro garantido",
                "Pick às cegas, sem o porquê junto",
                "Sugestão de quanto apostar",
                "Taxa de acerto de marketing",
                "Depoimento inventado",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white/85">
                  <XCircle className="w-4 h-4 text-white/40 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber pb-3 border-b border-white/15">
                O que você sempre vai ter
              </h3>
              {[
                "A chance estimada e a odd, lado a lado",
                "O porquê de cada oportunidade — premissas e pontos de atenção",
                "Odds pré-jogo das principais casas",
                "A análise toda livre — só o pick de valor é Premium",
                "A decisão sempre na sua mão",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            — Smart Betting · combinado válido desde o primeiro dia
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">Perguntas frequentes</p>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">Bora tirar dúvida</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-rebrand-md border border-line bg-white px-5 py-4 cursor-pointer hover:border-line-2 transition-colors">
              <summary className="flex items-center justify-between gap-3 list-none font-bold text-[14px] text-ink">
                {item.q}
                <ArrowRight className="w-4 h-4 text-ink-3 group-open:rotate-90 transition-transform shrink-0" />
              </summary>
              <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="border-t border-line py-14 sm:py-20 grid md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ink leading-tight mb-3">
              Testa 7 dias grátis.
            </h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg">
              Premium completo, sem cartão. Depois segue free com a análise toda —
              só o pick de valor é que fica pra quem assina.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[240px]">
            <button
              type="button"
              onClick={goAuth}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5" />
              Começar grátis
            </button>
            <button
              type="button"
              onClick={goProduct}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[15px] transition-colors"
            >
              Espiar sem login
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FutebolLP;
