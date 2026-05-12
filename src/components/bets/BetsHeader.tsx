import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { telegramBotUrl } from '@/config/environment';
import { Button } from '../ui/button';
import {
  BarChart3,
  Calendar,
  Radar,
  TrendingUp,
  ChevronLeft,
  Menu,
  X,
  ChevronDown,
  Target,
  FileText,
  Share2,
  Settings,
  LogOut,
  Send,
  Users as UsersIcon,
  UserIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface BetsHeaderProps {
  title?: string;
  showBack?: boolean;
  onShareClick?: () => void;
  onReferralClick?: () => void;
  showUnitsView?: boolean;
  onShowUnitsViewChange?: (checked: boolean) => void;
  onUnitConfigClick?: () => void;
  unitsConfigured?: boolean;
}

export const BetsHeader: React.FC<BetsHeaderProps> = ({
  showBack,
  onShareClick,
  onReferralClick,
  showUnitsView = false,
  onShowUnitsViewChange,
  onUnitConfigClick,
  unitsConfigured = true,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <>
    <a
      href="#main-content"
      className="theme-rebrand sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-forest focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none"
    >
      Pular para o conteúdo principal
    </a>
    <nav aria-label="Navegação principal" className="theme-rebrand bg-white/85 supports-[backdrop-filter]:bg-white/70 backdrop-blur-md border-b border-line sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">

          {/* Left - Logo + Back */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/home-nba')}
            >
              <img src="/logo-azul.png" alt="Smartbetting" className="h-8 w-auto" />
            </div>
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="text-ink-2 hover:text-ink hover:bg-ink-3/60 -ml-2"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="text-xs">Voltar</span>
              </Button>
            )}
          </div>

          {/* Center - Desktop dropdowns */}
          <div className="hidden md:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 px-4 h-9 text-ink-2 hover:text-ink hover:bg-ink-3/60"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Análises</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="theme-rebrand w-56 bg-white border-line text-ink"
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-ink-2">Módulo NBA</DropdownMenuLabel>
                {analysisItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer focus:bg-forest-tint focus:text-forest ${
                        isActive(item.href) ? 'text-forest font-semibold' : ''
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
                  className="flex items-center gap-2 px-4 h-9 text-ink-2 hover:text-ink hover:bg-ink-3/60"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Betinho</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="theme-rebrand w-56 bg-white border-line text-ink"
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-ink-2">Módulo Betinho</DropdownMenuLabel>
                {betinhoModuleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer focus:bg-forest-tint focus:text-forest ${
                        isActive(item.href) ? 'text-forest font-semibold' : ''
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Units Toggle */}
            {onShowUnitsViewChange !== undefined && (
              <div className="flex items-center gap-1 md:gap-2">
                <Label htmlFor="bets-header-units" className="hidden sm:inline text-xs whitespace-nowrap text-ink-2 cursor-pointer">
                  Unidades
                </Label>
                <Switch
                  id="bets-header-units"
                  checked={showUnitsView}
                  onCheckedChange={onShowUnitsViewChange}
                  disabled={!unitsConfigured}
                  className="scale-75 sm:scale-90 md:scale-100 origin-right data-[state=unchecked]:bg-ink-3 data-[state=checked]:bg-forest"
                />
              </div>
            )}

            {/* Units Config */}
            {onUnitConfigClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUnitConfigClick}
                className="flex items-center gap-1.5 h-9 px-2 md:px-3 text-ink-2 hover:text-ink hover:bg-ink-3/60"
                title="Configurar unidades"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wide">Unidades</span>
              </Button>
            )}

            {/* Share */}
            {onShareClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onShareClick}
                className="flex items-center gap-1.5 h-9 px-2 md:px-3 text-ink-2 hover:text-ink hover:bg-ink-3/60"
                title="Compartilhar"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wide">Compartilhar</span>
              </Button>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 rounded-full flex items-center justify-center bg-forest text-white hover:bg-forest-soft hover:text-white"
                  aria-label="Menu da conta"
                >
                  <UserIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="theme-rebrand w-48 bg-white border-line text-ink"
                align="end"
              >
                {user?.email && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-ink-2 border-b border-line">
                      <p className="truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator className="bg-line" />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => navigate('/settings')}
                  className="text-ink hover:bg-ink-3/60 focus:bg-ink-3/60 cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open(telegramBotUrl, '_blank')}
                  className="text-ink hover:bg-ink-3/60 focus:bg-ink-3/60 cursor-pointer"
                >
                  <Send className="mr-2 h-4 w-4" />
                  <span>Abrir Telegram</span>
                </DropdownMenuItem>
                {onReferralClick && (
                  <DropdownMenuItem
                    onClick={onReferralClick}
                    className="text-ink hover:bg-ink-3/60 focus:bg-ink-3/60 cursor-pointer"
                  >
                    <UsersIcon className="mr-2 h-4 w-4" />
                    <span>Indique um amigo</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-line" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-status-danger hover:bg-status-danger/10 focus:bg-status-danger/10 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu button */}
            <button
              className="md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-ink-3/60 transition-colors text-ink-2 hover:text-ink"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {activeModuleName && !isMobileMenuOpen && (
                <span className="text-[10px] font-semibold uppercase tracking-wide">
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
          <div className="md:hidden border-t border-line py-3">
            <div className="flex flex-col gap-4">

              {/* Seção Análises */}
              <div>
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
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
                            ? 'bg-forest-tint text-forest'
                            : 'text-ink-2 hover:text-ink hover:bg-ink-3/60'
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
              <div className="border-t border-line" />

              {/* Seção Betinho */}
              <div>
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-2">
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
                            ? 'bg-forest-tint text-forest'
                            : 'text-ink-2 hover:text-ink hover:bg-ink-3/60'
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
