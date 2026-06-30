import { useLocation } from 'react-router-dom';

/**
 * Footer global do app. Renderizado uma vez no App.tsx, aparece em todas
 * as rotas (incluindo /auth e /bolao*).
 *
 * Aplica tema rebrand (canvas/forest/amber/ink) nas landings públicas
 * (/, /nba, /bolao*) e /auth pra ficar consistente com a IDV nova. Resto
 * do app continua no tema dark padrão (terminal).
 */
const Footer = () => {
  const location = useLocation();
  const useRebrand =
    location.pathname === '/' ||
    location.pathname === '/nba' ||
    location.pathname.startsWith('/betinho') ||
    location.pathname.startsWith('/bolao') ||
    location.pathname.startsWith('/privacidade') ||
    location.pathname.startsWith('/termos') ||
    location.pathname.startsWith('/auth');

  // Paleta condicional. Cores literais em vez de CSS vars pra evitar problemas
  // de scope (var(--ink) só existe dentro de .theme-bolao).
  const t = useRebrand
    ? {
        wrapper: 'theme-bolao border-t border-[#e3e6e0] bg-[#eef0eb]',
        body: 'text-[#1a1d1a]',
        title: 'text-[#1a1d1a]',
        muted: 'text-[#4a4f48]',
        hover: 'hover:text-[#1a1d1a]',
        divider: 'border-[#e3e6e0]',
        logoFilter: 'invert hue-rotate-180', // logo branca vira escura
      }
    : {
        wrapper: 'border-t border-border bg-muted/20',
        body: '',
        title: 'text-foreground',
        muted: 'text-muted-foreground',
        hover: 'hover:text-foreground',
        divider: 'border-border',
        logoFilter: '',
      };

  return (
    <footer aria-label="Rodapé do site" className={t.wrapper}>
      <div className={`container mx-auto px-4 sm:px-6 py-12 ${t.body}`}>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <img
              src="/logo.png"
              alt="Smart Betting"
              className={`h-8 ${t.logoFilter}`}
            />
            <p className={`text-sm ${t.muted} max-w-xs`}>
              Análises, gestão e ferramentas para apostadores que querem decidir com dados.
            </p>
          </div>

          {/* Produtos */}
          <div className="space-y-4">
            <h4 className={`font-semibold ${t.title} text-sm`}>Produtos</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/nba" className={`${t.muted} ${t.hover} transition-colors`}>
                  Plataforma NBA
                </a>
              </li>
              <li>
                <a href="/betinho" className={`${t.muted} ${t.hover} transition-colors`}>
                  Betinho
                </a>
              </li>
              <li>
                <a href="/bolao" className={`${t.muted} ${t.hover} transition-colors`}>
                  Bolão Copa 2026
                </a>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h4 className={`font-semibold ${t.title} text-sm`}>Contato</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://www.instagram.com/smartbetting.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 ${t.muted} ${t.hover} transition-colors`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href="http://wa.me/5511952136845"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 ${t.muted} ${t.hover} transition-colors`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="mailto:tecnologia@smartbetting.app"
                  className={`flex items-center gap-2 ${t.muted} ${t.hover} transition-colors`}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  tecnologia@smartbetting.app
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className={`border-t ${t.divider} mt-8 pt-8 text-center text-sm ${t.muted}`}>
          <a
            href="/privacidade"
            className={`${t.hover} transition-colors underline underline-offset-4`}
          >
            Termos de Uso e Política de Privacidade
          </a>
          <p className="mt-2">
            &copy; {new Date().getFullYear()} Smart Betting. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
