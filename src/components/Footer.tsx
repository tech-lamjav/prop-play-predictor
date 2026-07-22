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

  // /inicio é um hub pós-login (dispatcher), não uma página de marketing —
  // o rodapé de "Produtos/Contato" fica deslocado e cria um vão em branco.
  if (location.pathname.startsWith('/inicio')) return null;

  // Rotas com header claro (rebrand) → rodapé claro. Onda 1 da padronização:
  // adiciona as rotas de NBA/Futebol/Bets que tinham header claro + footer dark.
  // (As telas dark legadas — paywalls, settings, dashboard, share, como-usar —
  // ficam de fora e seguem dark até a Onda 3.)
  const rebrandPrefixes = [
    '/betinho', '/bolao', '/futebol',
    '/home-nba', '/home-games', '/game', '/oportunidades',
    '/nba-dashboard', '/analise-360', '/report',
    '/bets', '/bankroll', '/betting-dashboard',
    '/privacidade', '/termos', '/auth', '/onboarding',
  ];
  const useRebrand =
    location.pathname === '/' ||
    location.pathname === '/nba' ||
    rebrandPrefixes.some((p) => location.pathname.startsWith(p));

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
                <a href="/futebol" className={`${t.muted} ${t.hover} transition-colors`}>
                  Futebol
                </a>
              </li>
              <li>
                <a href="/betinho" className={`${t.muted} ${t.hover} transition-colors`}>
                  Betinho
                </a>
              </li>
              <li>
                <a href="/nba" className={`${t.muted} ${t.hover} transition-colors`}>
                  Plataforma NBA
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
