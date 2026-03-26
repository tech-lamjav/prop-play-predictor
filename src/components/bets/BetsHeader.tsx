import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { telegramBotUrl } from '@/config/environment';
import { Button } from '../ui/button';
import {
  BarChart3,
  Calendar,
  Users,
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
  onShareClick?: () => void;
  onReferralClick?: () => void;
  showUnitsView?: boolean;
  onShowUnitsViewChange?: (checked: boolean) => void;
  onUnitConfigClick?: () => void;
  unitsConfigured?: boolean;
}

export const BetsHeader: React.FC<BetsHeaderProps> = ({
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
    { name: 'Home NBA', href: '/home-players', icon: BarChart3 },
    { name: 'Jogos', href: '/home-games', icon: Calendar },
    { name: 'Jogadores', href: '/nba-players', icon: Users },
    { name: 'Relatório', href: '/report', icon: FileText },
  ];

  const betinhoModuleItems = [
    { name: 'Dashboard', href: '/betting-dashboard', icon: BarChart3 },
    { name: 'Apostas', href: '/bets', icon: Target },
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
    <nav className="bg-terminal-black border-b border-terminal-border-subtle sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">

          {/* Left - Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/home-players')}
          >
            <div className="w-8 h-8 bg-terminal-blue/20 border border-terminal-blue/50 rounded flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-terminal-blue" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-terminal-blue tracking-wide">Smartbetting</span>
            </div>
          </div>

          {/* Center - Desktop dropdowns */}
          <div className="hidden md:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 px-4 h-9 text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Análises</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-56 bg-terminal-dark-gray border-terminal-border-subtle text-terminal-text"
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide opacity-70">Módulo NBA</DropdownMenuLabel>
                {analysisItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer focus:bg-terminal-gray/40 focus:text-terminal-blue ${
                        isActive(item.href) ? 'text-terminal-blue' : ''
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
                  className="flex items-center gap-2 px-4 h-9 text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Betinho</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="center"
                className="w-56 bg-terminal-dark-gray border-terminal-border-subtle text-terminal-text"
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide opacity-70">Módulo Betinho</DropdownMenuLabel>
                {betinhoModuleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer focus:bg-terminal-gray/40 focus:text-terminal-blue ${
                        isActive(item.href) ? 'text-terminal-blue' : ''
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
                <Label htmlFor="bets-header-units" className="hidden sm:inline text-xs whitespace-nowrap text-terminal-text opacity-80 cursor-pointer">
                  Unidades
                </Label>
                <Switch
                  id="bets-header-units"
                  checked={showUnitsView}
                  onCheckedChange={onShowUnitsViewChange}
                  disabled={!unitsConfigured}
                  className="scale-75 sm:scale-90 md:scale-100 origin-right data-[state=unchecked]:bg-white/80 data-[state=checked]:bg-[var(--terminal-green)]"
                />
              </div>
            )}

            {/* Units Config */}
            {onUnitConfigClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onUnitConfigClick}
                className="flex items-center gap-1.5 h-9 px-2 md:px-3 text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray"
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
                className="flex items-center gap-1.5 h-9 px-2 md:px-3 text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray"
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
                  className="h-9 w-9 rounded-full flex items-center justify-center text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray"
                >
                  <UserIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 bg-terminal-dark-gray border-terminal-border text-terminal-text"
                align="end"
              >
                {user?.email && (
                  <>
                    <div className="px-2 py-1.5 text-xs opacity-70 border-b border-terminal-border-subtle">
                      <p className="truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator className="bg-terminal-border-subtle" />
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => navigate('/settings')}
                  className="text-terminal-text hover:bg-terminal-gray focus:bg-terminal-gray cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open(telegramBotUrl, '_blank')}
                  className="text-terminal-text hover:bg-terminal-gray focus:bg-terminal-gray cursor-pointer"
                >
                  <Send className="mr-2 h-4 w-4" />
                  <span>Abrir Telegram</span>
                </DropdownMenuItem>
                {onReferralClick && (
                  <DropdownMenuItem
                    onClick={onReferralClick}
                    className="text-terminal-text hover:bg-terminal-gray focus:bg-terminal-gray cursor-pointer"
                  >
                    <UsersIcon className="mr-2 h-4 w-4" />
                    <span>Indique um amigo</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-terminal-border-subtle" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-terminal-red hover:bg-terminal-red/10 focus:bg-terminal-red/10 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu button */}
            <button
              className="md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-terminal-dark-gray transition-colors text-terminal-text hover:text-terminal-blue"
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
          <div className="md:hidden border-t border-terminal-border-subtle py-3">
            <div className="flex flex-col gap-4">

              {/* Seção Análises */}
              <div>
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-terminal-text opacity-50">
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
                            ? 'bg-terminal-blue/10 text-terminal-blue'
                            : 'text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray'
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
              <div className="border-t border-terminal-border-subtle" />

              {/* Seção Betinho */}
              <div>
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-terminal-text opacity-50">
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
                            ? 'bg-terminal-blue/10 text-terminal-blue'
                            : 'text-terminal-text hover:text-terminal-blue hover:bg-terminal-dark-gray'
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
};
