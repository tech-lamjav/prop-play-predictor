import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  BarChart3,
  Calendar,
  Users,
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
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import UserNav from './UserNav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Visual variant da nav.
 *
 * - `terminal` (default): tema escuro original — usado em todas as páginas
 *   NBA/Análises/Bets e em rotas que ainda não passaram pelo rebrand.
 * - `rebrand`: tema claro (canvas + forest + amber + ink) — usado nas telas
 *   que já adotaram o rebrand (bolão, Betinho LP variante).
 *
 * Default é terminal pra zero regressão: páginas existentes não precisam
 * mudar nada. Telas novas/rebranded passam `variant="rebrand"` explicitamente.
 */
type NavVariant = 'terminal' | 'rebrand';

interface NavTheme {
  /** Background da barra principal */
  bg: string;
  /** Borda inferior (sticky) e divisores internos */
  border: string;
  /** Cor de texto base dos links/labels */
  text: string;
  /** Cor de texto para item ativo */
  textAccent: string;
  /** Composição "text + hover bg + hover text" pra botões ghost da nav */
  ghostBtn: string;
  /** Só o hover bg do ghostBtn — pra quando o item está ativo (cor do texto vem de textAccent) */
  ghostHoverBg: string;
  /** "text + hover text" sem bg — pra links/CTAs minimalistas (ex: "Entrar") */
  textHover: string;
  /** Cor do separador "/" entre logo e title */
  slash: string;
  /** Background do DropdownMenuContent */
  dropdownBg: string;
  dropdownBorder: string;
  dropdownText: string;
  /** Composição "focus bg + focus text" pros DropdownMenuItem */
  dropdownItemFocus: string;
  /** Background tinted pro item ativo (mobile drawer) */
  activeBg: string;
  /** Badge PREMIUM (bg, border, ícone, texto) */
  premiumBg: string;
  premiumBorder: string;
  premiumIcon: string;
  premiumText: string;
  /** CTA "Assinar" pra quem ainda não tem premium */
  ctaBg: string;
  ctaText: string;
}

/**
 * IMPORTANTE: Tailwind faz tree-shaking via string-match estático nos source
 * files. Classes precisam aparecer LITERALMENTE em algum arquivo .tsx pro CSS
 * ser gerado. Por isso o tema é uma matriz de strings completas (não composições
 * dinâmicas tipo `hover:${...}`).
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
    dropdownBg: 'bg-white',
    dropdownBorder: 'border-line',
    dropdownText: 'text-ink',
    dropdownItemFocus: 'focus:bg-canvas-2 focus:text-forest',
    activeBg: 'bg-forest/10',
    premiumBg: 'bg-amber/10',
    premiumBorder: 'border-amber/30',
    premiumIcon: 'text-amber-2',
    premiumText: 'text-amber-2',
    ctaBg: 'bg-amber hover:bg-amber/90',
    ctaText: 'text-white',
  },
};

interface AnalyticsNavProps {
  className?: string;
  showBack?: boolean;
  backTo?: string;
  title?: string;
  /** Visual variant. Default `terminal` preserva o comportamento histórico. */
  variant?: NavVariant;
}

export default function AnalyticsNav({
  className,
  showBack,
  backTo,
  title,
  variant = 'terminal',
}: AnalyticsNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = themes[variant];

  const analysisItems = [
    { name: 'Hoje', href: '/home-nba', icon: BarChart3 },
    { name: 'Oportunidades', href: '/oportunidades', icon: TrendingUp },
    { name: 'Análise 360', href: '/analise-360', icon: Radar },
    { name: 'Jogos', href: '/home-games', icon: Calendar },
    { name: 'Relatório', href: '/report', icon: FileText },
  ];

  const betinhoModuleItems = [
    { name: 'Apostas', href: '/bets', icon: Target },
    { name: 'Dashboard', href: '/betting-dashboard', icon: BarChart3 },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const activeModuleName = analysisItems.some((i) => isActive(i.href))
    ? 'Análises'
    : betinhoModuleItems.some((i) => isActive(i.href))
    ? 'Betinho'
    : null;

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`${t.bg} border-b ${t.border} sticky top-0 z-50 ${className ?? ''}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* Left side - Logo or Back button */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/home-nba')}
            >
              {/*
                A logo PNG é uma versão clara (texto branco + ícone teal),
                desenhada pro header escuro. No variant rebrand (fundo claro)
                aplicamos `invert hue-rotate-180` pra escurecer preservando
                aproximadamente a cor do ícone. Solução in-place enquanto não
                há um asset logo-dark.png dedicado.
              */}
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
                onClick={() => backTo ? navigate(backTo) : navigate(-1)}
                className={`${t.ghostBtn} -ml-2`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="text-xs">Voltar</span>
              </Button>
            )}

            {/* Title (for dashboard pages) */}
            {title && (
              <div className="hidden sm:flex items-center">
                <span className={`${t.slash} mx-2`}>/</span>
                <span className={`text-sm ${t.text} font-medium truncate max-w-[200px]`}>{title}</span>
              </div>
            )}
          </div>

          {/* Center - Desktop Module Dropdowns */}
          <div className="hidden md:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center gap-2 px-4 h-9 ${t.ghostBtn}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Análises</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className={`w-56 ${t.dropdownBg} ${t.dropdownBorder} ${t.dropdownText}`}
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide opacity-70">Módulo NBA</DropdownMenuLabel>
                {analysisItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer ${t.dropdownItemFocus} ${
                        isActive(item.href) ? t.textAccent : ''
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex items-center gap-2 px-4 h-9 ${t.ghostBtn}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Betinho</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className={`w-56 ${t.dropdownBg} ${t.dropdownBorder} ${t.dropdownText}`}
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide opacity-70">Módulo Betinho</DropdownMenuLabel>
                {betinhoModuleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer ${t.dropdownItemFocus} ${
                        isActive(item.href) ? t.textAccent : ''
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/bolao')}
              className={`flex items-center gap-2 px-4 h-9 ${
                location.pathname.startsWith('/bolao')
                  ? `${t.textAccent} ${t.ghostHoverBg}`
                  : t.ghostBtn
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wide">Bolão Copa 2026</span>
            </Button>
          </div>

          {/* Right side - Auth & Premium */}
          <div className="flex items-center gap-2">
            {/* Premium Badge */}
            {user && isPremium && (
              <div className={`hidden sm:flex items-center gap-1 ${t.premiumBg} border ${t.premiumBorder} px-2 py-1 rounded`}>
                <Zap className={`w-3 h-3 ${t.premiumIcon}`} />
                <span className={`text-[10px] ${t.premiumText} font-bold`}>PREMIUM</span>
              </div>
            )}

            {/* User Menu or Auth Buttons */}
            {user ? (
              <UserNav />
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className={`${t.textHover} text-xs h-8`}
                >
                  <LogIn className="w-3 h-3 mr-1" />
                  Entrar
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/paywall-platform')}
                  className={`${t.ctaBg} ${t.ctaText} font-bold text-xs h-8`}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Assinar
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className={`md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors ${t.ghostBtn}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {activeModuleName && !isMobileMenuOpen && (
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {activeModuleName}
                </span>
              )}
              {isMobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden border-t ${t.border} py-3`}>
            <div className="flex flex-col gap-4">

              {/* Seção Análises */}
              <div>
                <p className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider ${t.text} opacity-50`}>
                  Análises
                </p>
                <div className="flex flex-col gap-1">
                  {analysisItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Button
                        key={item.name}
                        variant="ghost"
                        onClick={() => handleNavigation(item.href)}
                        className={`w-full justify-start h-10 ${
                          active
                            ? `${t.activeBg} ${t.textAccent}`
                            : t.ghostBtn
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        <span className="text-sm">{item.name}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Divisor */}
              <div className={`border-t ${t.border}`} />

              {/* Bolão Copa */}
              <div>
                <Button
                  variant="ghost"
                  onClick={() => handleNavigation('/bolao')}
                  className={`w-full justify-start h-10 ${
                    location.pathname.startsWith('/bolao')
                      ? `${t.activeBg} ${t.textAccent}`
                      : t.ghostBtn
                  }`}
                >
                  <Trophy className="w-4 h-4 mr-3" />
                  <span className="text-sm">Bolão Copa 2026</span>
                </Button>
              </div>

              {/* Divisor */}
              <div className={`border-t ${t.border}`} />

              {/* Seção Betinho */}
              <div>
                <p className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider ${t.text} opacity-50`}>
                  Betinho
                </p>
                <div className="flex flex-col gap-1">
                  {betinhoModuleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Button
                        key={item.name}
                        variant="ghost"
                        onClick={() => handleNavigation(item.href)}
                        className={`w-full justify-start h-10 ${
                          active
                            ? `${t.activeBg} ${t.textAccent}`
                            : t.ghostBtn
                        }`}
                      >
                        <Icon className="w-4 h-4 mr-3" />
                        <span className="text-sm">{item.name}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
