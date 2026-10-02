import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Instagram, MessageCircle, Mail } from 'lucide-react';
import { SHOW_BOLAO_ENTRY_POINTS } from '@/config/bolao';
import { SHOW_COMO_USAR_ENTRY_POINTS } from '@/config/como-usar';
import { EMAIL_DO_TIME, WHATSAPP_FALAR_COM_O_TIME } from '@/config/contato';
import { ehExterno } from '@/lib/abrir-destino';
import { useReferral } from './ReferralProvider';

/**
 * Rodapé global (handoff "Header, Footer e cor secundária Areia", variante
 * forest — ver docs/design-system/handoff-header-footer.md).
 *
 * Renderizado uma vez no App.tsx, aparece em todas as rotas. Duas partes:
 * o corpo em forest com 4 colunas de links, e a barra legal em forest-deep
 * (`#051f12`) que ancora o pé da página.
 *
 * O texto vive na área `comum` do catálogo de idiomas: este rodapé aparece em
 * TODA página pública, então ele é a superfície que mais depende de já estar
 * traduzida quando a tela abre (#532).
 */

/**
 * Um link do rodapé.
 *
 * `id` existe além do `label` porque o rótulo agora é texto TRADUZIDO, e texto
 * traduzido não serve de identidade: usado como `key` do React, ele remontaria
 * a lista inteira a cada troca de idioma, e qualquer decisão tomada em cima
 * dele passaria no teste (onde a interface está em português) e quebraria em
 * espanhol.
 */
type FooterLink = { id: string; label: string; href?: string; onClick?: () => void };

const Footer = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openReferral } = useReferral();
  const { t } = useTranslation('comum');

  // /inicio é um hub pós-login (dispatcher), não uma página de marketing —
  // o rodapé de "Produtos/Contato" fica deslocado e cria um vão em branco.
  if (location.pathname.startsWith('/inicio')) return null;

  // O rodapé lista o que a Smart Betting OFERECE — um por produto, não uma
  // cópia do menu. As sub-seções (oportunidades, jogos, relatório) já vivem
  // na faixa 2 do header.
  //
  // "NBA" e "Betinho" ficam fora do catálogo de propósito: são nome próprio,
  // iguais nos dois idiomas, e chave com o mesmo valor em todo idioma é convite
  // a alguém traduzi-la e quebrar a convenção (mesma razão do `NOME_DO_IDIOMA`
  // em src/i18n/idiomas.ts).
  const analises: FooterLink[] = [
    { id: 'futebol', label: t('rodape.links.futebol'), href: '/futebol' },
    { id: 'nba', label: 'NBA', href: '/home-nba' },
  ];

  const ferramentas: FooterLink[] = [
    { id: 'betinho', label: 'Betinho', href: '/betting-dashboard' },
    ...(SHOW_BOLAO_ENTRY_POINTS
      ? [{ id: 'bolao', label: t('rodape.links.bolao'), href: '/bolao' }]
      : []),
  ];

  // Conta e ajuda. "Planos e preços" e "Indique um amigo" vieram de Produtos:
  // não são o que a gente oferece, são coisas da conta do usuário.
  const suporte: FooterLink[] = [
    { id: 'planos', label: t('rodape.links.planos'), href: '/planos' },
    ...(SHOW_COMO_USAR_ENTRY_POINTS
      ? [{ id: 'como-usar', label: t('rodape.links.comoUsar'), href: '/como-usar' }]
      : []),
    { id: 'configuracoes', label: t('rodape.links.configuracoes'), href: '/settings' },
    { id: 'indicar', label: t('rodape.links.indicar'), onClick: openReferral },
    // WhatsApp, e não e-mail: é onde o time de fato responde, e é o mesmo
    // canal do ícone aqui embaixo. Duas portas com o mesmo nome levando a
    // lugares diferentes era o que existia antes.
    {
      id: 'falar-com-o-time',
      label: t('rodape.links.falarComOTime'),
      href: WHATSAPP_FALAR_COM_O_TIME,
    },
  ];

  const linkCls = 'text-[13px] text-white/70 hover:text-white transition-colors text-left';

  const renderLink = (l: FooterLink) => {
    if (l.onClick) {
      return (
        <button key={l.id} type="button" onClick={l.onClick} className={linkCls}>
          {l.label}
        </button>
      );
    }
    const novaAba = l.href != null && ehExterno(l.href);
    if (novaAba || l.href?.startsWith('mailto:')) {
      // Só o link externo sai em aba nova. No mailto o navegador entrega ao
      // cliente de e-mail sem navegar, então o target ali deixaria uma aba em
      // branco aberta para trás.
      return (
        <a
          key={l.id}
          href={l.href}
          target={novaAba ? '_blank' : undefined}
          rel={novaAba ? 'noopener noreferrer' : undefined}
          className={linkCls}
        >
          {l.label}
        </a>
      );
    }
    return (
      <button key={l.id} type="button" onClick={() => navigate(l.href!)} className={linkCls}>
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
    <footer aria-label={t('rodape.aria')} className="bg-forest text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-11 pb-9 grid gap-10 sm:grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr]">
        {/* Marca */}
        <div>
          <img src="/logo.png" alt="Smart Betting" className="h-[26px] w-auto" />
          <p className="text-[13px] leading-relaxed text-white/60 mt-4 max-w-[340px] text-pretty">
            {t('rodape.sobre')}
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
              href={WHATSAPP_FALAR_COM_O_TIME}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className={socialCls}
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <a
              href={`mailto:${EMAIL_DO_TIME}`}
              aria-label={t('rodape.social.email')}
              className={socialCls}
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>

        <Column title={t('rodape.colunas.analises')} links={analises} />
        <Column title={t('rodape.colunas.ferramentas')} links={ferramentas} />
        <Column title={t('rodape.colunas.suporte')} links={suporte} />
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
              {t('rodape.legal.termos')}
            </a>
          </div>
          <div className="flex items-center gap-2.5 py-3">
            {/* "+18" fica em código: é o mesmo em qualquer idioma. */}
            <span className="inline-flex items-center h-[22px] px-2 rounded-[5px] border border-white/25 text-white/70 text-[10px] font-bold tracking-[0.08em]">
              +18
            </span>
            <span className="text-[11.5px] text-white/45">
              {t('rodape.legal.aviso')}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
