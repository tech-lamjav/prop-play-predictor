import { useLocation, useNavigate } from 'react-router-dom';
import { Instagram, MessageCircle, Mail } from 'lucide-react';
import { SHOW_BOLAO_ENTRY_POINTS } from '@/config/bolao';
import { useReferral } from './ReferralProvider';

/**
 * Rodapé global (handoff "Header, Footer e cor secundária Areia", variante
 * forest — ver docs/design-system/handoff-header-footer.md).
 *
 * Renderizado uma vez no App.tsx, aparece em todas as rotas. Duas partes:
 * o corpo em forest com 4 colunas de links, e a barra legal em forest-deep
 * (`#051f12`) que ancora o pé da página.
 */

type FooterLink = { label: string; href?: string; onClick?: () => void };

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openReferral } = useReferral();

  // /inicio é um hub pós-login (dispatcher), não uma página de marketing —
  // o rodapé de "Produtos/Contato" fica deslocado e cria um vão em branco.
  if (location.pathname.startsWith('/inicio')) return null;

  // O rodapé lista o que a Smart Betting OFERECE — um por produto, não uma
  // cópia do menu. As sub-seções (oportunidades, jogos, relatório) já vivem
  // na faixa 2 do header.
  const analises: FooterLink[] = [
    { label: 'Futebol', href: '/futebol' },
    { label: 'NBA', href: '/home-nba' },
  ];

  const ferramentas: FooterLink[] = [
    { label: 'Betinho', href: '/betting-dashboard' },
    ...(SHOW_BOLAO_ENTRY_POINTS ? [{ label: 'Bolão Copa 2026', href: '/bolao' }] : []),
  ];

  // Conta e ajuda. "Planos e preços" e "Indique um amigo" vieram de Produtos:
  // não são o que a gente oferece, são coisas da conta do usuário.
  const suporte: FooterLink[] = [
    { label: 'Planos e preços', href: '/planos' },
    { label: 'Como usar', href: '/como-usar' },
    { label: 'Configurações da conta', href: '/settings' },
    { label: 'Indique um amigo', onClick: openReferral },
    { label: 'Falar com o time', href: 'mailto:tecnologia@smartbetting.app' },
  ];

  const linkCls = 'text-[13px] text-white/70 hover:text-white transition-colors text-left';

  const renderLink = (l: FooterLink) => {
    if (l.onClick) {
      return (
        <button key={l.label} type="button" onClick={l.onClick} className={linkCls}>
          {l.label}
        </button>
      );
    }
    const external = l.href?.startsWith('mailto:') || l.href?.startsWith('http');
    if (external) {
      return (
        <a key={l.label} href={l.href} className={linkCls}>
          {l.label}
        </a>
      );
    }
    return (
      <button key={l.label} type="button" onClick={() => navigate(l.href!)} className={linkCls}>
        {l.label}
      </button>
    );
  };

  const Column = ({ title, links }: { title: string; links: FooterLink[] }) => (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400">{title}</div>
      <div className="flex flex-col gap-2.5 mt-4 items-start">{links.map(renderLink)}</div>
    </div>
  );

  const socialCls =
    'w-[34px] h-[34px] rounded-[9px] border border-white/15 grid place-items-center text-white/80 hover:bg-white/10 hover:text-white transition-colors';

  return (
    <footer aria-label="Rodapé do site" className="bg-forest text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-11 pb-9 grid gap-10 sm:grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr]">
        {/* Marca */}
        <div>
          <img src="/logo.png" alt="Smart Betting" className="h-[26px] w-auto" />
          <p className="text-[13px] leading-relaxed text-white/60 mt-4 max-w-[340px] text-pretty">
            Análises, gestão de banca e ferramentas para quem quer decidir com dados. Projeções de
            NBA e futebol atualizadas diariamente, com score de confiabilidade em cada oportunidade.
          </p>
          <div className="flex gap-2 mt-5">
            <a
              href="https://www.instagram.com/smartbetting.app/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={socialCls}
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="https://wa.me/5511952136845"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className={socialCls}
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <a href="mailto:tecnologia@smartbetting.app" aria-label="E-mail" className={socialCls}>
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>

        <Column title="Análises" links={analises} />
        <Column title="Ferramentas" links={ferramentas} />
        <Column title="Suporte" links={suporte} />
      </div>

      {/* Barra legal */}
      <div className="bg-forest-deep border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-[56px] flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-4 py-3">
            <span className="text-xs text-white/45">
              &copy; {new Date().getFullYear()} Smart Betting
            </span>
            {/* Link único: /termos e /privacidade renderizam a MESMA página
                (App.tsx), que já traz as duas seções. Dois rótulos pro mesmo
                destino confundem mais do que ajudam. */}
            <a href="/privacidade" className="text-xs text-white/70 hover:text-white transition-colors">
              Termos de uso e privacidade
            </a>
          </div>
          <div className="flex items-center gap-2.5 py-3">
            <span className="inline-flex items-center h-[22px] px-2 rounded-[5px] border border-white/25 text-white/70 text-[10px] font-bold tracking-[0.08em]">
              +18
            </span>
            <span className="text-[11.5px] text-white/45">
              Conteúdo analítico. Não é recomendação de aposta. Jogue com responsabilidade.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
