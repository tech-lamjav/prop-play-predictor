import { useEffect, useRef } from "react";

/**
 * Marcos de profundidade de rolagem no Meta Pixel.
 *
 * Dispara o evento customizado `ScrollDepth` (o Meta não tem evento padrão de
 * scroll) com `percent` (25 | 50 | 75 | 100) e `content_name` — no Events
 * Manager isso vira uma linha só, e as conversões personalizadas saem
 * filtrando o parâmetro `percent`.
 *
 * Regras:
 *  - cada marco dispara no máximo 1x por visita (por montagem do componente);
 *  - só medimos em resposta a rolagem real: página que cabe na tela sem rolar
 *    não gera evento, senão todo pageview nasceria com 100%;
 *  - marcos pulados (rolagem rápida até o rodapé) disparam todos, em ordem,
 *    igual ao gatilho de scroll do GTM.
 *
 * O Pixel é carregado no `index.html`, fora do bundle — se um bloqueador
 * derrubar o script, `window.fbq` não existe e o hook vira no-op.
 */

const MARCOS = [25, 50, 75, 100] as const;

/** Folga em px: `scrollY + innerHeight` raramente encosta exato no scrollHeight. */
const TOLERANCIA_PX = 2;

export function useScrollDepthPixel(contentName: string, enabled = true) {
  const disparados = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    disparados.current = new Set();
    // `pendente` é o guard do throttle e `frame` só existe pro cancel na
    // limpeza: são variáveis separadas de propósito. Se o guard fosse o
    // próprio id, `frame = requestAnimationFrame(medir)` só atribuiria DEPOIS
    // de `medir` rodar — e num rAF síncrono o guard ficaria travado ligado.
    let pendente = false;
    let frame = 0;

    const medir = () => {
      pendente = false;
      const alturaTotal = document.documentElement.scrollHeight;
      // Sem rolagem possível não há profundidade a medir.
      if (alturaTotal <= window.innerHeight) return;

      const visivel = window.scrollY + window.innerHeight + TOLERANCIA_PX;
      const percent = Math.min(100, (visivel / alturaTotal) * 100);

      for (const marco of MARCOS) {
        if (percent < marco || disparados.current.has(marco)) continue;
        disparados.current.add(marco);
        const fbq = (window as any).fbq;
        if (typeof fbq === "function") {
          fbq("trackCustom", "ScrollDepth", {
            percent: marco,
            content_name: contentName,
          });
        }
      }
    };

    const onScroll = () => {
      if (pendente) return;
      pendente = true;
      frame = window.requestAnimationFrame(medir);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [contentName, enabled]);
}
