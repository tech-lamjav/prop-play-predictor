import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  BarChart3,
  Calendar,
  Menu,
  X,
  LogIn,
  Zap,
  ChevronLeft,
  ChevronDown,
  Target,
  FileText,
  TrendingUp,
  Radar,
  Trophy,
  Goal,
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import UserNav from './UserNav';
import { FutebolTrialChip } from './futebol/FutebolGate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Flag temporária pra esconder o botão "Bolão Copa 2026" da nav.
 * Pra liberar: setar pra `true`.
 */
const SHOW_BOLAO_NAV_ITEM = true;

/**
 * Visual variant da nav.
 * - `terminal` (default): tema escuro original.
 * - `rebrand`: tema claro (canvas + forest + amber + ink).
 */
type NavVariant = 'terminal' | 'rebrand';

interface NavTheme {
  bg: string;
  border: string;
  text: string;
  textAccent: string;
  ghostBtn: string;
  ghostHoverBg: string;
  textHover: string;
  slash: string;
  dropdownBg: string;
  dropdownBorder: string;
  dropdownText: string;
  dropdownItemFocus: string;
  /** Background do "chip" de ícone dentro dos itens de dropdown/mobile */
  chipBg: string;
  activeBg: string;
  premiumBg: string;
  premiumBorder: string;
  premiumIcon: string;
  premiumText: string;
  ctaBg: string;
  ctaText: string;
}

/**
 * Classes precisam aparecer LITERALMENTE (Tailwind tree-shaking). Por isso o
 * tema é uma matriz de strings completas, não composições dinâmicas.
 */
const themes: Record<NavVariant, NavTheme> = {
  terminal: {
    bg: 'bg-terminal-black',
    border: 'border-terminal-border-subtle',
    text: 'text-terminal-text',
    textAccent: 'text-terminal-blue',
    ghostBtn: 'text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray',
    ghostHoverBg: 'hover:bg-terminal-dark-gray',
    textHover: 'text-terminal-text hover:text-terminal-blue',
    slash: 'text-terminal-border-subtle',
    dropdownBg: 'bg-terminal-dark-gray',
    dropdownBorder: 'border-terminal-border-subtle',
    dropdownText: 'text-terminal-text',
    dropdownItemFocus: 'focus:bg-terminal-gray/40 focus:text-terminal-blue',
    chipBg: 'bg-terminal-gray/40',
    activeBg: 'bg-terminal-blue/10',
    premiumBg: 'bg-terminal-blue/10',
    premiumBorder: 'border-terminal-blue/30',
    premiumIcon: 'text-terminal-blue',
    premiumText: 'text-terminal-blue',
    ctaBg: 'bg-terminal-green hover:bg-terminal-green/80',
    ctaText: 'text-terminal-black',
  },
  rebrand: {
    bg: 'bg-white',
    border: 'border-line',
    text: 'text-ink',
    textAccent: 'text-forest',
    ghostBtn: 'text-ink hover:text-forest hover:bg-canvas-2',
    ghostHoverBg: 'hover:bg-canvas-2',
    textHover: 'text-ink hover:text-forest',
    slash: 'text-ink-3',
    dropdownBg: 'theme-bolao bg-white',
    dropdownBorder: 'border-line',
    dropdownText: 'text-ink',
    dropdownItemFocus: 'focus:bg-canvas-2 focus:text-forest',
    chipBg: 'bg-canvas-2',
    activeBg: 'bg-forest/10',
    premiumBg: 'bg-amber/10',
    premiumBorder: 'border-amber/30',
    premiumIcon: 'text-amber-2',
    premiumText: 'text-amber-2',
    ctaBg: 'bg-amber hover:bg-amber/90',
    ctaText: 'text-white',
  },
};

interface NavItem {
  name: string;
  href: string;
  icon: typeof BarChart3;
  desc: string;
}

interface AnalyticsNavProps {
  className?: string;
  showBack?: boolean;
  backTo?: string;
  title?: string;
  variant?: NavVariant;
}

export default function AnalyticsNav({
  className,
  showBack,
  backTo,
  title,
  variant = 'rebrand',
}: AnalyticsNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = themes[variant];

  const nbaItems: NavItem[] = [
    { name: 'Hoje', href: '/home-nba', icon: BarChart3, desc: 'Resumo do dia' },
    { name: 'Oportunidades', href: '/oportunidades', icon: TrendingUp, desc: 'Picks por valor' },
    { name: 'Análise 360', href: '/analise-360', icon: Radar, desc: 'Impacto de lesões' },
    { name: 'Jogos', href: '/home-games', icon: Calendar, desc: 'Jogos e matchups' },
    { name: 'Relatório', href: '/report', icon: FileText, desc: 'Histórico e ROI' },
  ];

  const futebolItems: NavItem[] = [
    { name: 'Hoje', href: '/futebol', icon: Calendar, desc: 'Painel do dia' },
    { name: 'Oportunidades', href: '/futebol/oportunidades', icon: Zap, desc: 'Valor (+EV) do dia' },
    { name: 'Jogos', href: '/futebol/jogos', icon: Goal, desc: 'Rodadas, tabela e artilheiros' },
  ];

  const betinhoItems: NavItem[] = [
    { name: 'Apostas', href: '/bets', icon: Target, desc: 'Suas apostas' },
    { name: 'Dashboard', href: '/betting-dashboard', icon: BarChart3, desc: 'Banca e desempenho' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const nbaActive = nbaItems.some((i) => isActive(i.href));
  const futebolActive = location.pathname.startsWith('/futebol');
  const betinhoActive = betinhoItems.some((i) => isActive(i.href));
  const bolaoActive = location.pathname.startsWith('/bolao');

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsMobileMenuOpen(false);
  };

  // Acordeão mobile: abre o módulo da rota atual por padrão
  const initialMod = futebolActive ? 'futebol' : bolaoActive ? 'bolao' : betinhoActive ? 'betinho' : 'nba';
  const [openMod, setOpenMod] = useState<string | null>(initialMod);

  // ── Dropdown desktop (item rico: chip + título + descrição) ──
  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <DropdownMenuItem
          key={item.href}
          onClick={() => handleNavigation(item.href)}
          className={`cursor-pointer gap-3 py-2 ${t.dropdownItemFocus} ${active ? t.textAccent : ''}`}
        >
          <span className={`w-8 h-8 rounded-md grid place-items-center shrink-0 ${t.chipBg}`}>
            <Icon className="w-4 h-4" />
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium leading-tight">{item.name}</span>
            <span className="text-[11px] opacity-60 leading-tight truncate">{item.desc}</span>
          </div>
        </DropdownMenuItem>
      );
    });

  const moduleTriggerCls = (active: boolean) =>
    `flex items-center gap-2 px-4 h-9 ${active ? `${t.textAccent} ${t.ghostHoverBg}` : t.ghostBtn}`;

  // ── Seção mobile (acordeão) ──
  const MobileSection = ({ id, label, items }: { id: string; label: string; items: NavItem[] }) => {
    const open = openMod === id;
    return (
      <div>
        <button
          onClick={() => setOpenMod(open ? null : id)}
          className={`w-full flex items-center justify-between px-3 h-10 rounded ${t.ghostBtn}`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{label}</span>
          <ChevronDown className={`w-4 h-4 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="flex flex-col gap-1 mt-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  onClick={() => handleNavigation(item.href)}
                  className={`w-full justify-start h-10 pl-3 ${active ? `${t.activeBg} ${t.textAccent}` : t.ghostBtn}`}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  <span className="text-sm">{item.name}</span>
                </Button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={`${t.bg} border-b ${t.border} sticky top-0 z-50 ${className ?? ''}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* Left - Logo / Back / Title */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(user ? '/inicio' : '/')}
            >
              <img
                src="/logo.png"
                alt="Smartbetting"
                className={`h-8 w-auto ${variant === 'rebrand' ? 'invert hue-rotate-180' : ''}`}
              />
            </div>
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
                className={`${t.ghostBtn} -ml-2`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="text-xs">Voltar</span>
              </Button>
            )}
            {title && (
              <div className="hidden sm:flex items-center">
                <span className={`${t.slash} mx-2`}>/</span>
                <span className={`text-sm ${t.text} font-medium truncate max-w-[200px]`}>{title}</span>
              </div>
            )}
          </div>

          {/* Center - Dropdowns por produto */}
          <div className="hidden md:flex items-center gap-1">
            {/* NBA */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={moduleTriggerCls(nbaActive)}>
                  <span className="text-xs font-semibold uppercase tracking-wide">NBA</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className={`w-64 ${t.dropdownBg} ${t.dropdownBorder} ${t.dropdownText}`}>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide opacity-70">Plataforma NBA</DropdownMenuLabel>
                {renderItems(nbaItems)}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Futebol */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={moduleTriggerCls(futebolActive)}>
                  <span className="text-xs font-semibold uppercase tracking-wide">Futebol</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className={`w-64 ${t.dropdownBg} ${t.dropdownBorder} ${t.dropdownText}`}>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide opacity-70">Módulo Futebol</DropdownMenuLabel>
                {renderItems(futebolItems)}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Betinho */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={moduleTriggerCls(betinhoActive)}>
                  <span className="text-xs font-semibold uppercase tracking-wide">Betinho</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className={`w-64 ${t.dropdownBg} ${t.dropdownBorder} ${t.dropdownText}`}>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide opacity-70">Módulo Betinho</DropdownMenuLabel>
                {renderItems(betinhoItems)}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Bolão (produto sem sub-seções) */}
            {SHOW_BOLAO_NAV_ITEM && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/bolao')}
                className={moduleTriggerCls(bolaoActive)}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">Bolão Copa 2026</span>
              </Button>
            )}
          </div>

          {/* Right - Auth & Premium */}
          <div className="flex items-center gap-2">
            {futebolActive && <FutebolTrialChip />}
            {user && isPremium && (
              <div className={`hidden sm:flex items-center gap-1 ${t.premiumBg} border ${t.premiumBorder} px-2 py-1 rounded`}>
                <Zap className={`w-3 h-3 ${t.premiumIcon}`} />
                <span className={`text-[10px] ${t.premiumText} font-bold`}>PREMIUM</span>
              </div>
            )}

            {user ? (
              <UserNav variant={variant} />
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className={`${t.textHover} text-xs h-8`}>
                  <LogIn className="w-3 h-3 mr-1" />
                  Entrar
                </Button>
                <Button size="sm" onClick={() => navigate('/planos')} className={`${t.ctaBg} ${t.ctaText} font-bold text-xs h-8`}>
                  <Zap className="w-3 h-3 mr-1" />
                  Assinar
                </Button>
              </div>
            )}

            <button
              className={`md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${t.ghostBtn}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu (acordeão por produto) */}
        {isMobileMenuOpen && (
          <div className={`md:hidden border-t ${t.border} py-3`}>
            <div className="flex flex-col gap-2">
              <MobileSection id="nba" label="NBA" items={nbaItems} />
              <div className={`border-t ${t.border}`} />
              <MobileSection id="futebol" label="Futebol" items={futebolItems} />
              <div className={`border-t ${t.border}`} />
              <MobileSection id="betinho" label="Betinho" items={betinhoItems} />
              {SHOW_BOLAO_NAV_ITEM && (
                <>
                  <div className={`border-t ${t.border}`} />
                  <Button
                    variant="ghost"
                    onClick={() => handleNavigation('/bolao')}
                    className={`w-full justify-start h-10 ${bolaoActive ? `${t.activeBg} ${t.textAccent}` : t.ghostBtn}`}
                  >
                    <Trophy className="w-4 h-4 mr-3" />
                    <span className="text-sm">Bolão Copa 2026</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
