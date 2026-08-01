import { useEffect, useState } from "react";

/**
 * Barra fixa de CTA no mobile. Aparece depois que o hero sai da tela, pra não
 * competir com o botão principal. Só no mobile: no desktop o CTA da nav já fica
 * sempre visível.
 */
export function LpStickyCta({
  label,
  microcopy,
  onCta,
}: {
  label: string;
  microcopy: string;
  onCta: () => void;
}) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisivel(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A barra é fixa e cobriria o fim do rodapé global (linha do +18 e dos
  // termos). Mesmo mecanismo da tab bar da plataforma: o body reserva o espaço
  // só enquanto a barra existe. Ver index.css, body.has-lp-cta.
  useEffect(() => {
    document.body.classList.add("has-lp-cta");
    return () => document.body.classList.remove("has-lp-cta");
  }, []);

  return (
    <div
      className={`sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-canvas/95 backdrop-blur-lg border-t border-line px-4 pt-3 transition-transform duration-200 ${
        visivel ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={onCta}
        className="w-full inline-flex items-center justify-center h-[52px] rounded-rebrand-md bg-amber text-white hover:bg-amber-2 font-bold text-[16px] shadow-md transition-colors"
      >
        {label}
      </button>
      <p className="text-[11.5px] text-ink-3 text-center mt-2 leading-snug">{microcopy}</p>
    </div>
  );
}
