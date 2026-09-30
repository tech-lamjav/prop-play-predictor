import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { fmtOdd, fmtDinheiro } from '@/utils/formato';
import { Seo } from "@/components/Seo";
import { faqPageSchema, type FaqItem } from "@/lib/structured-data";
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
import { SeletorDeIdiomaCompacto } from '@/components/SeletorDeIdioma';

type MockBetStatus = "pending" | "won" | "lost" | "cashout";

// ⚠️ Esta é uma banca FICTÍCIA montada FORA do componente, e por isso ela não
// guarda frase: guarda IDENTIFICADOR (#532). O esporte é um dos dois valores
// abaixo, a descrição é a chave de um texto do catálogo, e o dia é nulo quando a
// aposta é de hoje — quem transforma tudo isso em palavra é a pintura, que tem o
// tradutor. Frase escrita aqui ficaria em português por cima da tela espanhola.
//
// O que NÃO é chave: nome de time, liga e nome de arquivo. Esses são os mesmos em
// qualquer idioma.
type MockEsporte = "basquete" | "futebol";

interface MockBet {
  id: string;
  /** Dia do registro (DD/MM), ou `null` quando é de hoje. */
  bet_date: string | null;
  /** Chave em `betinho:demo.apostas.*`. */
  descricaoChave: string;
  match_description?: string;
  esporte: MockEsporte;
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
    descricaoChave: "lebronPontos",
    match_description: "Lakers vs Warriors",
    esporte: "basquete",
    league: "NBA",
    stake_amount: 150,
    odds: 1.85,
    potential_return: 277.5,
    status: "won",
  },
  {
    id: "2",
    bet_date: "01/02",
    descricaoChave: "corinthiansML",
    match_description: "Corinthians vs Santos",
    esporte: "futebol",
    league: "Brasileirão",
    stake_amount: 100,
    odds: 2.1,
    potential_return: 210,
    status: "pending",
  },
  {
    id: "3",
    bet_date: "30/01",
    descricaoChave: "curryTres",
    match_description: "Warriors vs Celtics",
    esporte: "basquete",
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
    descricaoChave: "underGols",
    match_description: "Juventus vs Milan",
    esporte: "futebol",
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
      bet_date: null,
      descricaoChave: "jokicPontosAssistencias",
      match_description: "Nuggets vs Suns",
      esporte: "basquete",
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
      bet_date: null,
      descricaoChave: "flamengoML",
      match_description: "Flamengo vs Palmeiras",
      esporte: "futebol",
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
      bet_date: null,
      descricaoChave: "overPontos",
      match_description: "Celtics vs Knicks",
      esporte: "basquete",
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

const formatMoney = (value: number) => fmtDinheiro(value);

// Cor por status, e a chave do rótulo — a cor é decisão de tela, o rótulo é texto.
const STATUS_CHIP: Record<MockBetStatus, { rotuloChave: string; cls: string }> = {
  won: { rotuloChave: "ganhou", cls: "text-status-success bg-status-success/10" },
  lost: { rotuloChave: "perdeu", cls: "text-status-danger bg-status-danger/10" },
  pending: { rotuloChave: "pendente", cls: "text-amber-2 bg-amber/10" },
  cashout: { rotuloChave: "cashout", cls: "text-status-info bg-status-info/10" },
};

// ── Visualizações do dashboard analítico (espelho do /betting-dashboard novo) ──

// Heatmap "ROI por liga × mercado" — banca fictícia, coerente com os insights.
type HeatCell = { roi: number; n: number } | null;
// Colunas por CHAVE: "Player Props" e "Over/Under" são jargão em português e têm
// par próprio em espanhol ("Props de jugador", "Más/Menos"); "ML" é sigla e não muda.
const HEATMAP_COLS = ["props", "ml", "overUnder"];
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
// Também só identificador: o `type` escolhe a cor e, pela tabela de baixo, o grupo
// do catálogo onde o rótulo, o título e o corpo moram.
type MockInsightType = "opportunity" | "warning" | "discipline";

const MOCK_INSIGHTS: Array<{
  type: MockInsightType;
  targetCell: string | null;
}> = [
  { type: "opportunity", targetCell: "nba-0" },
  { type: "warning", targetCell: "seriea-2" },
  { type: "discipline", targetCell: null },
];

/** O grupo do catálogo de cada insight, num lugar só. */
const INSIGHT_CHAVE: Record<MockInsightType, string> = {
  opportunity: "oportunidade",
  warning: "alerta",
  discipline: "disciplina",
};

const INSIGHT_TONE: Record<string, { wrapper: string; label: string }> = {
  opportunity: { wrapper: "border-forest/30 bg-forest/[0.05]", label: "text-forest" },
  warning: { wrapper: "border-status-danger/30 bg-status-danger/[0.05]", label: "text-status-danger" },
  discipline: { wrapper: "border-amber/40 bg-amber/[0.07]", label: "text-amber-2" },
};

const Betinho = () => {
  // `betinho` é a área desta tela; `comum` traz os botões de cabeçalho que toda
  // tela pública repete (entrar, começar grátis) e que não são desta tela.
  const { t } = useTranslation(["betinho", "comum"]);
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

  /** A descrição da aposta recém-registrada, já traduzida. Vazia quando não há. */
  const apostaRecemRegistrada = bets.find((b) => b.id === lastAddedId);
  const descricaoRecemRegistrada = apostaRecemRegistrada
    ? t(`demo.apostas.${apostaRecemRegistrada.descricaoChave}`)
    : "";

  // O FAQ alimenta a tela E o JSON-LD da página. Os dois saem do MESMO catálogo de
  // propósito: o Google exige que o dado estruturado bata com o que está na tela, e
  // uma segunda cópia em português divergiria no dia em que a frase mudasse.
  const FAQ: FaqItem[] = ["gratis", "whatsapp", "print", "dinheiro", "trabalho"].map((chave) => ({
    q: t(`faq.itens.${chave}.pergunta`),
    a: t(`faq.itens.${chave}.resposta`),
  }));

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo
        route={isBolaoVariant ? "/betinho/bolao" : "/betinho"}
        jsonLd={faqPageSchema(FAQ)}
      />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center">
            {/* logo branca vira escura no canvas claro (mesmo filtro do Footer) */}
            <img src="/logo.png" alt="Smart Betting" className="h-9 invert hue-rotate-180" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 ml-3 shrink-0">
            {/* Sem usuário não há menu da conta, e é lá que o idioma mora.
                Esta tela tem cabeçalho próprio, então precisa do seu. */}
            <SeletorDeIdiomaCompacto tom="claro" />
            <button
              type="button"
              onClick={navigateToAuth}
              className="hidden sm:inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              {t("comum:acoes.entrar")}
            </button>
            <button
              type="button"
              onClick={navigateToAuth}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              {t("comum:acoes.comecarGratis")}
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
                {t("hero.bolao.etiqueta")}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
                {t("hero.bolao.tituloLinhaUm")}<br />
                <span className="text-amber">{t("hero.bolao.tituloLinhaDois")}</span>
              </h1>
              <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
                {t("hero.bolao.chamada")}
              </p>
              <button
                type="button"
                onClick={() => {
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
              >
                {t("acoes.verComoFunciona")}
                <ArrowDown className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-5">
                {t("hero.padrao.etiqueta")}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
                {t("hero.padrao.tituloLinhaUm")}<br />
                <span className="text-amber">{t("hero.padrao.tituloLinhaDois")}</span>
              </h1>
              <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
                {/* O destaque está no MEIO da frase, então quem decide onde ele cai é
                    o catálogo (<0>…</0>) e não o arranjo do JSX. */}
                <Trans
                  t={t}
                  i18nKey="hero.padrao.chamada"
                  components={[<span className="text-white font-semibold" key="destaque" />]}
                />
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <button
                  type="button"
                  onClick={navigateToAuth}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
                >
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  {t("acoes.telegram")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("lp-demo-betinho")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-white text-forest hover:bg-white/90 font-bold text-[15px] shadow-md transition-colors"
                >
                  {t("acoes.verPainel")}
                </button>
              </div>
              <p className="text-[12px] text-white/55 mt-4">
                {t("hero.padrao.rodape")}
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
              {t("demo.selo")}
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
                      {t("demo.chat.remetente")}
                    </p>
                    {reading ? (
                      <div className="inline-flex items-center gap-2 bg-canvas-2 border border-line rounded-rebrand-md px-3 py-2 text-[13px] text-ink-2">
                        <span className="w-2 h-2 rounded-full bg-amber animate-pulse" />
                        {t("demo.chat.lendo")}
                      </div>
                    ) : simDone ? (
                      <p className="text-[13px] text-ink-2">
                        <Trans
                          t={t}
                          i18nKey="demo.chat.fim"
                          components={[<span className="font-bold text-ink" key="destaque" />]}
                        />
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
                    {t("demo.chat.queroBot")}
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
                    {t("demo.chat.mandarPrint")}
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
                    {t("demo.narrativa.etiqueta")}
                  </div>
                </div>
                <p className="text-[17px] sm:text-[19px] font-extrabold leading-snug" style={{ letterSpacing: "-0.01em" }}>
                  {/* Qual das duas frases entra é decidido por lastAddedId, o
                      identificador da última aposta registrada — nunca comparando o
                      texto da frase. */}
                  {lastAddedId ? (
                    <Trans
                      t={t}
                      i18nKey="demo.narrativa.recebi"
                      values={{ aposta: descricaoRecemRegistrada }}
                      components={[<span className="text-amber" key="aposta" />]}
                    />
                  ) : (
                    <Trans
                      t={t}
                      i18nKey="demo.narrativa.resumo"
                      values={{ roi: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%` }}
                      components={[<span className="text-amber" key="roi" />]}
                    />
                  )}
                </p>
              </div>
            </div>

            {/* KPIs — formato do /bets rebrandado */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                {
                  chave: "roi",
                  label: t("demo.kpis.roi"),
                  value: `${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`,
                  cls: stats.roi >= 0 ? "text-status-success" : "text-status-danger",
                },
                {
                  chave: "lucro",
                  label: t("demo.kpis.lucro"),
                  value: formatMoney(stats.profit),
                  cls: stats.profit >= 0 ? "text-status-success" : "text-status-danger",
                },
                {
                  chave: "totalApostado",
                  label: t("demo.kpis.totalApostado"),
                  value: formatMoney(stats.totalStaked),
                  cls: "text-ink",
                },
                {
                  chave: "taxa",
                  label: t("demo.kpis.taxa"),
                  value: `${stats.hitRate.toFixed(1)}%`,
                  cls: "text-ink",
                },
                {
                  chave: "apostas",
                  label: t("demo.kpis.apostas"),
                  value: `${stats.total}`,
                  // Plural pelo i18next, com `_zero` explícito: em português o CLDR
                  // trata ZERO como singular, e "0 pendente" estaria errado.
                  sub: t("demo.kpis.pendentes", { count: stats.pendingCount }),
                  cls: "text-ink",
                },
              ].map((kpi) => (
                <div key={kpi.chave} className="rounded-rebrand-lg bg-white border border-line p-3.5">
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
                  {t("demo.plano.etiqueta")}
                </div>
                <h3 className="text-[16px] font-extrabold tracking-tight text-ink mt-0.5">
                  {t("demo.plano.titulo")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {MOCK_INSIGHTS.map((insight) => {
                  const tone = INSIGHT_TONE[insight.type];
                  const grupo = `demo.plano.${INSIGHT_CHAVE[insight.type]}`;
                  return (
                    <div key={insight.type} className={`rounded-rebrand-md border p-4 ${tone.wrapper}`}>
                      <div className={`text-[9px] uppercase tracking-[0.14em] font-extrabold mb-2 ${tone.label}`}>
                        {t(`${grupo}.rotulo`)}
                      </div>
                      <div className="text-[13px] font-extrabold text-ink leading-tight mb-1.5">
                        {t(`${grupo}.titulo`)}
                      </div>
                      <div className="text-[11px] text-ink-2 leading-snug">{t(`${grupo}.texto`)}</div>
                      {insight.targetCell && (
                        <button
                          type="button"
                          onClick={() => setHighlightCell(insight.targetCell)}
                          className={`mt-3 inline-flex items-center gap-1 text-[11px] font-bold transition-colors ${tone.label}`}
                        >
                          {t("demo.plano.verFatia")}
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
                  {t("demo.mapa.titulo")}
                </span>
                <span className="text-[10px] text-ink-3">
                  {t("demo.mapa.legenda")}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[420px]">
                  <div className="grid grid-cols-[88px_repeat(3,1fr)] gap-1.5 mb-1.5">
                    <div />
                    {HEATMAP_COLS.map((col) => (
                      <div key={col} className="text-[9px] uppercase tracking-[0.1em] font-bold text-ink-3 text-center">
                        {t(`demo.mapa.colunas.${col}`)}
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
                              <div className="text-[10px] text-ink-3 py-1.5">{t("demo.mapa.semDados")}</div>
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
                  {t("demo.tabela.titulo")}
                </span>
                <span className="text-[10px] text-ink-3 tabular-nums">
                  {t("demo.tabela.contagem", { total: stats.total })}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">{t("demo.tabela.colunas.data")}</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium">{t("demo.tabela.colunas.descricao")}</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium hidden sm:table-cell">{t("demo.tabela.colunas.esporte")}</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">{t("demo.tabela.colunas.valor")}</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right hidden sm:table-cell">{t("demo.tabela.colunas.odd")}</th>
                      <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">{t("demo.tabela.colunas.retorno")}</th>
                      <th className="pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3 font-medium text-right">{t("demo.tabela.colunas.situacao")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bets.slice(0, 5).map((bet) => (
                      <tr
                        key={bet.id}
                        className={`border-t border-line transition-colors ${bet.id === lastAddedId ? "bg-amber/[0.08]" : ""}`}
                      >
                        <td className="py-2 pr-3 text-ink-2 tabular-nums whitespace-nowrap">
                          {bet.bet_date ?? t("demo.tabela.hoje")}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-ink">{t(`demo.apostas.${bet.descricaoChave}`)}</div>
                          {bet.match_description && (
                            <div className="text-[10px] text-ink-3">{bet.match_description}</div>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-ink-3 hidden sm:table-cell whitespace-nowrap">
                          {t(`demo.esportes.${bet.esporte}`)}
                          {bet.league ? ` · ${bet.league}` : ""}
                        </td>
                        <td className="py-2 pr-3 text-right text-ink tabular-nums whitespace-nowrap">
                          {formatMoney(bet.stake_amount)}
                        </td>
                        <td className="py-2 pr-3 text-right text-ink-2 tabular-nums hidden sm:table-cell">
                          {fmtOdd(bet.odds)}
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
                            {t(`demo.status.${STATUS_CHIP[bet.status].rotuloChave}`)}
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
            {t("acoes.telegram")}
          </button>
          <p className="text-sm text-ink-3 mt-3">
            {t("demo.rodape")}
          </p>
        </div>
      </section>

      {/* Faixa de fatos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 sm:mt-20">
        <div className="border-y border-line py-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span>{t("fatos.um")}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t("fatos.dois")}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t("fatos.tres")}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t("fatos.quatro")}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t("fatos.cinco")}</span>
        </div>
      </section>

      {/* Como funciona — só na variante bolão (alvo do soft scroll do hero) */}
      {isBolaoVariant && (
        <section id="how-it-works" className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              {t("comoFunciona.etiqueta")}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">
              {t("comoFunciona.titulo")}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { num: "1", chave: "um" },
              { num: "2", chave: "dois" },
              { num: "3", chave: "tres" },
            ].map((step) => (
              <div key={step.num} className="rounded-rebrand-lg border border-line bg-white p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-forest/[0.10] border border-forest/30 flex items-center justify-center text-sm font-black text-forest">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-[16px] font-bold text-ink mb-1">
                  {t(`comoFunciona.passos.${step.chave}.titulo`)}
                </h3>
                <p className="text-[13px] text-ink-2 leading-relaxed">
                  {t(`comoFunciona.passos.${step.chave}.texto`)}
                </p>
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
              {t("video.etiqueta")}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-black text-ink mb-3">
              {t("video.titulo")}
            </h2>
            <p className="text-base sm:text-lg text-ink-2 max-w-2xl mx-auto">
              {t("video.chamada")}
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
              {t("video.semSuporte")}
            </video>
          </div>
        </div>
      </section>

      {/* O que tem dentro — lista editorial numerada */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="grid md:grid-cols-[minmax(220px,300px)_1fr] gap-10 md:gap-16">
          <div className="md:sticky md:top-24 self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
              {t("dentro.etiqueta")}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
              {t("dentro.titulo")}
            </h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              {t("dentro.chamada")}
            </p>
          </div>

          <div>
            {[
              { num: "01", chave: "um" },
              { num: "02", chave: "dois" },
              { num: "03", chave: "tres" },
              { num: "04", chave: "quatro" },
            ].map((f) => (
              <div key={f.num} className="grid grid-cols-[56px_1fr] sm:grid-cols-[88px_1fr] gap-4 sm:gap-8 py-7 border-t border-line last:border-b">
                <span className="font-mono text-3xl sm:text-5xl font-black text-amber leading-none tabular-nums">{f.num}</span>
                <div>
                  <h3 className="text-lg font-bold text-ink mb-1.5">{t(`dentro.itens.${f.chave}.titulo`)}</h3>
                  <p className="text-[14px] text-ink-2 leading-relaxed max-w-xl">
                    {t(`dentro.itens.${f.chave}.texto`)}
                  </p>
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
            {t("combinado.etiqueta")}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-10 sm:mb-12 max-w-2xl">
            {t("combinado.titulo")}
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 pb-3 border-b border-white/15">
                {t("combinado.nuncaTitulo")}
              </h3>
              {["um", "dois", "tres", "quatro"].map((chave) => (
                <div key={chave} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white/85">
                  <XCircle className="w-4 h-4 text-white/40 shrink-0" />
                  {t(`combinado.nunca.${chave}`)}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber pb-3 border-b border-white/15">
                {t("combinado.sempreTitulo")}
              </h3>
              {["um", "dois", "tres", "quatro"].map((chave) => (
                <div key={chave} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {t(`combinado.sempre.${chave}`)}
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            {t("combinado.assinatura")}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
            {t("faq.etiqueta")}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">{t("faq.titulo")}</h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((item) => (
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
              {t("fechamento.titulo")}
            </h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg">
              {t("fechamento.texto")}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[260px]">
            <button
              type="button"
              onClick={navigateToAuth}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <MessageCircle className="h-5 w-5" />
              {t("acoes.telegram")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/como-usar")}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[15px] transition-colors"
            >
              {t("acoes.guia")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Betinho;
