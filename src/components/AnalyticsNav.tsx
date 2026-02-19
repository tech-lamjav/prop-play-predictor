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
  Target
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

interface AnalyticsNavProps {
  className?: string;
  showBack?: boolean;
  backTo?: string;
  title?: string;
}

export default function AnalyticsNav({ className, showBack, backTo, title }: AnalyticsNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const analysisItems = [
    { name: 'Home NBA', href: '/home-players', icon: BarChart3 },
    { name: 'Jogos', href: '/home-games', icon: Calendar },
    { name: 'Jogadores', href: '/nba-players', icon: Users },
  ];

  const betinhoModuleItems = [
    { name: 'Dashboard', href: '/betting-dashboard', icon: BarChart3 },
    { name: 'Apostas', href: '/bets', icon: Target },
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
    <nav className={`bg-terminal-black border-b border-terminal-border-subtle sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          {/* Left side - Logo or Back button */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo || '/home-players')}
                className="text-terminal-text hover:text-terminal-green hover:bg-terminal-dark-gray -ml-2"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span className="text-xs">Voltar</span>
              </Button>
            ) : (
              <div 
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/home-players')}
              >
                <div className="w-8 h-8 bg-terminal-green/20 border border-terminal-green/50 rounded flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-terminal-green" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-sm font-bold text-terminal-green tracking-wide">Smartbetting</span>
                </div>
              </div>
            )}

            {/* Title (for dashboard pages) */}
            {title && (
              <div className="hidden sm:flex items-center">
                <span className="text-terminal-border-subtle mx-2">/</span>
                <span className="text-sm text-terminal-text font-medium truncate max-w-[200px]">{title}</span>
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
                  className="flex items-center gap-2 px-4 h-9 text-terminal-text hover:text-terminal-green hover:bg-terminal-dark-gray"
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
                      className={`cursor-pointer focus:bg-terminal-gray/40 focus:text-terminal-green ${
                        isActive(item.href) ? 'text-terminal-green' : ''
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
                  className="flex items-center gap-2 px-4 h-9 text-terminal-text hover:text-terminal-green hover:bg-terminal-dark-gray"
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
                      className={`cursor-pointer focus:bg-terminal-gray/40 focus:text-terminal-green ${
                        isActive(item.href) ? 'text-terminal-green' : ''
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

          {/* Right side - Auth & Premium */}
          <div className="flex items-center gap-2">
            {/* Premium Badge */}
            {user && isPremium && (
              <div className="hidden sm:flex items-center gap-1 bg-terminal-green/10 border border-terminal-green/30 px-2 py-1 rounded">
                <Zap className="w-3 h-3 text-terminal-green" />
                <span className="text-[10px] text-terminal-green font-bold">PREMIUM</span>
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
                  className="text-terminal-text hover:text-terminal-green text-xs h-8"
                >
                  <LogIn className="w-3 h-3 mr-1" />
                  Entrar
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/paywall-platform')}
                  className="bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold text-xs h-8"
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Assinar
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-terminal-dark-gray transition-colors text-terminal-text hover:text-terminal-green"
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
                            ? 'bg-terminal-green/10 text-terminal-green'
                            : 'text-terminal-text hover:text-terminal-green hover:bg-terminal-dark-gray'
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
                            ? 'bg-terminal-green/10 text-terminal-green'
                            : 'text-terminal-text hover:text-terminal-green hover:bg-terminal-dark-gray'
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
