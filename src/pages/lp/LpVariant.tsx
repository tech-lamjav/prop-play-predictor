import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePostHog } from "@posthog/react";
import { Seo } from "@/components/Seo";
import NotFound from "@/pages/NotFound";
import AnalyticsNav from "@/components/AnalyticsNav";
import { LpHero } from "@/components/lp/LpHero";
import { LpEstatisticaIsolada } from "@/components/lp/LpEstatisticaIsolada";
import { LpTrabalhoManual } from "@/components/lp/LpTrabalhoManual";
import { LpComoFunciona } from "@/components/lp/LpComoFunciona";
import { LpBeneficios } from "@/components/lp/LpBeneficios";
import { LpDepoimentos } from "@/components/lp/LpDepoimentos";
import { LpFaq } from "@/components/lp/LpFaq";
import { lpFaqSchema } from "@/components/lp/lp-faq-data";
import { LpOferta } from "@/components/lp/LpOferta";
import { LpStickyCta } from "@/components/lp/LpStickyCta";
import { findVariant, type LpBloco, type LpVariant as LpVariantConfig } from "./variants";

// ============================================================
// Página única que renderiza qualquer LP de teste (/lp/:slug).
//
// A LP vem do registry em variants.ts: a copy do hero, a lista de blocos e a
// ordem. Aqui só resolve o slug, dispara os eventos e monta.
//
// O primeiro bloco entra sem cabeçalho quando ele é o próprio gancho da página:
// o hero já disse aquele título, repetir soaria como eco.
//
// Todas as LPs são noindex: são páginas de tráfego pago e não podem competir
// com a /futebol/comecar na busca.
// ============================================================

const MARCOS_SCROLL = [25, 50, 75, 100];

function LpConteudo({ variant }: { variant: LpVariantConfig }) {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const marcosVistos = useRef<Set<number>>(new Set());

  useEffect(() => {
    posthog?.capture("lp_view", { slug: variant.slug, gancho: variant.gancho });
  }, [posthog, variant]);

  // Profundidade de rolagem: cada marco dispara uma vez só por carregamento
  useEffect(() => {
    if (!posthog) return;
    const onScroll = () => {
      const altura = document.documentElement.scrollHeight - window.innerHeight;
      if (altura <= 0) return;
      const pct = (window.scrollY / altura) * 100;
      for (const marco of MARCOS_SCROLL) {
        if (pct >= marco && !marcosVistos.current.has(marco)) {
          marcosVistos.current.add(marco);
          posthog.capture("lp_scroll_depth", { slug: variant.slug, marco });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [posthog, variant.slug]);

  /**
   * Cadastro e o reverse trial do Futebol libera os 7 dias no primeiro acesso.
   * O destino é o próprio produto, não a página de assinatura: quem clicou num
   * CTA de teste grátis não pode cair num botão de pagamento desabilitado.
   */
  const onCta = (posicao: string) => {
    posthog?.capture("lp_cta_click", {
      slug: variant.slug,
      gancho: variant.gancho,
      posicao,
    });
    navigate("/auth", { state: { from: { pathname: "/futebol" } } });
  };

  const renderBloco = (bloco: LpBloco) => {
    // O bloco que virou o hero desta LP entra sem cabeçalho, pra não repetir
    // o mesmo título duas vezes na mesma página.
    const ehGancho = bloco === variant.ganchoBloco;
    switch (bloco) {
      case "problema":
        return <LpEstatisticaIsolada key={bloco} semCabecalho={ehGancho} />;
      case "manual":
        return <LpTrabalhoManual key={bloco} semCabecalho={ehGancho} />;
      case "automatiza":
        return <LpComoFunciona key={bloco} />;
      case "beneficios":
        return <LpBeneficios key={bloco} semCabecalho={ehGancho} />;
      case "depoimentos":
        return <LpDepoimentos key={bloco} />;
      case "faq":
        return <LpFaq key={bloco} />;
      case "oferta":
        return <LpOferta key={bloco} variant={variant} onCta={() => onCta("oferta")} />;
      default:
        return null;
    }
  };

  return (
    <div className="theme-bolao min-h-screen bg-canvas text-ink overflow-x-hidden">
      <Seo
        noindex
        title={variant.seo.title}
        description={variant.seo.description}
        jsonLd={lpFaqSchema()}
      />
      {/* Cabeçalho da plataforma, o mesmo do resto do app. O rodapé vem do
          App.tsx e já entra em todas as rotas.
          Sem a tab bar do mobile: no celular o rodapé da viewport é do CTA, e
          duas barras fixas brigariam pelo mesmo espaço do polegar. */}
      <AnalyticsNav variant="rebrand" semTabBar semSecoes />
      <LpHero variant={variant} onCta={() => onCta("hero")} />
      {variant.blocos.map(renderBloco)}
      <LpStickyCta
        label={variant.cta.label}
        microcopy={variant.cta.microcopy}
        onCta={() => onCta("sticky")}
      />
    </div>
  );
}

export default function LpVariant() {
  const { slug } = useParams();
  const variant = findVariant(slug);
  if (!variant) return <NotFound />;
  // key remonta o conteúdo (e redispara o lp_view) ao trocar de LP
  return <LpConteudo key={variant.slug} variant={variant} />;
}
