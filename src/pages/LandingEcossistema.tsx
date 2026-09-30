import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";
import { Camera, Crown, CheckCircle2, XCircle, ArrowRight, ArrowDown, Lightbulb, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { faqPageSchema, webSiteSchema, type FaqItem } from "@/lib/structured-data";
import { getPlayerPhotoUrl, getTeamLogoUrl } from "@/utils/team-logos";
import { getFutebolTeamLogoUrl } from "@/utils/futebol-logos";
import { SHOW_BOLAO_ENTRY_POINTS } from "@/config/bolao";
import { SeletorDeIdiomaCompacto } from '@/components/SeletorDeIdioma';

/**
 * Landing geral do ecossistema (rota /). Papel: porta de entrada que ROTEIA —
 * tráfego pago cai direto nas LPs de produto; aqui chega orgânico/busca de
 * marca. Formato "prateleira": cada produto tem uma seção inteira com mockup
 * grande emoldurado, alternando lados. Paleta "Direção A" do rebrand.
 *
 * A copy vem do catálogo `planos` no idioma ativo (#540), e não mais de texto
 * fixo aqui: é a primeira tela de quem chega de Peru, Argentina, México ou
 * Chile. Os nomes próprios — times, jogadores, Betinho, NBA — ficam em código,
 * porque não se traduzem.
 */

// Moldura de janela compartilhada pelos mockups (mesma das LPs de produto).
const WindowFrame = ({
  url,
  tag,
  children,
}: {
  url: string;
  tag?: string;
  children: React.ReactNode;
}) => {
  const { t } = useTranslation("planos");
  return (
    <div className="rounded-rebrand-xl overflow-hidden shadow-2xl border border-line-2 bg-canvas">
      <div className="flex items-center justify-between gap-3 bg-ink px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        </div>
        <span className="font-mono text-[10px] text-white/50 truncate">{url}</span>
        <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-amber bg-amber/15 border border-amber/40 rounded-full px-2 py-0.5 whitespace-nowrap">
          {tag ?? t("landing.mock.exemplo")}
        </span>
      </div>
      <div className="p-3 sm:p-4 space-y-3">{children}</div>
    </div>
  );
};

// Mockup NBA — insight clicável que filtra o gráfico (mini-demo da LP /nba).
const MockNBA = () => {
  const { t } = useTranslation("planos");
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
              <span className="text-forest font-semibold text-[11px]">· {t("landing.mock.nba.ativo")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-ink-2 mt-0.5">
              <img src={getTeamLogoUrl("Denver Nuggets")} alt="Denver Nuggets" className="w-3.5 h-3.5 object-contain" loading="lazy" />
              <span>Denver Nuggets · C</span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="text-right">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-3">{t("landing.mock.nba.pontos")}</div>
              <div className="text-base font-bold text-ink tabular-nums">{avgPts}</div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-3">{t("landing.mock.nba.assistencias")}</div>
              <div className="text-base font-bold text-ink tabular-nums">10.2</div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-3">{t("landing.mock.nba.rebotes")}</div>
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
          <span className="text-[9px] font-bold text-amber-2 uppercase tracking-widest">{t("landing.mock.nba.insight")}</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-status-danger/10 text-status-danger">{t("landing.mock.nba.fora")}</span>
        </div>
        <p className="text-[13px] text-ink leading-snug">
          {/* `Trans`, e não concatenação: os três destaques caem no meio da
              frase, e em outro idioma caem em outro lugar. */}
          <Trans
            t={t}
            i18nKey="landing.mock.nba.insightTexto"
            values={{ desfalque: "Murray", jogador: "Jokic", alta: "+15%" }}
            components={[
              <span className="font-bold text-status-danger" key="desfalque" />,
              <span className="font-bold text-forest" key="pontos" />,
              <span className="font-bold text-forest" key="alta" />,
            ]}
          />
          {!filtered && <span className="text-ink-3">{" "}{t("landing.mock.nba.insightDica")}</span>}
        </p>
      </button>

      <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 pt-3 pb-2.5 border-b border-line">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">{t("landing.mock.nba.grafico")}</span>
            {filtered ? (
              <button
                type="button"
                onClick={() => setFiltered(false)}
                className="inline-flex items-center gap-1 h-5 px-1.5 rounded-rebrand-sm bg-forest text-white text-[9px] font-semibold hover:bg-forest-2 transition-colors"
              >
                {t("landing.mock.nba.filtro", { desfalque: "Murray" })}
                <X className="w-2.5 h-2.5 opacity-80" />
              </button>
            ) : (
              <span className="text-[10px] text-ink-3">· Nikola Jokic</span>
            )}
          </div>
          <span className="text-[11px] text-ink-2">
            {t("landing.mock.nba.taxaAcerto")}{" "}
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
              <span className="w-2 h-2 rounded-full bg-status-success" /> {t("landing.mock.nba.acima", { total: over })}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-danger" /> {t("landing.mock.nba.abaixo", { total: values.length - over })}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-px bg-ink" /> {t("landing.mock.nba.linha")}
            </span>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
};

// Mockup Betinho — print no Telegram + narrativa + KPIs.
const MockBetinho = () => {
  const { t } = useTranslation("planos");
  return (
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
            {/* Os números ficam FORA do catálogo e entram por interpolação: o
                que se traduz é a frase, não o valor. */}
            <Trans
              t={t}
              i18nKey="landing.mock.betinho.resposta"
              values={{ roi: "+11,8%", apostas: 33 }}
              components={[<span className="text-amber tabular-nums" key="roi" />]}
            />
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-rebrand-lg border border-forest/30 bg-forest/[0.05] p-3">
          <div className="text-[9px] uppercase tracking-[0.14em] font-extrabold text-forest mb-1">{t("landing.mock.betinho.oportunidade")}</div>
          <div className="text-[12px] font-extrabold text-ink leading-tight mb-1">{t("landing.mock.betinho.oportunidadeTitulo")}</div>
          <div className="text-[11px] text-ink-2 leading-snug">
            <Trans
              t={t}
              i18nKey="landing.mock.betinho.oportunidadeTexto"
              values={{ roi: "+38%", apostas: 12 }}
              components={[<span className="font-bold text-forest tabular-nums" key="roi" />]}
            />
          </div>
        </div>
        <div className="rounded-rebrand-lg border border-status-danger/30 bg-status-danger/[0.05] p-3">
          <div className="text-[9px] uppercase tracking-[0.14em] font-extrabold text-status-danger mb-1">{t("landing.mock.betinho.alerta")}</div>
          <div className="text-[12px] font-extrabold text-ink leading-tight mb-1">{t("landing.mock.betinho.alertaTitulo")}</div>
          <div className="text-[11px] text-ink-2 leading-snug">
            <Trans
              t={t}
              i18nKey="landing.mock.betinho.alertaTexto"
              values={{ roi: "−45%" }}
              components={[<span className="font-bold text-status-danger tabular-nums" key="roi" />]}
            />
          </div>
        </div>
      </div>
    </WindowFrame>
  );
};

// Mockup Bolão — ranking do grupo.
const MockBolao = () => {
  const { t } = useTranslation("planos");
  /* `eu` é uma marca no dado, e não uma comparação com o nome: o nome vem
     traduzido, e comparar texto de tela com string fixa quebraria em espanhol
     sem quebrar em português. */
  const ranking = [
    { pos: 1, nome: "Carlão", pts: 47, lider: true, eu: false },
    { pos: 2, nome: "Dudu", pts: 44, lider: false, eu: false },
    { pos: 3, nome: t("landing.mock.bolao.voce"), pts: 41, lider: false, eu: true },
    { pos: 4, nome: "Renata", pts: 39, lider: false, eu: false },
    { pos: 5, nome: "Tonhão", pts: 35, lider: false, eu: false },
  ];
  return (
    <WindowFrame url="smartbetting.app/bolao">
      <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-line">
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">{t("landing.mock.bolao.titulo")}</span>
          <span className="text-[10px] text-ink-3">{t("landing.mock.bolao.info", { participantes: 14, jogos: 104 })}</span>
        </div>
        <div className="p-3 space-y-2">
          {ranking.map((r) => (
            <div
              key={r.pos}
              className={`flex items-center gap-3 rounded-rebrand-md px-3 py-2 ${
                r.lider ? "bg-amber/15 border border-amber/40" : r.eu ? "bg-forest/[0.06] border border-forest/30" : "bg-canvas-2 border border-line"
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
};

// Escudo do time no mock do Futebol — logo real do bucket, cai pras iniciais no 404.
const FutebolCrest = ({ teamId, sigla, className = "" }: { teamId: number; sigla: string; className?: string }) => {
  const [err, setErr] = useState(false);
  const logo = getFutebolTeamLogoUrl(teamId);
  if (logo && !err) {
    return (
      <img
        src={logo}
        alt={sigla}
        onError={() => setErr(true)}
        className={`w-6 h-6 rounded-full bg-white border border-line object-contain ${className}`}
        loading="lazy"
      />
    );
  }
  return (
    <span className={`w-6 h-6 rounded-full bg-white border border-line grid place-items-center text-[8px] font-bold text-ink-2 ${className}`}>
      {sigla}
    </span>
  );
};

/* A faixa é um IDENTIFICADOR, e não o rótulo de tela: a cor é escolhida por ele
   e o rótulo vem do catálogo. Comparar a cor com a palavra "Alta" pintaria tudo
   de cinza no dia em que a palavra fosse traduzida. */
type Faixa = "alta" | "media";

// Mockup Futebol — quadro de oportunidades de valor (mini-demo da LP /futebol).
const MockFutebol = () => {
  const { t } = useTranslation("planos");
  const jogos = [
    {
      homeId: 127, awayId: 121, hs: "FLA", as: "PAL",
      casa: "Flamengo", visitante: "Palmeiras",
      pick: t("landing.mock.futebol.picks.maisGols"),
      faixa: "alta" as Faixa, score: 71,
    },
    {
      homeId: 130, awayId: 119, hs: "GRE", as: "INT",
      casa: "Grêmio", visitante: "Internacional",
      pick: t("landing.mock.futebol.picks.ouEmpate", { time: "Grêmio" }),
      faixa: "alta" as Faixa, score: 63,
    },
    {
      homeId: 126, awayId: 131, hs: "SAO", as: "COR",
      casa: "São Paulo", visitante: "Corinthians",
      pick: t("landing.mock.futebol.picks.ambosMarcam"),
      faixa: "media" as Faixa, score: 49,
    },
  ];
  const faixaCls = (f: Faixa) =>
    f === "alta"
      ? "bg-forest text-white"
      : "bg-amber/15 text-amber-2 border border-amber/40";
  return (
    <WindowFrame url="smartbetting.app/futebol">
      <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5 border-b border-line">
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">{t("landing.mock.futebol.titulo")}</span>
          <span className="text-[10px] text-ink-3">{t("landing.mock.futebol.info", { comValor: 3 })}</span>
        </div>
        <div className="p-3 space-y-2">
          {jogos.map((j, idx) => (
            <div
              key={j.casa}
              className={`flex items-center gap-3 rounded-rebrand-md px-3 py-2 ${
                idx === 0 ? "bg-forest/[0.06] border border-forest/30" : "bg-canvas-2 border border-line"
              }`}
            >
              <div className="flex items-center shrink-0">
                <FutebolCrest teamId={j.homeId} sigla={j.hs} className="z-10" />
                <FutebolCrest teamId={j.awayId} sigla={j.as} className="-ml-1.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-ink leading-tight truncate">{j.casa} × {j.visitante}</div>
                <div className="text-[11px] text-ink-2 truncate">{j.pick}</div>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${faixaCls(j.faixa)}`}>
                {t(`landing.mock.futebol.faixas.${j.faixa}`)}
              </span>
              <span className="font-mono text-[12px] font-bold text-ink tabular-nums w-7 text-right">{j.score}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-rebrand-lg border border-forest/30 bg-forest/[0.05] p-3">
        <div className="text-[9px] uppercase tracking-[0.14em] font-extrabold text-forest mb-1">
          {t("landing.mock.futebol.porque", { casa: "Flamengo", visitante: "Palmeiras" })}
        </div>
        <p className="text-[11px] text-ink-2 leading-snug">
          <Trans
            t={t}
            i18nKey="landing.mock.futebol.porqueTexto"
            values={{ chance: "58%", odd: "1.95", embutida: "51%" }}
            components={[
              <span className="font-bold text-forest tabular-nums" key="chance" />,
              <span className="font-bold text-ink tabular-nums" key="odd" />,
              <span className="tabular-nums" key="embutida" />,
              <span className="font-bold text-forest" key="valor" />,
            ]}
          />
        </p>
      </div>
    </WindowFrame>
  );
};

/* A prateleira: só a ESTRUTURA vive aqui — a ordem, o número, a rota e o
   mockup. Toda a copy sai do catálogo pela chave do produto
   (`landing.produtos.<id>.*`), porque este array é montado fora do componente
   e não tem `t`. */
const TODOS_PRODUCTS = [
  { id: "futebol", num: "01", route: "/futebol/comecar", Mock: MockFutebol, available: true },
  { id: "betinho", num: "02", route: "/betinho", Mock: MockBetinho, available: true },
  { id: "nba", num: "03", route: "/nba", Mock: MockNBA, available: true },
  { id: "bolao", num: "04", route: "/bolao", Mock: MockBolao, available: true },
];

// A Copa acabou — o bolão sai da vitrine (mantém a rota de pé pra quem tem link).
const PRODUCTS = TODOS_PRODUCTS.filter(
  (p) => p.id !== 'bolao' || SHOW_BOLAO_ENTRY_POINTS,
);

const FATOS = ['um', 'dois', 'tres'] as const;

const LandingEcossistema = () => {
  const { t } = useTranslation(["planos", "comum"]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollToProduct = (id: string) => {
    document.getElementById(`produto-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* O FAQ alimenta a tela E o structured data da página. Ele segue o idioma
     ativo porque é a MESMA copy que o visitante lê — prefixo de caminho por
     idioma e marcação de idioma alternativo são outro trabalho (#532). */
  const FAQ: FaqItem[] = (["tipsters", "gratis", "tudoJunto", "porOndeComecar"] as const).map(
    (chave) => ({
      q: t(`landing.faq.${chave}.pergunta`),
      a: t(`landing.faq.${chave}.resposta`),
    }),
  );

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo route="/" jsonLd={[webSiteSchema(), faqPageSchema(FAQ)]} />

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
              onClick={() => navigate(user ? "/inicio" : "/auth")}
              className="hidden sm:inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              {user ? t("landing.nav.acessar") : t("comum:acoes.entrar")}
            </button>
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              {t("landing.nav.comecarGratis")}
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
            {t("landing.hero.etiqueta")}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
            {/* `Trans`, e não duas chaves coladas: o destaque fecha a frase em
                português e pode cair em outro lugar em espanhol. */}
            <Trans
              t={t}
              i18nKey="landing.hero.titulo"
              components={[<span className="text-amber" key="destaque" />]}
            />
          </h1>
          <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
            {t("landing.hero.chamada")}
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
                {t(`landing.produtos.${p.id}.nome`)}
                <ArrowDown className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>
          <p className="text-[12px] text-white/55 mt-5">
            {t("landing.hero.rodape")}
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
                  <span className="text-amber-2">{p.num}</span> · {t(`landing.produtos.${p.id}.etiqueta`)}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
                  {t(`landing.produtos.${p.id}.titulo`)}
                </h2>
                <p className="text-[15px] text-ink-2 leading-relaxed mb-5 max-w-lg">
                  {t(`landing.produtos.${p.id}.texto`)}
                </p>
                <ul className="space-y-2 mb-7">
                  {FATOS.map((n) => (
                    <li key={n} className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-2 flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-2 shrink-0" />
                      {t(`landing.produtos.${p.id}.fatos.${n}`)}
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
                  {t(`landing.produtos.${p.id}.acao`)}
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
          <span>{t("landing.faixa.um")}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t("landing.faixa.dois")}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t("landing.faixa.tres")}</span>
        </div>
      </section>

      {/* O combinado — manifesto guarda-chuva da marca */}
      <section className="bg-forest text-white relative overflow-hidden mt-14 sm:mt-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(212,160,23,0.10),transparent_50%)] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-3">
            {t("landing.combinado.etiqueta")}
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-10 sm:mb-12 max-w-2xl">
            {t("landing.combinado.titulo")}
          </h2>

          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 pb-3 border-b border-white/15">
                {t("landing.combinado.nunca.titulo")}
              </h3>
              {(["um", "dois", "tres", "quatro"] as const).map((n) => (
                <div key={n} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white/85">
                  <XCircle className="w-4 h-4 text-white/40 shrink-0" />
                  {t(`landing.combinado.nunca.${n}`)}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber pb-3 border-b border-white/15">
                {t("landing.combinado.sempre.titulo")}
              </h3>
              {(["um", "dois", "tres", "quatro"] as const).map((n) => (
                <div key={n} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {t(`landing.combinado.sempre.${n}`)}
                </div>
              ))}
            </div>
          </div>

          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            {t("landing.combinado.rodape")}
          </p>
        </div>
      </section>

      {/* FAQ de marca */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
            {t("landing.faq.etiqueta")}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">{t("landing.faq.titulo")}</h2>
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

      {/* Final — fechamento roteador */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="border-t border-line py-14 sm:py-20">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-ink leading-tight mb-3">
            {t("landing.final.titulo")}
          </h2>
          <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg mb-8">
            {t("landing.final.texto")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            {PRODUCTS.filter((p) => p.available).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(p.route)}
                className="inline-flex items-center justify-between gap-2 h-12 px-5 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[14px] transition-colors"
              >
                {t(`landing.produtos.${p.id}.nome`)}
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
