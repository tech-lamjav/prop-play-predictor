import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Camera, Crown, CheckCircle2, XCircle, ArrowRight, ArrowDown, Lightbulb, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { getPlayerPhotoUrl, getTeamLogoUrl } from "@/utils/team-logos";

/**
 * Landing geral do ecossistema (rota /). Papel: porta de entrada que ROTEIA —
 * tráfego pago cai direto nas LPs de produto; aqui chega orgânico/busca de
 * marca. Formato "prateleira": cada produto tem uma seção inteira com mockup
 * grande emoldurado, alternando lados. Paleta "Direção A" do rebrand.
 */

// Moldura de janela compartilhada pelos mockups (mesma das LPs de produto).
const WindowFrame = ({
  url,
  tag = "dados de exemplo",
  children,
}: {
  url: string;
  tag?: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-rebrand-xl overflow-hidden shadow-2xl border border-line-2 bg-canvas">
    <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2.5">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
      </div>
      <span className="font-mono text-[10px] text-white/50 truncate">{url}</span>
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber bg-amber/15 border border-amber/40 rounded-full px-2 py-0.5 whitespace-nowrap">
        {tag}
      </span>
    </div>
    <div className="p-3 sm:p-4 space-y-3">{children}</div>
  </div>
);

// Mockup NBA — insight clicável que filtra o gráfico (mini-demo da LP /nba).
const MockNBA = () => {
  const [filtered, setFiltered] = useState(false);
  const base = [24, 31, 28, 33, 22, 30, 27, 35, 29, 25, 32, 28];
  const semMurray = [31, 34, 36, 30, 35, 38, 27, 33];
  const values = filtered ? semMurray : base;
  const line = 27.5;
  const maxVal = filtered ? 42 : 38;
  const chartH = 132;
  const linePct = (line / maxVal) * 100;
  const over = values.filter((v) => v > line).length;
  const hitRate = ((over / values.length) * 100).toFixed(1);
  const avgPts = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  return (
    <WindowFrame url="smartbetting.app/nba-dashboard/nikola-jokic">
      {/* Cabeçalho do jogador — dá rosto e contexto ao insight */}
      <div className="rounded-rebrand-lg bg-white border border-line p-3.5">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-rebrand-md overflow-hidden shrink-0 bg-gradient-to-br from-canvas-2 to-line-2 grid place-items-center">
            <span className="text-[13px] font-semibold text-ink-2">NJ</span>
            <img
              src={getPlayerPhotoUrl("Nikola Jokic", "Denver Nuggets")}
              alt="Nikola Jokic"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-bold text-ink leading-tight">Nikola Jokic</h3>
              <span className="text-forest font-semibold text-[11px]">· Ativo</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-2 mt-0.5">
              <img src={getTeamLogoUrl("Denver Nuggets")} alt="Denver Nuggets" className="w-3.5 h-3.5 object-contain" loading="lazy" />
              <span>Denver Nuggets · C</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-3">Pontos</div>
              <div className="text-base font-bold text-ink tabular-nums">{avgPts}</div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-3">Assist.</div>
              <div className="text-base font-bold text-ink tabular-nums">10.2</div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-3">Rebotes</div>
              <div className="text-base font-bold text-ink tabular-nums">12.8</div>
            </div>
          </div>
        </div>
      </div>

      {/* Insight de oportunidade — clicável, filtra o gráfico */}
      <button
        type="button"
        onClick={() => setFiltered(true)}
        className={`w-full text-left rounded-rebrand-lg border p-3.5 transition-all ${
          filtered
            ? "bg-forest/[0.06] border-forest/40"
            : "bg-white border-amber/40 hover:border-amber hover:bg-amber/[0.05] cursor-pointer"
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <Lightbulb className="w-3.5 h-3.5 text-amber-2 shrink-0" />
          <span className="text-[9px] font-bold text-amber-2 uppercase tracking-widest">Insight</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-status-danger/10 text-status-danger">OUT</span>
        </div>
        <p className="text-[13px] text-ink leading-snug">
          Com <span className="font-bold text-status-danger">Murray</span> fora, os{" "}
          <span className="font-bold text-forest">pontos</span> de Jokic sobem{" "}
          <span className="font-bold text-forest">+15%</span>
          {!filtered && <span className="text-ink-3"> — clique pra filtrar o gráfico</span>}
        </p>
      </button>

      <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3 pb-2.5 border-b border-line">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Gráfico de desempenho</span>
            {filtered ? (
              <button
                type="button"
                onClick={() => setFiltered(false)}
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded-rebrand-sm bg-forest text-white text-[9px] font-semibold hover:bg-forest-2 transition-colors"
              >
                Sem Murray em quadra
                <X className="w-2.5 h-2.5 opacity-80" />
              </button>
            ) : (
              <span className="text-[10px] text-ink-3">· Nikola Jokic</span>
            )}
          </div>
          <span className="text-[11px] text-ink-2">
            Taxa de acerto{" "}
            <span className="font-semibold text-forest tabular-nums">{hitRate}%</span>{" "}
            <span className="text-ink-3 tabular-nums">({over}/{values.length})</span>
          </span>
        </div>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-end gap-1.5 relative" style={{ height: `${chartH}px` }}>
            <div className="absolute inset-x-0 border-t-2 border-ink z-10" style={{ bottom: `${linePct}%` }} />
            <div
              className="absolute -right-1 z-10 bg-ink text-white px-1.5 py-0.5 rounded-sm text-[10px] font-bold tabular-nums"
              style={{ bottom: `${linePct}%`, transform: "translateY(50%)" }}
            >
              {line}
            </div>
            {values.map((v, i) => (
              <div key={i} className="flex-1 flex items-end justify-center min-w-0">
                <div
                  className={`w-full max-w-[26px] rounded-t-[3px] relative transition-all duration-300 ${v > line ? "bg-status-success" : "bg-status-danger"}`}
                  style={{ height: `${Math.max((v / maxVal) * chartH, 12)}px` }}
                >
                  <span className="absolute bottom-0.5 inset-x-0 text-center text-[9px] font-bold text-white tabular-nums">
                    {v}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-success" /> Over ({over})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-danger" /> Under ({values.length - over})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-px bg-ink" /> Linha
            </span>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
};

// Mockup Betinho — print no Telegram + narrativa + KPIs.
const MockBetinho = () => (
  <WindowFrame url="smartbetting.app/betting-dashboard">
    <div className="rounded-rebrand-lg bg-white border border-line p-3.5">
      <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3 mb-2">Telegram · @betinho</p>
      <div className="inline-flex items-center gap-2 bg-canvas-2 border border-line rounded-rebrand-md px-3 py-2">
        <Camera className="w-4 h-4 text-ink-3" />
        <span className="font-mono text-[11px] text-ink">bilhete_bet365.png</span>
        <span className="text-[10px] text-ink-3">21:34</span>
      </div>
    </div>
    <div className="relative overflow-hidden rounded-rebrand-lg bg-forest text-white p-4">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "8px 8px" }}
      />
      <div className="relative flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-amber text-forest grid place-items-center text-[15px] font-black shrink-0">
          B
        </span>
        <p className="text-[15px] font-extrabold leading-snug pt-1">
          Recebi! Registrada. Seu mês: <span className="text-amber tabular-nums">+11,8% de ROI</span> em 33 apostas.
        </p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-rebrand-lg border border-forest/30 bg-forest/[0.05] p-3">
        <div className="text-[9px] uppercase tracking-[0.14em] font-extrabold text-forest mb-1">Oportunidade</div>
        <div className="text-[12px] font-extrabold text-ink leading-tight mb-1">Props da NBA é sua mina</div>
        <div className="text-[11px] text-ink-2 leading-snug">
          <span className="font-bold text-forest tabular-nums">+38%</span> de ROI em 12 apostas
        </div>
      </div>
      <div className="rounded-rebrand-lg border border-status-danger/30 bg-status-danger/[0.05] p-3">
        <div className="text-[9px] uppercase tracking-[0.14em] font-extrabold text-status-danger mb-1">Alerta</div>
        <div className="text-[12px] font-extrabold text-ink leading-tight mb-1">Serie A te custa caro</div>
        <div className="text-[11px] text-ink-2 leading-snug">
          <span className="font-bold text-status-danger tabular-nums">−45%</span> no Over/Under
        </div>
      </div>
    </div>
  </WindowFrame>
);

// Mockup Bolão — ranking do grupo.
const MockBolao = () => (
  <WindowFrame url="smartbetting.app/bolao">
    <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-line">
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Bolão da Firma</span>
        <span className="text-[10px] text-ink-3">14 participantes · 104 jogos</span>
      </div>
      <div className="p-3 space-y-2">
        {[
          { pos: 1, nome: "Carlão", pts: 47, lider: true },
          { pos: 2, nome: "Dudu", pts: 44, lider: false },
          { pos: 3, nome: "Você", pts: 41, lider: false },
          { pos: 4, nome: "Renata", pts: 39, lider: false },
          { pos: 5, nome: "Tonhão", pts: 35, lider: false },
        ].map((r) => (
          <div
            key={r.pos}
            className={`flex items-center gap-3 rounded-rebrand-md px-3 py-2 ${
              r.lider ? "bg-amber/15 border border-amber/40" : r.nome === "Você" ? "bg-forest/[0.06] border border-forest/30" : "bg-canvas-2 border border-line"
            }`}
          >
            <span className="font-mono text-[11px] font-bold text-ink-3 w-4 tabular-nums">{r.pos}</span>
            <span className="text-[13px] font-bold text-ink flex-1">{r.nome}</span>
            {r.lider && <Crown className="w-3.5 h-3.5 text-amber-2" />}
            <span className="font-mono text-[12px] font-bold text-ink tabular-nums">{r.pts} pts</span>
          </div>
        ))}
      </div>
    </div>
  </WindowFrame>
);

// Mockup Futebol — em construção (skeleton).
const MockFutebol = () => (
  <WindowFrame url="smartbetting.app/futebol" tag="em construção">
    <div className="rounded-rebrand-lg bg-white border border-line p-4 relative overflow-hidden">
      <div className="space-y-3" aria-hidden="true">
        <div className="h-4 w-2/5 rounded bg-canvas-2" />
        <div className="h-20 rounded-rebrand-md bg-canvas-2" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-12 rounded-rebrand-md bg-canvas-2" />
          <div className="h-12 rounded-rebrand-md bg-canvas-2" />
          <div className="h-12 rounded-rebrand-md bg-canvas-2" />
        </div>
        <div className="h-4 w-3/5 rounded bg-canvas-2" />
        <div className="h-4 w-1/2 rounded bg-canvas-2" />
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-2 bg-white border border-amber/40 rounded-full px-4 py-2 shadow-sm">
          Em construção
        </span>
      </div>
    </div>
  </WindowFrame>
);

const PRODUCTS = [
  {
    id: "nba",
    num: "01",
    kicker: "Análise NBA · Prop Bets",
    title: "A casa demora pra ajustar a linha. Você chega antes.",
    body: "Desfalque confirmado muda os números de quem fica em quadra — e a linha demora pra acompanhar. A análise cruza injury report com histórico e te mostra onde a janela abriu.",
    facts: ["12 mercados de props", "Injury report diário", "Oportunidades por desfalque"],
    cta: "Explorar a análise NBA",
    route: "/nba",
    Mock: MockNBA,
    available: true,
  },
  {
    id: "betinho",
    num: "02",
    kicker: "Betinho · Gestão de banca",
    title: "Você tá no lucro ou no prejuízo? O Betinho sabe de cabeça.",
    body: "Manda o print do bilhete no Telegram. A IA lê, registra e te devolve banca, ROI e taxa de acerto — sem planilha, sem digitação. A verdade da sua banca, sempre à vista.",
    facts: ["Print ou texto no Telegram", "Banca, ROI e taxa automáticos", "3 registros por dia grátis"],
    cta: "Conhecer o Betinho",
    route: "/betinho",
    Mock: MockBetinho,
    available: true,
  },
  {
    id: "bolao",
    num: "03",
    kicker: "Bolão Copa 2026",
    title: "O bolão da galera. Sem planilha do Excel.",
    body: "Cria em 30 segundos, manda o link no grupo, e pronto. A gente cuida do ranking, dos placares e dos palpites de campeão — você cuida da zoeira.",
    facts: ["104 jogos da Copa", "Grátis até 20 pessoas", "Ranking automático"],
    cta: "Criar meu bolão",
    route: "/bolao",
    Mock: MockBolao,
    available: true,
  },
  {
    id: "futebol",
    num: "04",
    kicker: "Futebol · Em desenvolvimento",
    title: "O próximo da prateleira.",
    body: "Análise de dados pra apostas em futebol — Brasileirão, Copa do Brasil e ligas europeias. Tá em construção com a mesma regra dos outros: o dado na frente, a decisão na sua mão.",
    facts: ["Brasileirão e Copa do Brasil", "Ligas europeias", "Mesma tese: dado na frente"],
    cta: "Entrar na lista de espera",
    route: "/waitlist",
    Mock: MockFutebol,
    available: false,
  },
];

const LandingEcossistema = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollToProduct = (id: string) => {
    document.getElementById(`produto-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo
        path="/"
        title="Smart Betting — Análises, Gestão e Ferramentas para Apostadores"
        description="Análise de prop bets NBA, gestão de banca no Telegram e bolão da Copa 2026. Ferramentas para quem decide com dados — sem promessa de ganho."
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center">
            {/* logo branca vira escura no canvas claro (mesmo filtro do Footer) */}
            <img src="/logo.png" alt="Smart Betting" className="h-9 invert hue-rotate-180" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(user ? "/onboarding" : "/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              {user ? "Acessar" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              Começar Grátis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero — copy à esquerda + chips de navegação da prateleira */}
      <section className="relative bg-forest text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-forest via-forest-2 to-forest pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(212,160,23,0.16),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 sm:pb-24">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-5">
            Smart Betting · O ecossistema
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
            Tudo que o apostador precisa,{" "}
            <span className="text-amber">menos a casa.</span>
          </h1>
          <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
            Análise pra decidir, gestão pra não se enganar, bolão pra zoar os
            amigos — e zero promessa de ganho em qualquer um deles. Escolhe por
            onde começar:
          </p>
          <div className="flex flex-wrap gap-2">
            {PRODUCTS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => scrollToProduct(p.id)}
                className={`inline-flex items-center gap-2 h-11 px-4 rounded-rebrand-md font-bold text-[13px] transition-colors ${
                  p.available
                    ? "bg-white/10 border border-white/25 text-white hover:bg-white/20"
                    : "bg-transparent border border-dashed border-white/25 text-white/70 hover:bg-white/10"
                }`}
              >
                <span className="font-mono text-[10px] text-amber">{p.num}</span>
                {p.kicker.split("·")[0].trim()}
                <ArrowDown className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>
          <p className="text-[12px] text-white/55 mt-5">
            Planos separados · Todas começam grátis · A decisão é sempre sua
          </p>
        </div>
      </section>

      {/* Prateleira — uma seção inteira por produto, mockup grande alternando lados */}
      {PRODUCTS.map((p, i) => {
        const flip = i % 2 === 1;
        return (
          <section key={p.id} id={`produto-${p.id}`} className={`scroll-mt-20 ${i > 0 ? "border-t border-line" : ""}`}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center">
              <div className={`min-w-0 ${flip ? "md:order-2" : ""}`}>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-forest mb-4">
                  <span className="text-amber-2">{p.num}</span> · {p.kicker}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
                  {p.title}
                </h2>
                <p className="text-[15px] text-ink-2 leading-relaxed mb-5 max-w-lg">
                  {p.body}
                </p>
                <ul className="space-y-2 mb-7">
                  {p.facts.map((fact) => (
                    <li key={fact} className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-2 flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-2 shrink-0" />
                      {fact}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => navigate(p.route)}
                  className={`inline-flex items-center justify-center gap-2 h-12 px-7 rounded-rebrand-md font-bold text-[15px] shadow-md transition-colors ${
                    p.available
                      ? "bg-forest text-white hover:bg-forest-2"
                      : "border border-amber/50 bg-amber/[0.06] text-amber-2 hover:bg-amber/[0.12] shadow-none"
                  }`}
                >
                  {p.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className={`min-w-0 ${flip ? "md:order-1" : ""}`}>
                <p.Mock />
              </div>
            </div>
          </section>
        );
      })}

      {/* Faixa de fatos da marca */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-2">
        <div className="border-y border-line py-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span>O dado na frente</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Sem promessa de ganho</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>A decisão é sempre sua</span>
        </div>
      </section>

      {/* O combinado — manifesto guarda-chuva da marca */}
      <section className="bg-forest text-white relative overflow-hidden mt-14 sm:mt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(212,160,23,0.10),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-3">
            Transparência
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-10 sm:mb-12 max-w-2xl">
            O combinado que a gente assina
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 pb-3 border-b border-white/15">
                O que você nunca vai ver aqui
              </h3>
              {[
                "Promessa de ganho garantido",
                "Entrada pra você copiar às cegas",
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
                "O dado na frente da decisão",
                "O porquê de cada análise",
                "Sua banca e sua decisão — sempre suas",
                "Transparência como princípio, não slogan",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            — Smart Betting · combinado válido em todos os produtos
          </p>
        </div>
      </section>

      {/* FAQ de marca */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
            Perguntas frequentes
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">Bora tirar dúvida</h2>
        </div>
        <div className="space-y-3">
          {[
            {
              q: "Vocês são tipsters?",
              a: "Não. Tipster te dá o palpite e pede fé. A gente te dá o dado — a linha, o histórico, o contexto — e devolve a decisão pra você. Nenhum produto da casa promete ganho; quem promete, desconfia.",
            },
            {
              q: "O que é grátis?",
              a: "Todos os produtos têm porta de entrada grátis: na análise NBA, dashboards de jogadores liberados sem login; no Betinho, 3 registros por dia; no Bolão, tudo grátis até 20 pessoas. Os detalhes estão na página de cada um.",
            },
            {
              q: "Preciso assinar tudo junto?",
              a: "Não. Cada produto tem seu plano, separado — você assina só o que usa. O Bolão nem assinatura tem: pagamento único por bolão, e só se o grupo passar de 20 pessoas.",
            },
            {
              q: "Por onde eu começo?",
              a: "Pela sua dor. Aposta em NBA e quer decidir com dado? Análise NBA. Não sabe se tá no lucro? Betinho. Quer reunir a galera na Copa? Bolão. Todas começam grátis — testa e fica na que te servir.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-rebrand-md border border-line bg-white px-5 py-4 cursor-pointer hover:border-line-2 transition-colors"
            >
              <summary className="flex items-center justify-between gap-3 list-none font-bold text-[14px] text-ink">
                {item.q}
                <ArrowRight className="w-4 h-4 text-ink-3 group-open:rotate-90 transition-transform shrink-0" />
              </summary>
              <p className="text-[13px] text-ink-2 mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final — fechamento roteador */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="border-t border-line py-14 sm:py-20">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ink leading-tight mb-3">
            Escolhe sua porta de entrada.
          </h2>
          <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg mb-8">
            As três começam grátis. Entra na que resolve a sua dor de hoje —
            as outras continuam aqui.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 max-w-3xl">
            {PRODUCTS.filter((p) => p.available).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(p.route)}
                className="inline-flex items-center justify-between gap-2 h-12 px-5 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[14px] transition-colors"
              >
                {p.kicker.split("·")[0].trim()}
                <ArrowRight className="h-4 w-4 text-amber-2" />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingEcossistema;
