import { describe, it, expect } from "vitest";
import {
  escapeAttr,
  buildHeadBlock,
  replaceHeadBlock,
} from "../../scripts/gen-route-heads.mjs";
import publicRoutes from "./public-routes.json";

describe("gen-route-heads", () => {
  it("escapa o que quebraria um atributo HTML, e preserva acento", () => {
    expect(escapeAttr('Aspas "duplas" & <tag>')).toBe(
      "Aspas &quot;duplas&quot; &amp; &lt;tag&gt;",
    );
    // Acento é válido em UTF-8: não deve virar entidade.
    expect(escapeAttr("Análise de Prop Bets")).toBe("Análise de Prop Bets");
  });

  it("monta o head com canonical e imagem absolutos", () => {
    const block = buildHeadBlock({
      path: "/futebol",
      title: "Futebol Hoje",
      description: "Oportunidades do dia.",
      image: "/og/og-futebol.jpg",
    });
    expect(block).toContain("<title>Futebol Hoje</title>");
    expect(block).toContain(
      '<link rel="canonical" href="https://www.smartbetting.app/futebol" />',
    );
    expect(block).toContain(
      '<meta property="og:image" content="https://www.smartbetting.app/og/og-futebol.jpg" />',
    );
    expect(block).toContain('<meta name="twitter:image"');
  });

  it("usa o card da marca quando a rota não tem imagem própria", () => {
    const block = buildHeadBlock({
      path: "/como-usar",
      title: "Como usar",
      description: "Guia.",
    });
    expect(block).toContain("/og/og-default.jpg");
  });

  it("respeita o canonical alternativo (caso /termos → /privacidade)", () => {
    const termos = publicRoutes.find((r) => r.path === "/termos");
    const block = buildHeadBlock(termos!);
    expect(block).toContain(
      '<link rel="canonical" href="https://www.smartbetting.app/privacidade" />',
    );
  });

  it("substitui só o miolo entre os marcadores", () => {
    const html = [
      "<head>",
      "  <!-- seo:head:start -->",
      "  <title>antigo</title>",
      "  <!-- seo:head:end -->",
      '  <meta name="author" content="Smart Betting" />',
      "</head>",
    ].join("\n");
    const out = replaceHeadBlock(html, "    <title>novo</title>");
    expect(out).toContain("<title>novo</title>");
    expect(out).not.toContain("<title>antigo</title>");
    // O que está fora dos marcadores sobrevive.
    expect(out).toContain('<meta name="author" content="Smart Betting" />');
  });

  it("falha alto se os marcadores desaparecerem do index.html", () => {
    expect(() => replaceHeadBlock("<head></head>", "x")).toThrow(
      /marcadores/,
    );
  });

  it("toda rota da tabela tem title, description e dados de sitemap coerentes", () => {
    for (const route of publicRoutes) {
      expect(route.path.startsWith("/"), route.path).toBe(true);
      expect(route.title?.length, route.path).toBeGreaterThan(10);
      expect(route.description?.length, route.path).toBeGreaterThan(30);
      // `sitemap: false` é intencional; se for objeto, precisa dos 3 campos.
      if (route.sitemap && typeof route.sitemap === "object") {
        expect(route.sitemap.changefreq, route.path).toBeTruthy();
        expect(route.sitemap.priority, route.path).toBeTruthy();
        expect(route.sitemap.lastmod, route.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("não usa travessão nos títulos (regra de copy do produto)", () => {
    for (const route of publicRoutes) {
      expect(route.title, route.path).not.toContain("—");
      expect(route.description, route.path).not.toContain("—");
    }
  });
});
