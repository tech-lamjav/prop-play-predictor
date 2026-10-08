import { describe, it, expect } from "vitest";
import {
  escapeAttr,
  buildHeadBlock,
  replaceHeadBlock,
} from "../../scripts/gen-route-heads.mjs";
import publicRoutes from "./public-routes.json";
import { ROTAS_PUBLICAS } from "@/components/Seo";
import { IDIOMAS, IDIOMA_DE_REFERENCIA } from "@/i18n/idiomas";

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

// ============================================================================
// O título da aba fala o idioma ativo (#532)
// ============================================================================
// Mesma espécie da guarda de paridade dos catálogos (src/i18n): o título da aba
// e a descrição do card são texto que a PESSOA lê, e uma rota sem a copy do
// idioma ativo abre em português no meio de uma tela em espanhol. Sem isto, a
// falha aparece na aba do visitante, não no CI.
//
// ⚠️ A tabela NÃO ganha rota por idioma, e esta guarda existe também para
// lembrar disso: prefixo de caminho, hreflang e redirecionamento por idioma
// ficaram declarados FORA de escopo na #532. O que varia por idioma aqui é só
// texto visível; a URL continua sendo uma só.
// ============================================================================
describe("a copy de <head> existe em todo idioma da matriz", () => {
  const outros = IDIOMAS.filter((i) => i !== IDIOMA_DE_REFERENCIA);

  it("a matriz tem idioma além do de referência", () => {
    // Sem isto os testes abaixo passariam por vacuidade se a matriz encolhesse.
    expect(outros.length).toBeGreaterThan(0);
  });

  for (const idioma of outros) {
    it(`idioma "${idioma}"`, () => {
      for (const rota of ROTAS_PUBLICAS) {
        const traduzido = rota.traducoes?.[idioma];
        expect(traduzido, `${rota.path}: falta a copy em "${idioma}"`).toBeDefined();
        expect(
          traduzido!.title.length,
          `${rota.path} · ${idioma}: título curto demais`,
        ).toBeGreaterThan(10);
        expect(
          traduzido!.description.length,
          `${rota.path} · ${idioma}: descrição curta demais`,
        ).toBeGreaterThan(30);
        // A mesma regra de copy do idioma de referência vale aqui.
        expect(traduzido!.title, `${rota.path} · ${idioma}`).not.toContain("—");
        expect(traduzido!.description, `${rota.path} · ${idioma}`).not.toContain("—");
        // Tradução IGUAL ao português é tradução que não aconteceu.
        expect(traduzido!.title, `${rota.path} · ${idioma}: título não traduzido`).not.toBe(
          rota.title,
        );
      }
    });
  }
});
