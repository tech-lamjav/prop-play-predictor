import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Calendar, Menu, X, LogIn, Zap, ChevronLeft, ChevronDown,
  Target, FileText, TrendingUp, Radar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NBAUserNav } from '@/components/nba-home/NBAUserNav';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';

interface NBAHomeHeaderProps {
  showBack?: boolean;
  backTo?: string;
  /** Título opcional exibido após "/" no breadcrumb (ex: nome do jogador) */
  title?: string;
}

/**
 * Header light do rebrand NBA. Espelho funcional do AnalyticsNav (dark/terminal):
 * mesmos dropdowns Análises/Betinho, mesmo UserNav, mesmo badge Premium,
 * mesmo menu mobile — apenas tema visual trocado pra light (canvas/ink/forest).
 */
export const NBAHomeNav: React.FC<NBAHomeHeaderProps> = ({ showBack = false, backTo, title }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const isActive = (path: string) => location.pathname === path;
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
    <>
      <a
        href="#main-content"
        className="theme-rebrand sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-forest focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Pular para o conteúdo principal
      </a>
      <nav
        aria-label="Navegação principal"
        className="theme-rebrand bg-white/85 supports-[backdrop-filter]:bg-white/70 backdrop-blur-md border-b border-line sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            {/* Left: logo + back + title */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/home-nba')}
                className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                aria-label="Smart Betting"
              >
                <img
                  src="/logo%20azul.png"
                  alt="Smartbetting"
                  className="h-8 w-auto mix-blend-multiply"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </button>
              {showBack && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => backTo ? navigate(backTo) : navigate(-1)}
                  className="text-ink-2 hover:text-ink hover:bg-ink-3/40 -ml-2 h-9"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  <span className="text-xs">Voltar</span>
                </Button>
              )}
              {title && (
                <div className="hidden sm:flex items-center">
                  <span className="text-line mx-2">/</span>
                  <span className="text-sm text-ink font-medium truncate max-w-[200px]">{title}</span>
                </div>
              )}
            </div>

            {/* Center: module dropdowns (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 px-4 h-9 text-ink-2 hover:text-ink hover:bg-ink-3/40"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide">Análises</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="w-56 bg-white text-ink border border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]"
                >
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-ink-2">Módulo NBA</DropdownMenuLabel>
                  {analysisItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        onClick={() => handleNavigation(item.href)}
                        className={`cursor-pointer focus:bg-forest-tint focus:text-forest ${active ? 'text-forest font-semibold bg-forest-tint/50' : 'text-ink'}`}
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
                    className="flex items-center gap-2 px-4 h-9 text-ink-2 hover:text-ink hover:bg-ink-3/40"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide">Betinho</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="center"
                  className="w-56 bg-white text-ink border border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]"
                >
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-ink-2">Módulo Betinho</DropdownMenuLabel>
                  {betinhoModuleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <DropdownMenuItem
                        key={item.href}
                        onClick={() => handleNavigation(item.href)}
                        className={`cursor-pointer focus:bg-forest-tint focus:text-forest ${active ? 'text-forest font-semibold bg-forest-tint/50' : 'text-ink'}`}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {item.name}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right: premium + UserNav | Entrar/Assinar */}
            <div className="flex items-center gap-2">
              {user && isPremium && (
                <div className="hidden sm:flex items-center gap-1 bg-amber-100 border border-amber-200 px-2 py-1 rounded">
                  <Zap className="w-3 h-3 text-amber-700" />
                  <span className="text-[10px] text-amber-700 font-bold">PREMIUM</span>
                </div>
              )}

              {user ? (
                <NBAUserNav />
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/auth')}
                    className="text-ink-2 hover:text-ink text-xs h-8"
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    Entrar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate('/paywall-platform')}
                    className="bg-forest hover:bg-forest-soft text-white font-bold text-xs h-8"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Assinar
                  </Button>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                type="button"
                aria-label="Abrir menu"
                aria-expanded={isMobileMenuOpen}
                className="md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-ink-3/40 transition-colors text-ink-2 hover:text-ink"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {activeModuleName && !isMobileMenuOpen && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {activeModuleName}
                  </span>
                )}
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mobile menu panel */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-line py-3">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-2">Análises</p>
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
                              ? 'bg-forest-tint text-forest'
                              : 'text-ink-2 hover:text-ink hover:bg-ink-3/40'
                          }`}
                        >
                          <Icon className="w-4 h-4 mr-3" />
                          <span className="text-sm">{item.name}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-line" />

                <div>
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-2">Betinho</p>
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
                              ? 'bg-forest-tint text-forest'
                              : 'text-ink-2 hover:text-ink hover:bg-ink-3/40'
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
    </>
  );
};
