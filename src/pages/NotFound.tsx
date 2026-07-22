import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="theme-bolao min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="text-center">
        <p className="font-mono text-[13px] font-bold uppercase tracking-[0.2em] text-forest mb-3">Erro 404</p>
        <h1 className="font-display text-5xl font-black text-ink mb-3">Página não encontrada</h1>
        <p className="text-[15px] text-ink-2 mb-6 max-w-sm mx-auto">
          A página que você procurou não existe ou foi movida.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center h-11 px-6 rounded-rebrand-md bg-forest text-white font-bold text-sm hover:bg-forest-soft transition-colors"
        >
          Voltar ao início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
