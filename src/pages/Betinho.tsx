import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  MessageCircle,
  CheckCircle2,
  XCircle,
  Camera,
  Send,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/integrations/supabase/client";

type MockBetStatus = "pending" | "won" | "lost" | "cashout";

interface MockBet {
  id: string;
  bet_date: string;
  bet_description: string;
  match_description?: string;
  sport: string;
  league?: string | null;
  stake_amount: number;
  odds: number;
  potential_return: number;
  cashout_amount?: number;
  status: MockBetStatus;
}

// Apostas já registradas no mock (estado inicial do dashboard).
const INITIAL_BETS: MockBet[] = [
  {
    id: "1",
    bet_date: "02/02",
    bet_description: "LeBron 25+ pontos",
    match_description: "Lakers vs Warriors",
    sport: "Basquete",
    league: "NBA",
    stake_amount: 150,
    odds: 1.85,
    potential_return: 277.5,
    status: "won",
  },
  {
    id: "2",
    bet_date: "01/02",
    bet_description: "Corinthians ML",
    match_description: "Corinthians vs Santos",
    sport: "Futebol",
    league: "Brasileirão",
    stake_amount: 100,
    odds: 2.1,
    potential_return: 210,
    status: "pending",
  },
  {
    id: "3",
    bet_date: "30/01",
    bet_description: "Curry 5+ bolas de 3",
    match_description: "Warriors vs Celtics",
    sport: "Basquete",
    league: "NBA",
    stake_amount: 150,
    odds: 1.7,
    potential_return: 255,
    cashout_amount: 255,
    status: "cashout",
  },
  {
    id: "4",
    bet_date: "28/01",
    bet_description: "Under 2.5 gols",
    match_description: "Juventus vs Milan",
    sport: "Futebol",
    league: "Serie A",
    stake_amount: 80,
    odds: 2.3,
    potential_return: 184,
    status: "lost",
  },
];

// Fila de "prints" da demo — 3, espelhando o limite diário do plano grátis.
const QUEUED_PRINTS: Array<{ file: string; bet: MockBet }> = [
  {
    file: "bilhete_bet365.png",
    bet: {
      id: "sim-1",
      bet_date: "hoje",
      bet_description: "Jokic 25+ pts & 8+ asts",
      match_description: "Nuggets vs Suns",
      sport: "Basquete",
      league: "NBA",
      stake_amount: 120,
      odds: 2.45,
      potential_return: 294,
      status: "pending",
    },
  },
  {
    file: "bilhete_betano.png",
    bet: {
      id: "sim-2",
      bet_date: "hoje",
      bet_description: "Flamengo ML",
      match_description: "Flamengo vs Palmeiras",
      sport: "Futebol",
      league: "Brasileirão",
      stake_amount: 200,
      odds: 1.95,
      potential_return: 390,
      status: "pending",
    },
  },
  {
    file: "bilhete_superbet.png",
    bet: {
      id: "sim-3",
      bet_date: "hoje",
      bet_description: "Over 215.5 pontos",
      match_description: "Celtics vs Knicks",
      sport: "Basquete",
      league: "NBA",
      stake_amount: 80,
      odds: 1.9,
      potential_return: 152,
      status: "pending",
    },
  },
];

// Agregado do restante do período (29 apostas resolvidas que não aparecem na
// tabela de "últimos registros"). Fecha a conta com o heatmap: 29 + 3 resolvidas
// visíveis = 32 = soma dos n das células (12+5+8+3+4). ROI do período ≈ +11,8%.
const PERIOD_BASE = {
  settledStaked: 3460,
  returns: 3760.5,
  settledCount: 29,
  greens: 15,
};

const formatMoney = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const STATUS_CHIP: Record<MockBetStatus, { label: string; cls: string }> = {
  won: { label: "GANHOU", cls: "text-status-success bg-status-success/10" },
  lost: { label: "PERDEU", cls: "text-status-danger bg-status-danger/10" },
  pending: { label: "PENDENTE", cls: "text-amber-2 bg-amber/10" },
  cashout: { label: "CASHOUT", cls: "text-status-info bg-status-info/10" },
};

// ── Visualizações do dashboard analítico (espelho do /betting-dashboard novo) ──

// Heatmap "ROI por liga × mercado" — banca fictícia, coerente com os insights.
type HeatCell = { roi: number; n: number } | null;
const HEATMAP_COLS = ["Player Props", "ML", "Over/Under"];
const HEATMAP_ROWS: Array<{ league: string; cells: HeatCell[]; key: string }> = [
  { league: "NBA", key: "nba", cells: [{ roi: 38, n: 12 }, null, { roi: 6, n: 5 }] },
  { league: "Brasileirão", key: "br", cells: [null, { roi: 12, n: 8 }, { roi: -8, n: 3 }] },
  { league: "Serie A", key: "seriea", cells: [null, null, { roi: -45, n: 4 }] },
];

const heatCellStyle = (cell: HeatCell): { bg: string; text: string } => {
  if (!cell) return { bg: "transparent", text: "" };
  const strong = Math.abs(cell.roi) >= 30;
  if (cell.roi >= 0) {
    return strong
      ? { bg: "rgba(47,125,80,0.88)", text: "text-white" }
      : { bg: "rgba(47,125,80,0.18)", text: "text-ink" };
  }
  return strong
    ? { bg: "rgba(184,52,28,0.85)", text: "text-white" }
    : { bg: "rgba(184,52,28,0.16)", text: "text-ink" };
};

// "Plano de ação" — espelho dos InsightCards (oportunidade / alerta / disciplina).
const MOCK_INSIGHTS: Array<{
  type: "opportunity" | "warning" | "discipline";
  label: string;
  title: string;
  body: string;
  targetCell: string | null;
}> = [
  {
    type: "opportunity",
    label: "Oportunidade",
    title: "Props da NBA é sua mina",
    body: "+38% de ROI em 12 apostas. É a sua melhor fatia — volume aqui tem pagado.",
    targetCell: "nba-0",
  },
  {
    type: "warning",
    label: "Alerta",
    title: "Serie A tá custando caro",
    body: "−45% de ROI no Over/Under da Serie A: 4 apostas, 3 reds. Vale repensar essa fatia.",
    targetCell: "seriea-2",
  },
  {
    type: "discipline",
    label: "Disciplina",
    title: "Stake dobrada depois de red",
    body: "Sua média é R$ 120, mas depois de perder você dobra a mão. Constância paga mais que recuperação.",
    targetCell: null,
  },
];

const INSIGHT_TONE: Record<string, { wrapper: string; label: string }> = {
  opportunity: { wrapper: "border-forest/30 bg-forest/[0.05]", label: "text-forest" },
  warning: { wrapper: "border-status-danger/30 bg-status-danger/[0.05]", label: "text-status-danger" },
  discipline: { wrapper: "border-amber/40 bg-amber/[0.07]", label: "text-amber-2" },
};

const Betinho = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const supabase = createClient();

  // Variante /betinho/bolao — usuário veio de um bolão da Copa. Renderiza
  // hero + "como funciona" customizados (resto da página igual).
  const isBolaoVariant = location.pathname.startsWith("/betinho/bolao");

  useEffect(() => {
    if (authLoading || !user?.id) return;
    // Variante /betinho/bolao é educacional ("convencer + entender") —
    // não redireciona pra onboarding mesmo se whatsapp nao sincronizado.
    if (isBolaoVariant) return;
    const checkWhatsappSynced = async () => {
      const { data } = await supabase
        .from("users")
        .select("whatsapp_synced")
        .eq("id", user.id)
        .single();
      if (data?.whatsapp_synced === false) {
        navigate("/onboarding?product=betinho", { state: { from: { pathname: "/betinho" } } });
      }
    };
    checkWhatsappSynced();
  }, [authLoading, user?.id, supabase, navigate, isBolaoVariant]);

  // Helper to navigate to auth preserving ref parameter
  const navigateToAuth = () => {
    const refParam = searchParams.get("ref");
    if (refParam) {
      navigate(`/auth?ref=${refParam}`);
    } else {
      navigate("/auth");
    }
  };

  // Vídeo real do bot no Telegram (Supabase Storage de produção).
  const screenshotVideoUrl =
    "https://lavclmlvvfzkblrstojd.supabase.co/storage/v1/object/public/landing%20-page/WhatsApp%20Video%202026-01-22%20at%2016.05.33.mp4";

  // ── Demo "manda um print pro Betinho" ─────────────────────────────────
  const [bets, setBets] = useState<MockBet[]>(INITIAL_BETS);
  const [simCount, setSimCount] = useState(0);
  const [reading, setReading] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  // Clique no insight destaca a fatia correspondente no heatmap (como no real).
  const [highlightCell, setHighlightCell] = useState<string | null>(null);

  const simDone = simCount >= QUEUED_PRINTS.length;
  const nextPrint = simDone ? null : QUEUED_PRINTS[simCount];

  const handleSendPrint = () => {
    if (reading || simDone || !nextPrint) return;
    setReading(true);
    window.setTimeout(() => {
      setBets((prev) => [nextPrint.bet, ...prev]);
      setLastAddedId(nextPrint.bet.id);
      setSimCount((c) => c + 1);
      setReading(false);
    }, 700);
  };

  // KPIs do período = agregado base (29 apostas) + registros visíveis na tabela.
  // A demo do print atualiza tudo junto, e a conta fecha com o heatmap.
  const stats = useMemo(() => {
    const settled = bets.filter((b) => b.status !== "pending");
    const pendingCount = bets.length - settled.length;
    const visibleStaked = bets.reduce((a, b) => a + b.stake_amount, 0);
    const visibleSettledStaked = settled.reduce((a, b) => a + b.stake_amount, 0);
    const visibleReturns = settled.reduce((a, b) => {
      if (b.status === "won") return a + b.potential_return;
      if (b.status === "cashout") return a + (b.cashout_amount ?? 0);
      return a;
    }, 0);
    const visibleGreens = settled.filter((b) => b.status === "won" || b.status === "cashout").length;

    const settledStaked = PERIOD_BASE.settledStaked + visibleSettledStaked;
    const returns = PERIOD_BASE.returns + visibleReturns;
    const settledCount = PERIOD_BASE.settledCount + settled.length;
    const greens = PERIOD_BASE.greens + visibleGreens;

    const totalStaked = PERIOD_BASE.settledStaked + visibleStaked;
    const profit = returns - settledStaked;
    const roi = settledStaked > 0 ? (profit / settledStaked) * 100 : 0;
    const hitRate = settledCount > 0 ? (greens / settledCount) * 100 : 0;
    return {
      totalStaked,
      profit,
      roi,
      hitRate,
      total: PERIOD_BASE.settledCount + bets.length,
      pendingCount,
    };
  }, [bets]);

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Helmet>
        <title>
          {isBolaoVariant
            ? "Apostas reais? Documente no Telegram | Betinho"
            : "Betinho — Gestão de Apostas e Controle de Banca no Telegram | Smart Betting"}
        </title>
        <meta
          name="description"
          content={
            isBolaoVariant
              ? "Você palpitou no bolão. E suas apostas reais — você anota? Documenta tudo no Telegram em 10 segundos."
              : "Manda o print do bilhete no Telegram e o Betinho registra: banca, ROI e taxa de acerto sem planilha. 3 apostas por dia grátis."
          }
        />
      </Helmet>

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
              onClick={navigateToAuth}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={navigateToAuth}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              Começar Grátis
            </button>
          </div>
        </div>
      </nav>

      {/* Hero — copy à esquerda, produto vaza a dobra logo abaixo */}
      <section className="relative bg-forest text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-forest via-forest-2 to-forest pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(212,160,23,0.16),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-40 sm:pb-56">
          {isBolaoVariant ? (
            <>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-5">
                Vindo do bolão da Copa
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
                Você acabou de palpitar no bolão.<br />
                <span className="text-amber">E as apostas de verdade, você anota?</span>
              </h1>
              <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
                Documenta tudo no Telegram em 10 segundos — print do bilhete, a IA
                registra, e a sua banca aparece organizada no dashboard. Sem planilha,
                sem app novo.
              </p>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
              >
                Ver como funciona
                <ArrowDown className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-5">
                Betinho · Gestão de banca no Telegram
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
                Você tá no lucro ou no prejuízo?<br />
                <span className="text-amber">O Betinho sabe de cabeça.</span>
              </h1>
              <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
                Manda o print do bilhete no Telegram. A IA lê, registra e te devolve
                banca, ROI e taxa de acerto — sem planilha, sem digitação. Testa aí
                embaixo: <span className="text-white font-semibold">manda um print pro Betinho.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <button
                  type="button"
                  onClick={navigateToAuth}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  Começar grátis no Telegram
                </button>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("lp-demo-betinho")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-white text-forest hover:bg-white/90 font-bold text-[15px] shadow-md transition-colors"
                >
                  Ver o dashboard
                </button>
              </div>
              <p className="text-[12px] text-white/55 mt-4">
                3 apostas por dia grátis · Sem cartão · A banca é sua, a gente só organiza
              </p>
            </>
          )}
        </div>
      </section>

      {/* Produto vazando a dobra — dashboard no tema light do rebrand (PR #142) */}
      <section id="lp-demo-betinho" className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 -mt-28 sm:-mt-40">
        <div className="rounded-rebrand-xl overflow-hidden shadow-2xl border border-line-2 bg-canvas">
          {/* Barra de janela */}
          <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            </div>
            <span className="font-mono text-[10px] sm:text-[11px] text-white/50 truncate">
              smartbetting.app/betting-dashboard
            </span>
            <span className="font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber bg-amber/15 border border-amber/40 rounded-full px-2 py-0.5 whitespace-nowrap">
              dados de exemplo
            </span>
          </div>

          <div className="p-3 sm:p-5 space-y-3">
            {/* Chat do Telegram — gatilho da demo */}
            <div className="rounded-rebrand-lg bg-white border border-line p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-forest text-white grid place-items-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-ink-3 mb-1">
                      Telegram · @betinho
                    </p>
                    {reading ? (
                      <div className="inline-flex items-center gap-2 bg-canvas-2 border border-line rounded-rebrand-md px-3 py-2 text-[13px] text-ink-2">
                        <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
                        lendo o bilhete…
                      </div>
                    ) : simDone ? (
                      <p className="text-[13px] text-ink-2">
                        Esses eram os 3 prints de exemplo — no bot é igual:{" "}
                        <span className="font-bold text-ink">3 registros por dia grátis.</span>
                      </p>
                    ) : (
                      <div className="inline-flex items-center gap-2 bg-canvas-2 border border-line rounded-rebrand-md px-3 py-2 text-[13px] text-ink">
                        <Camera className="w-4 h-4 text-ink-3 shrink-0" />
                        <span className="font-mono text-[12px]">{nextPrint?.file}</span>
                        <span className="text-[10px] text-ink-3">21:34</span>
                      </div>
                    )}
                  </div>
                </div>
                {simDone ? (
                  <button
                    type="button"
                    onClick={navigateToAuth}
                    className="shrink-0 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[13px] shadow-sm transition-colors"
                  >
                    Quero o bot de verdade
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendPrint}
                    disabled={reading}
                    className="shrink-0 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-rebrand-md bg-forest text-white hover:bg-forest-2 disabled:opacity-60 font-bold text-[13px] shadow-sm transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Mandar print pro Betinho
                  </button>
                )}
              </div>
            </div>

            {/* Betinho comenta — espelho do BetinhoNarrative do dashboard novo */}
            <div className="relative overflow-hidden rounded-rebrand-lg bg-forest text-white">
              <div
                className="absolute inset-0 opacity-[0.06] pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                  backgroundSize: "8px 8px",
                }}
              />
              <div className="relative p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-amber text-forest grid place-items-center text-[16px] font-black shrink-0">
                    B
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber font-extrabold leading-tight pt-1">
                    Betinho · resumo do período
                  </div>
                </div>
                <p className="text-[17px] sm:text-[19px] font-extrabold leading-snug" style={{ letterSpacing: "-0.01em" }}>
                  {lastAddedId ? (
                    <>
                      Recebi! <span className="text-amber">{bets.find((b) => b.id === lastAddedId)?.bet_description}</span>{" "}
                      registrada como pendente. Resolveu? Me conta que eu atualizo a banca.
                    </>
                  ) : (
                    <>
                      Seu mês tá positivo: <span className="text-amber">{stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}% de ROI</span>{" "}
                      — as props da NBA puxaram o resultado.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* KPIs — formato do /bets rebrandado */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                {
                  label: "ROI",
                  value: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`,
                  cls: stats.roi >= 0 ? "text-status-success" : "text-status-danger",
                },
                {
                  label: "Lucro líquido",
                  value: formatMoney(stats.profit),
                  cls: stats.profit >= 0 ? "text-status-success" : "text-status-danger",
                },
                { label: "Total apostado", value: formatMoney(stats.totalStaked), cls: "text-ink" },
                { label: "Taxa de acerto", value: `${stats.hitRate.toFixed(1)}%`, cls: "text-ink" },
                {
                  label: "Apostas",
                  value: `${stats.total}`,
                  sub: `${stats.pendingCount} pendente${stats.pendingCount === 1 ? "" : "s"}`,
                  cls: "text-ink",
                },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-rebrand-lg bg-white border border-line p-3.5">
                  <div className="text-[10px] font-semibold tracking-[0.16em] text-ink-2 uppercase mb-1">
                    {kpi.label}
                  </div>
                  <div className={`text-lg sm:text-xl font-bold tabular-nums ${kpi.cls}`}>{kpi.value}</div>
                  {kpi.sub && <div className="text-[10px] text-ink-3 mt-0.5">{kpi.sub}</div>}
                </div>
              ))}
            </div>

            {/* Plano de ação — espelho dos InsightCards do dashboard novo */}
            <div className="rounded-rebrand-lg bg-white border border-line p-4">
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-amber-2 font-extrabold">
                  Plano de ação
                </div>
                <h3 className="text-[16px] font-extrabold tracking-tight text-ink mt-0.5">
                  3 movimentos que aumentariam seu ROI
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {MOCK_INSIGHTS.map((insight) => {
                  const tone = INSIGHT_TONE[insight.type];
                  return (
                    <div key={insight.title} className={`rounded-rebrand-md border p-4 ${tone.wrapper}`}>
                      <div className={`text-[9px] uppercase tracking-[0.14em] font-extrabold mb-2 ${tone.label}`}>
                        {insight.label}
                      </div>
                      <div className="text-[13px] font-extrabold text-ink leading-tight mb-1.5">
                        {insight.title}
                      </div>
                      <div className="text-[11px] text-ink-2 leading-snug">{insight.body}</div>
                      {insight.targetCell && (
                        <button
                          type="button"
                          onClick={() => setHighlightCell(insight.targetCell)}
                          className={`mt-3 inline-flex items-center gap-1 text-[11px] font-bold transition-colors ${tone.label}`}
                        >
                          Ver fatia no mapa
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Heatmap ROI por liga × mercado — espelho do BigHeatmap */}
            <div className="rounded-rebrand-lg bg-white border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">
                  ROI por liga × mercado
                </span>
                <span className="text-[10px] text-ink-3">
                  Verde = lucro · vermelho = prejuízo · cinza = sem volume
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[420px]">
                  <div className="grid grid-cols-[88px_repeat(3,1fr)] gap-1.5 mb-1.5">
                    <div />
                    {HEATMAP_COLS.map((col) => (
                      <div key={col} className="text-[9px] uppercase tracking-[0.1em] font-bold text-ink-3 text-center">
                        {col}
                      </div>
                    ))}
                  </div>
                  {HEATMAP_ROWS.map((row) => (
                    <div key={row.key} className="grid grid-cols-[88px_repeat(3,1fr)] gap-1.5 mb-1.5">
                      <div className="text-[11px] font-bold text-ink-2 flex items-center">{row.league}</div>
                      {row.cells.map((cell, ci) => {
                        const cellKey = `${row.key}-${ci}`;
                        const { bg, text } = heatCellStyle(cell);
                        const highlighted = highlightCell === cellKey;
                        return (
                          <div
                            key={cellKey}
                            className={`rounded-rebrand-sm px-2 py-2.5 text-center transition-all ${
                              cell ? text : "bg-canvas-2"
                            } ${highlighted ? "ring-2 ring-amber ring-offset-1" : ""}`}
                            style={cell ? { backgroundColor: bg } : undefined}
                          >
                            {cell ? (
                              <>
                                <div className="text-[14px] font-bold tabular-nums leading-none">
                                  {cell.roi > 0 ? "+" : ""}{cell.roi}%
                                </div>
                                <div className="text-[9px] opacity-80 mt-1 tabular-nums">n={cell.n}</div>
                              </>
                            ) : (
                              <div className="text-[10px] text-ink-3 py-1.5">sem dados</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabela de apostas */}
            <div className="rounded-rebrand-lg bg-white border border-line p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">
                  Últimos registros
                </span>
                <span className="text-[10px] text-ink-3 tabular-nums">
                  {stats.total} apostas no período · mostrando as últimas 5
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">Data</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">Descrição</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium hidden sm:table-cell">Esporte</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">Valor</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right hidden sm:table-cell">Odds</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">Retorno</th>
                      <th className="pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.slice(0, 5).map((bet) => (
                      <tr
                        key={bet.id}
                        className={`border-t border-line transition-colors ${bet.id === lastAddedId ? "bg-amber/[0.08]" : ""}`}
                      >
                        <td className="py-2 pr-3 text-ink-2 tabular-nums whitespace-nowrap">{bet.bet_date}</td>
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-ink">{bet.bet_description}</div>
                          {bet.match_description && (
                            <div className="text-[10px] text-ink-3">{bet.match_description}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-ink-3 hidden sm:table-cell whitespace-nowrap">
                          {bet.sport}
                          {bet.league ? ` · ${bet.league}` : ""}
                        </td>
                        <td className="py-2 pr-3 text-right text-ink tabular-nums whitespace-nowrap">
                          {formatMoney(bet.stake_amount)}
                        </td>
                        <td className="py-2 pr-3 text-right text-ink-2 tabular-nums hidden sm:table-cell">
                          {bet.odds.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-bold tabular-nums whitespace-nowrap ${
                            bet.status === "won"
                              ? "text-status-success"
                              : bet.status === "lost"
                                ? "text-status-danger"
                                : bet.status === "cashout"
                                  ? "text-status-info"
                                  : "text-ink-2"
                          }`}
                        >
                          {bet.status === "cashout" && bet.cashout_amount
                            ? formatMoney(bet.cashout_amount)
                            : formatMoney(bet.potential_return)}
                        </td>
                        <td className="py-2 text-right">
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${STATUS_CHIP[bet.status].cls}`}>
                            {STATUS_CHIP[bet.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* CTA abaixo do produto */}
        <div className="text-center mt-8 sm:mt-10">
          <button
            type="button"
            onClick={navigateToAuth}
            className="inline-flex items-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
            Começar grátis no Telegram
          </button>
          <p className="text-sm text-ink-3 mt-3">
            3 apostas por dia grátis · sem cartão
          </p>
        </div>
      </section>

      {/* Faixa de fatos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 sm:mt-20">
        <div className="border-y border-line py-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span>Print ou texto</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>1 mensagem = 1 aposta</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Banca, ROI e taxa</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Cashout e status</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>Tags e filtros</span>
        </div>
      </section>

      {/* Como funciona — só na variante bolão (alvo do soft scroll do hero) */}
      {isBolaoVariant && (
        <section id="how-it-works" className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              Como funciona
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">
              3 passos. Sem complicação.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                num: "1",
                title: "Conecta seu Telegram",
                text: "Sincroniza o bot com sua conta em segundos.",
              },
              {
                num: "2",
                title: "Manda como você fala",
                text: '"Apostei 50 no Brasil a 1.85" ou o print do bilhete. A IA extrai e organiza tudo.',
              },
              {
                num: "3",
                title: "Vê tudo no dashboard",
                text: "Banca, ROI, taxa de acerto. Organizado, automático.",
              },
            ].map((step) => (
              <div key={step.num} className="rounded-rebrand-lg border border-line bg-white p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-forest/[0.10] border border-forest/30 flex items-center justify-center text-sm font-black text-forest">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-[16px] font-bold text-ink mb-1">{step.title}</h3>
                <p className="text-[13px] text-ink-2 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Vídeo real do bot — prova logo depois da demo simulada */}
      <section className="bg-canvas-2 border-y border-line mt-14 sm:mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              Sem truque
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-black text-ink mb-3">
              O Betinho de verdade, em 30 segundos
            </h2>
            <p className="text-base sm:text-lg text-ink-2 max-w-2xl mx-auto">
              A demonstração lá em cima é simulada. Isto aqui é gravação real do bot
              no Telegram — print enviado, aposta confirmada.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <video
              className="max-w-full max-h-[60vh] rounded-rebrand-xl object-contain shadow-2xl border border-line-2 bg-ink"
              controls
              autoPlay
              loop
              muted
              playsInline
            >
              <source src={screenshotVideoUrl} type="video/mp4" />
              Seu navegador não suporta o elemento de vídeo.
            </video>
          </div>
        </div>
      </section>

      {/* O que tem dentro — lista editorial numerada */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="grid md:grid-cols-[minmax(220px,300px)_1fr] gap-10 md:gap-16">
          <div className="md:sticky md:top-24 self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              O que tem dentro
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
              A planilha que se preenche sozinha
            </h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Todo apostador já tentou anotar as apostas. A planilha morre na segunda
              semana — não pela falta de vontade, pelo trabalho. O Betinho tira o
              trabalho da equação.
            </p>
          </div>

          <div>
            {[
              {
                num: "01",
                title: "Registro por print ou texto",
                text: 'Manda o print do bilhete ou escreve "apostei 50 no Corinthians a 2.10". A IA extrai jogo, odd e valor — 1 mensagem, 1 aposta.',
              },
              {
                num: "02",
                title: "Banca, ROI e taxa sem planilha",
                text: "Lucro, retorno, média de odds e evolução da banca calculados sozinhos, aposta a aposta. O número que você evita olhar, sempre à vista.",
              },
              {
                num: "03",
                title: "O Betinho comenta seus números",
                text: "No dashboard, ele resume seu período em bom português: onde você ganha, onde você insiste em perder. Análise, não julgamento.",
              },
              {
                num: "04",
                title: "Cashout, status e filtros",
                text: 'Resolveu a aposta? Responde "ganhou", "perdeu" ou "cashout" no bot e o painel atualiza. Depois filtre por esporte, status, data ou tag.',
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

      {/* O combinado — faixa manifesto em verde-mata */}
      <section className="bg-forest text-white relative overflow-hidden">
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
                "Dica de aposta no meio do seu chat",
                "Acesso à sua conta na casa de aposta",
                "Spam — o bot só fala de registro",
                "Número maquiado pra você se sentir melhor",
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
                "Registro em segundos, por print ou texto",
                "Seu lucro e seu prejuízo, sem filtro",
                "Seus dados exportáveis quando quiser",
                "A banca é sua — a gente só organiza",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            — Betinho · combinado válido desde o primeiro print
          </p>
        </div>
      </section>

      {/* FAQ */}
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
              q: "É grátis?",
              a: "É. No plano grátis você registra até 3 apostas por dia pelo bot e usa o gestor completo — banca, ROI, filtros e exportação. O Premium libera registros ilimitados e as análises do Betinho IA no dashboard.",
            },
            {
              q: "Funciona no WhatsApp?",
              a: "Não — o Betinho mora no Telegram. Você conecta sua conta em segundos e todo o registro acontece por lá.",
            },
            {
              q: "Funciona com print de qualquer casa?",
              a: "Serve print de bilhete de qualquer casa — a IA lê o texto da imagem e extrai jogo, odd e valor. Saiu algo errado? Você corrige no dashboard em segundos. E se quiser, manda o caso pro suporte: cada bilhete que a IA erra ajuda a gente a melhorar a leitura.",
            },
            {
              q: "Vocês têm acesso ao meu dinheiro?",
              a: "Zero. O Betinho não conecta na sua conta da casa de aposta — ele registra o que você manda. É um caderno inteligente, não uma carteira.",
            },
            {
              q: "Dá trabalho manter?",
              a: 'Uma mensagem por aposta. Resolveu? Responde "ganhou", "perdeu" ou "cashout" e o painel atualiza. Planilha nunca mais.',
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

      {/* Final CTA — fechamento editorial */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="border-t border-line py-14 sm:py-20 grid md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ink leading-tight mb-3">
              Manda o primeiro print.
            </h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg">
              Conta grátis em um minuto, bot no Telegram, 3 registros por dia sem
              pagar nada. Na próxima aposta, você já sabe onde sua banca está.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[260px]">
            <button
              type="button"
              onClick={navigateToAuth}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              Começar grátis no Telegram
            </button>
            <button
              type="button"
              onClick={() => navigate("/como-usar")}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[15px] transition-colors"
            >
              Guia de uso
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Betinho;
