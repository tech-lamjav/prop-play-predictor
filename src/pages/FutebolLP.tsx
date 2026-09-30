import { useState, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { fmtOdd } from '@/utils/formato';
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { faqPageSchema, type FaqItem } from "@/lib/structured-data";
import { useAuth } from "@/hooks/use-auth";
import { useScrollDepthPixel } from "@/hooks/use-scroll-depth-pixel";
import { PlayCircle, ArrowRight, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { getFutebolTeamLogoUrl } from "@/utils/futebol-logos";
import { onboardingFrom, ONBOARDING_SRC_LP_FUTEBOL } from "@/utils/onboarding-return";
import { SeletorDeIdiomaCompacto } from '@/components/SeletorDeIdioma';

// ============================================================
// FutebolLP — landing page pública do módulo de Futebol (Aposta de Valor).
// Mesma fórmula/voz das LPs aprovadas (/nba, /bolao): hero product-led →
// mock fiel emoldurado (board de Oportunidades → card "O que olhar") →
// faixa de fatos → lista editorial → manifesto anti-tipster → FAQ → CTA.
// Sem prova social inventada. Tema rebrand (theme-bolao).
// ============================================================

/**
 * A faixa como IDENTIFICADOR, não como rótulo.
 *
 * Era `"Alta" | "Média" | "Baixa"` — o próprio texto da tela — e a página
 * decidia cor e corte comparando esse texto. Traduzir a tela quebraria as duas
 * decisões em silêncio (#544). Agora o identificador é minúsculo e sem acento, e
 * o rótulo sai do catálogo.
 */
type Faixa = "alta" | "media" | "baixa";

interface MockOpp {
  id: string;
  home: string;
  away: string;
  homeId: number;
  awayId: number;
  comp: string;
  hora: string;
  /** Chave de catálogo do nome do mercado. */
  market: string;
  /** Chave de catálogo da aposta. */
  pick: string;
  faixa: Faixa;
  score: number;
  chance: number; // %
  odd: number;
  edge: number; // 0..1
  /** Chaves de catálogo, uma por linha do "Por quê". */
  porque: string[];
  /** Chaves de catálogo, uma por ponto de atenção. */
  atencao: string[];
}

// Dados de exemplo (fictícios, internamente coerentes) — espelham o board real.
// Nome de time e horário ficam literais: nome próprio não traduz, e a hora segue
// a costura de formato. Todo o resto é CHAVE, e o texto vive no catálogo (#538).
const OPPS: MockOpp[] = [
  {
    id: "fla-pal", home: "Flamengo", away: "Palmeiras", homeId: 127, awayId: 121, comp: "Brasileirão", hora: "16:00",
    market: "lp.mock.flaPal.mercado", pick: "lp.mock.flaPal.pick", faixa: "alta", score: 71,
    chance: 58, odd: 1.95, edge: 0.043,
    porque: ["lp.mock.flaPal.porque1", "lp.mock.flaPal.porque2", "lp.mock.flaPal.porque3"],
    atencao: ["lp.mock.flaPal.atencao1", "lp.mock.flaPal.atencao2"],
  },
  {
    id: "gre-int", home: "Grêmio", away: "Internacional", homeId: 130, awayId: 119, comp: "Brasileirão", hora: "18:30",
    market: "lp.mock.greInt.mercado", pick: "lp.mock.greInt.pick", faixa: "alta", score: 63,
    chance: 68, odd: 1.58, edge: 0.034,
    porque: ["lp.mock.greInt.porque1", "lp.mock.greInt.porque2", "lp.mock.greInt.porque3"],
    atencao: ["lp.mock.greInt.atencao1", "lp.mock.greInt.atencao2"],
  },
  {
    id: "sao-cor", home: "São Paulo", away: "Corinthians", homeId: 126, awayId: 131, comp: "Brasileirão", hora: "21:00",
    market: "lp.mock.saoCor.mercado", pick: "lp.mock.saoCor.pick", faixa: "media", score: 49,
    chance: 55, odd: 1.85, edge: 0.018,
    porque: ["lp.mock.saoCor.porque1", "lp.mock.saoCor.porque2"],
    atencao: ["lp.mock.saoCor.atencao1", "lp.mock.saoCor.atencao2"],
  },
  {
    id: "bah-flu", home: "Bahia", away: "Fluminense", homeId: 118, awayId: 124, comp: "Brasileirão", hora: "19:00",
    market: "lp.mock.bahFlu.mercado", pick: "lp.mock.bahFlu.pick", faixa: "baixa", score: 19,
    chance: 44, odd: 2.30, edge: 0.011,
    porque: ["lp.mock.bahFlu.porque1"],
    atencao: ["lp.mock.bahFlu.atencao1", "lp.mock.bahFlu.atencao2"],
  },
];

function faixaBadge(faixa: Faixa): string {
  if (faixa === "alta") return "bg-forest text-white";
  if (faixa === "media") return "bg-amber/15 text-amber-2 border border-amber/40";
  return "bg-canvas-2 text-ink-3 border border-line";
}

/** O veredito do valor: chave de catálogo mais a cor. */
function verdict(edge: number): { chave: string; color: string } {
  const e = edge * 100;
  if (e >= 4) return { chave: "lp.mock.veredito.forte", color: "text-forest" };
  if (e >= 2) return { chave: "lp.mock.veredito.medio", color: "text-amber-2" };
  return { chave: "lp.mock.veredito.leve", color: "text-amber-2" };
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
  const { t } = useTranslation('futebol');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(OPPS[0].id);
  const selected = useMemo(() => OPPS.find((o) => o.id === selectedId) ?? OPPS[0], [selectedId]);
  const v = verdict(selected.edge);

  // Meta Pixel: 25/50/75/100% de leitura desta LP (evento `ScrollDepth`).
  useScrollDepthPixel("futebol-comecar");

  // Separado pela FAIXA, como o produto faz. O corte por número que existia
  // aqui era da fórmula antiga e, na escala do Score de contexto, classificaria
  // errado a própria demonstração (spec #301).
  const comValor = OPPS.filter((o) => o.faixa !== "baixa");
  const semValor = OPPS.filter((o) => o.faixa === "baixa");

  // Quem se cadastra por aqui passa pelo onboarding e termina no futebol, não
  // no hub: a landing é de futebol, e o hub era uma tela a mais no caminho.
  const goAuth = () =>
    navigate("/auth", {
      state: { from: onboardingFrom(ONBOARDING_SRC_LP_FUTEBOL, "/futebol") },
    });
  const goProduct = () => navigate("/futebol");

  // O FAQ alimenta a tela E o JSON-LD, então aqui ele já vem traduzido: o dado
  // estruturado tem de falar a mesma língua da página que o declara.
  const FAQ: FaqItem[] = [
    { q: t('lp.faq.valorP'), a: t('lp.faq.valorR') },
    { q: t('lp.faq.dicaP'), a: t('lp.faq.dicaR') },
    { q: t('lp.faq.gratisP'), a: t('lp.faq.gratisR') },
    { q: t('lp.faq.estatisticaP'), a: t('lp.faq.estatisticaR') },
    { q: t('lp.faq.dadosP'), a: t('lp.faq.dadosR') },
    { q: t('lp.faq.acertoP'), a: t('lp.faq.acertoR') },
  ];

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo route="/futebol/comecar" jsonLd={faqPageSchema(FAQ)} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-canvas/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <img src="/logo.png" alt="Smart Betting" className="h-9 invert hue-rotate-180" />
          <div className="flex items-center gap-2 sm:gap-3 ml-3 shrink-0">
            {/* Sem usuário não há menu da conta, e é lá que o idioma mora.
                Esta tela tem cabeçalho próprio, então precisa do seu. */}
            <SeletorDeIdiomaCompacto tom="claro" />
            <button
              type="button"
              onClick={() => navigate(user ? "/futebol" : "/auth")}
              className="hidden sm:inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-semibold text-sm transition-colors"
            >
              {user ? t('lp.nav.acessar') : t('lp.nav.entrar')}
            </button>
            <button
              type="button"
              onClick={goAuth}
              className="inline-flex items-center h-10 px-3 sm:px-4 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              {t('lp.nav.comecarGratis')}
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
            {t('lp.hero.sobretitulo')}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-5 max-w-3xl">
            {t('lp.hero.titulo')}<br />
            <span className="text-amber">{t('lp.hero.tituloDestaque')}</span>
          </h1>
          <p className="text-base sm:text-lg text-white/75 mb-8 max-w-xl leading-relaxed">
            <Trans
              t={t}
              i18nKey="lp.hero.descricao"
              components={[<span className="text-white font-semibold" key="clique" />]}
            />
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={goAuth}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5 shrink-0" />
              {t('lp.hero.ctaCriarConta')}
            </button>
            <button
              type="button"
              onClick={goProduct}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-rebrand-md bg-white text-forest hover:bg-white/90 font-bold text-[15px] shadow-md transition-colors"
            >
              {t('lp.hero.ctaEspiar')}
            </button>
          </div>
          <p className="text-[12px] text-white/55 mt-4">
            {t('lp.hero.rodape')}
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
              {t('lp.mock.dadosDeExemplo')}
            </span>
          </div>

          <div className="p-3 sm:p-5">
            <div className="grid lg:grid-cols-[340px_1fr] gap-3">
              {/* Board de oportunidades */}
              <div className="rounded-rebrand-lg bg-white border border-line overflow-hidden">
                <div className="px-4 pt-3.5 pb-2.5 border-b border-line">
                  <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">{t('lp.mock.boardTitulo')}</p>
                  <p className="text-[11px] text-ink-3 mt-0.5">{t('lp.mock.boardSubtitulo')}</p>
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
                        <div className="text-[13px] font-semibold tracking-tight text-ink truncate">{t(o.pick)}</div>
                        <div className="text-[10px] text-ink-3 truncate">{o.home} × {o.away} · {o.hora}</div>
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums text-ink shrink-0">{fmtOdd(o.odd)}</span>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${active ? "text-forest" : "text-ink-3"}`} />
                    </button>
                  );
                })}
                {/* Régua */}
                <div className="px-4 py-2 flex items-center gap-2 bg-canvas-2">
                  <span className="flex-1 h-px bg-line" />
                  <span className="text-[10px] text-ink-3">{t('lp.mock.regua')}</span>
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
                        <div className="text-[13px] font-semibold tracking-tight text-ink truncate">{t(o.pick)}</div>
                        <div className="text-[10px] text-ink-3 truncate">{o.home} × {o.away} · {o.hora}</div>
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums text-ink shrink-0">{fmtOdd(o.odd)}</span>
                      <ChevronRight className="w-4 h-4 shrink-0 text-ink-3" />
                    </button>
                  );
                })}
              </div>

              {/* Card "O que olhar" do selecionado */}
              <div className="rounded-rebrand-lg overflow-hidden bg-white border border-line min-w-0">
                <div className="px-4 sm:px-5 py-3 flex items-center justify-between bg-canvas-2 border-b border-line">
                  <div className="text-[11px] uppercase tracking-[0.18em] font-bold text-ink-2">{t('lp.mock.cardTitulo')}</div>
                  <span className={`text-[11px] font-semibold ${v.color}`}>{t(v.chave)}</span>
                </div>
                <div className="p-4 sm:p-5 grid sm:grid-cols-[1fr_200px] gap-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-ink-3 mb-2">
                      <Crest teamId={selected.homeId} name={selected.home} size={18} />
                      <Crest teamId={selected.awayId} name={selected.away} size={18} />
                      <span className="ml-1 truncate">{selected.home} × {selected.away} · {selected.comp}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold uppercase tracking-[0.08em] bg-canvas-2 text-ink-2">{t(selected.market)}</span>
                      <span className={`px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.1em] ${faixaBadge(selected.faixa)}`}>{t('hoje.destaque.faixa', { faixa: t(`faixa.${selected.faixa}`) })}</span>
                    </div>
                    <div className="text-2xl sm:text-[28px] font-bold tracking-tight mt-2 text-ink leading-tight">{t(selected.pick)}</div>
                    <div className="mt-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-forest">{t('motivos.porque')}</div>
                      <ul className="flex flex-col gap-1.5">
                        {selected.porque.map((chave) => (
                          <li key={chave} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-forest" />
                            <span>{t(chave)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {selected.atencao.length > 0 && (
                      <div className="mt-4">
                        <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2 text-amber-2">{t('lp.mock.atencao')}</div>
                        <ul className="flex flex-col gap-1.5">
                          {selected.atencao.map((chave) => (
                            <li key={chave} className="flex items-start gap-2 text-[13px] leading-snug text-ink-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber" />
                              <span>{t(chave)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* Painel de confiabilidade */}
                  <div className="sm:pl-5 sm:border-l sm:border-line flex flex-col gap-3">
                    <div className="rounded-rebrand-md p-4 text-white" style={{ background: "linear-gradient(135deg, #0a3d2e, #08321f)" }}>
                      <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-white/50">{t('lp.mock.confiabilidade')}</div>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-[44px] font-bold tabular-nums tracking-tight leading-none" style={{ color: "#fbbf24" }}>{selected.score}</span>
                        <span className="text-[13px] text-white/40">/100</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">{t('numeros.chance')}</div>
                          <div className="text-[18px] font-semibold tabular-nums leading-none mt-1">{selected.chance}%</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.14em] font-semibold text-white/50">{t('numeros.odd')}</div>
                          <div className="text-[18px] font-semibold tabular-nums leading-none mt-1">{fmtOdd(selected.odd)}</div>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-ink-3 leading-snug">{t('lp.mock.aviso')}</p>
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
            {t('lp.mock.ctaProduto')}
          </button>
          <p className="text-sm text-ink-3 mt-3">
            {t('lp.mock.ctaProdutoRodape')}
          </p>
        </div>
      </section>

      {/* Faixa de fatos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-14 sm:mt-20">
        <div className="border-y border-line py-4 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-2 sm:gap-x-8 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">
          <span>{t('lp.fatos.mercados')}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t('lp.fatos.score')}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t('lp.fatos.odds')}</span>
          <span className="hidden sm:inline text-amber-2">·</span>
          <span>{t('lp.fatos.competicoes')}</span>
        </div>
      </section>

      {/* O que tem dentro — lista editorial numerada */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-24">
        <div className="grid md:grid-cols-[minmax(220px,300px)_1fr] gap-10 md:gap-16">
          <div className="md:sticky md:top-24 self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">{t('lp.dentro.sobretitulo')}</p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-ink leading-tight mb-4">
              {t('lp.dentro.titulo')}
            </h2>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              {t('lp.dentro.descricao')}
            </p>
          </div>

          <div>
            {[
              { num: "01", title: "lp.dentro.oportunidadesTitulo", text: "lp.dentro.oportunidadesTexto" },
              { num: "02", title: "lp.dentro.scoreTitulo", text: "lp.dentro.scoreTexto" },
              { num: "03", title: "lp.dentro.porqueTitulo", text: "lp.dentro.porqueTexto" },
              // ⚠️ Sobre o item 04: "escalação provável" não existe, e o texto do
              // catálogo diz CONFIRMADA de propósito — a fonte não publica
              // previsão de escalação em momento nenhum. Ver
              // src/utils/futebol-escalacao.ts.
              { num: "04", title: "lp.dentro.leituraTitulo", text: "lp.dentro.leituraTexto" },
            ].map((f) => (
              <div key={f.num} className="grid grid-cols-[56px_1fr] sm:grid-cols-[88px_1fr] gap-4 sm:gap-8 py-7 border-t border-line last:border-b">
                <span className="font-mono text-3xl sm:text-5xl font-black text-amber leading-none tabular-nums">{f.num}</span>
                <div>
                  <h3 className="text-lg font-bold text-ink mb-1.5">{t(f.title)}</h3>
                  <p className="text-[14px] text-ink-2 leading-relaxed max-w-xl">{t(f.text)}</p>
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
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-amber mb-3">{t('lp.combinado.sobretitulo')}</p>
          <h2 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-10 sm:mb-12 max-w-2xl">
            {t('lp.combinado.titulo')}
          </h2>
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/60 pb-3 border-b border-white/15">
                {t('lp.combinado.nuncaTitulo')}
              </h3>
              {[
                "lp.combinado.nunca1",
                "lp.combinado.nunca2",
                "lp.combinado.nunca3",
                "lp.combinado.nunca4",
                "lp.combinado.nunca5",
              ].map((chave) => (
                <div key={chave} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white/85">
                  <XCircle className="w-4 h-4 text-white/40 shrink-0" />
                  {t(chave)}
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-amber pb-3 border-b border-white/15">
                {t('lp.combinado.sempreTitulo')}
              </h3>
              {[
                "lp.combinado.sempre1",
                "lp.combinado.sempre2",
                "lp.combinado.sempre3",
                "lp.combinado.sempre4",
                "lp.combinado.sempre5",
              ].map((chave) => (
                <div key={chave} className="flex items-center gap-3 py-3.5 border-b border-white/10 text-[14px] text-white">
                  <CheckCircle2 className="w-4 h-4 text-amber shrink-0" />
                  {t(chave)}
                </div>
              ))}
            </div>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/40 mt-10">
            {t('lp.combinado.assinatura')}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <div className="text-center mb-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-forest mb-2">{t('lp.faq.sobretitulo')}</p>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-ink">{t('lp.faq.titulo')}</h2>
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
              {t('lp.final.titulo')}
            </h2>
            <p className="text-[15px] text-ink-2 leading-relaxed max-w-lg">
              {t('lp.final.descricao')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[240px]">
            <button
              type="button"
              onClick={goAuth}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[15px] shadow-md transition-colors"
            >
              <PlayCircle className="h-5 w-5" />
              {t('lp.final.ctaComecar')}
            </button>
            <button
              type="button"
              onClick={goProduct}
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-rebrand-md border border-line-2 bg-white text-ink hover:border-forest/40 font-bold text-[15px] transition-colors"
            >
              {t('lp.final.ctaEspiar')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FutebolLP;
