import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import {
  BarChart3,
  Target,
  TrendingUp,
  Users,
  ChevronDown,
  Menu,
  X,
  FileText,
  Trophy
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import UserNav from './UserNav';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MainNavProps {
  className?: string;
}

export default function MainNav({ className }: MainNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const analysisItems = [
    { name: 'Home NBA', href: '/home-nba', icon: BarChart3 },
    { name: 'Oportunidades do Dia', href: '/oportunidades', icon: TrendingUp },
    { name: 'Jogos', href: '/home-games', icon: TrendingUp },
    { name: 'Relatório', href: '/report', icon: FileText },
  ];

  const betinhoModuleItems = [
    { name: 'Dashboard', href: '/betting-dashboard', icon: BarChart3 },
    { name: 'Apostas', href: '/bets', icon: Target },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const isBolaoActive = location.pathname.startsWith('/bolao');

  const activeModuleName = analysisItems.some((i) => isActive(i.href))
    ? 'Análises'
    : betinhoModuleItems.some((i) => isActive(i.href))
    ? 'Betinho'
    : isBolaoActive
    ? 'Bolão'
    : null;

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`bg-background border-b border-border sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/home-nba')}
              className="flex items-center space-x-2 hover:bg-transparent"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">Smartbetting</span>
            </Button>
          </div>

          {/* Desktop Center Module Dropdowns */}
          <div className="hidden md:flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <span>Análises</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>Módulo NBA</DropdownMenuLabel>
                {analysisItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer ${isActive(item.href) ? 'font-semibold' : ''}`}
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
                <Button variant="ghost" className="flex items-center gap-2">
                  <span>Betinho</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56">
                <DropdownMenuLabel>Módulo Betinho</DropdownMenuLabel>
                {betinhoModuleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`cursor-pointer ${isActive(item.href) ? 'font-semibold' : ''}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Bolão — destino único, sem dropdown */}
            <Button
              variant="ghost"
              onClick={() => handleNavigation('/bolao')}
              className={`flex items-center gap-2 ${isBolaoActive ? 'font-semibold text-foreground' : ''}`}
            >
              <Trophy className="w-4 h-4" />
              <span>Bolão</span>
            </Button>
          </div>

          {/* Right side - User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <UserNav />
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Entrar
                </Button>
                <Button
                  onClick={() => navigate('/planos')}
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  Assinar
                </Button>
              </>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {activeModuleName && !isMobileMenuOpen && (
                <span className="text-xs font-medium text-muted-foreground">
                  {activeModuleName}
                </span>
              )}
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-2 pt-3 pb-3 space-y-4">

              {/* Seção Análises */}
              <div>
                <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Análises
                </p>
                <div className="space-y-1">
                  {analysisItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.name}
                        variant={isActive(item.href) ? "default" : "ghost"}
                        onClick={() => handleNavigation(item.href)}
                        className={`w-full justify-start flex items-center space-x-3 ${
                          isActive(item.href)
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{item.name}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Divisor */}
              <div className="border-t border-border" />

              {/* Seção Betinho */}
              <div>
                <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Betinho
                </p>
                <div className="space-y-1">
                  {betinhoModuleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.name}
                        variant={isActive(item.href) ? "default" : "ghost"}
                        onClick={() => handleNavigation(item.href)}
                        className={`w-full justify-start flex items-center space-x-3 ${
                          isActive(item.href)
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium">{item.name}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Divisor */}
              <div className="border-t border-border" />

              {/* Seção Bolão */}
              <div>
                <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bolão
                </p>
                <div className="space-y-1">
                  <Button
                    variant={isBolaoActive ? "default" : "ghost"}
                    onClick={() => handleNavigation('/bolao')}
                    className={`w-full justify-start flex items-center space-x-3 ${
                      isBolaoActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Trophy className="w-4 h-4" />
                    <span className="font-medium">Bolão Copa 2026</span>
                  </Button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
