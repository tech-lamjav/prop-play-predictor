import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollDepthPixel } from "./use-scroll-depth-pixel";

/**
 * O que este arquivo protege: os marcos disparam uma vez só por visita, e
 * nenhum marco nasce disparado. O erro caro aqui não é "não disparou" — é
 * disparar 100% em todo pageview e inflar a métrica que decide verba.
 */

/** jsdom não rola de verdade: fixamos as alturas e movemos o scrollY na mão. */
function montarPagina({ alturaTotal = 4000, viewport = 1000 } = {}) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    get: () => alturaTotal,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: viewport,
  });
}

function rolarPara(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: y });
    window.dispatchEvent(new Event("scroll"));
  });
}

let fbq: ReturnType<typeof vi.fn>;

/** Marcos disparados, na ordem, a partir das chamadas registradas no fbq. */
function marcos(): number[] {
  return fbq.mock.calls
    .filter((c) => c[0] === "trackCustom" && c[1] === "ScrollDepth")
    .map((c) => (c[2] as { percent: number }).percent);
}

beforeEach(() => {
  fbq = vi.fn();
  (window as any).fbq = fbq;
  montarPagina();
  // rAF síncrono: o hook agenda a medição num frame.
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).fbq;
});

describe("useScrollDepthPixel", () => {
  it("não dispara nada antes de o usuário rolar", () => {
    renderHook(() => useScrollDepthPixel("futebol-comecar"));
    expect(fbq).not.toHaveBeenCalled();
  });

  it("dispara cada marco uma única vez, na ordem", () => {
    renderHook(() => useScrollDepthPixel("futebol-comecar"));

    rolarPara(0); // 1000/4000 = 25%
    rolarPara(1000); // 50%
    rolarPara(1000); // repetido: não conta de novo
    rolarPara(2000); // 75%
    rolarPara(3000); // 100%

    expect(marcos()).toEqual([25, 50, 75, 100]);
  });

  it("dispara os marcos pulados quando a rolagem vai direto ao rodapé", () => {
    renderHook(() => useScrollDepthPixel("futebol-comecar"));

    rolarPara(3000);

    expect(marcos()).toEqual([25, 50, 75, 100]);
  });

  it("carimba o content_name recebido", () => {
    renderHook(() => useScrollDepthPixel("futebol-comecar"));

    rolarPara(0);

    expect(fbq).toHaveBeenCalledWith("trackCustom", "ScrollDepth", {
      percent: 25,
      content_name: "futebol-comecar",
    });
  });

  it("ignora página que cabe na tela — não existe 100% sem rolagem", () => {
    montarPagina({ alturaTotal: 800, viewport: 1000 });
    renderHook(() => useScrollDepthPixel("futebol-comecar"));

    rolarPara(0);

    expect(fbq).not.toHaveBeenCalled();
  });

  it("não quebra quando o Pixel foi bloqueado (window.fbq ausente)", () => {
    delete (window as any).fbq;
    renderHook(() => useScrollDepthPixel("futebol-comecar"));

    expect(() => rolarPara(3000)).not.toThrow();
  });

  it("não dispara com enabled=false", () => {
    renderHook(() => useScrollDepthPixel("futebol-comecar", false));

    rolarPara(3000);

    expect(fbq).not.toHaveBeenCalled();
  });
});
