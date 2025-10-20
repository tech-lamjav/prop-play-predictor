import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Users, 
  Settings,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useWhatsAppSync } from '../hooks/use-whatsapp-sync';
import UserNav from './UserNav';
import { useState } from 'react';

interface MainNavProps {
  className?: string;
}

export default function MainNav({ className }: MainNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSynced } = useWhatsAppSync(user?.id || '');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    // Temporarily removed: Dashboard, Análises, Jogadores
    // Will be added back later
    {
      name: 'Apostas',
      href: '/bets',
      icon: Target,
      description: 'Minhas apostas'
    }
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsMobileMenuOpen(false);
  };

  if (!user) {
    return null;
  }

  return (
    <nav className={`bg-background border-b border-border sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/bets')}
              className="flex items-center space-x-2 hover:bg-transparent"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">Smart In Bet</span>
            </Button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.name}
                  variant={isActive(item.href) ? "default" : "ghost"}
                  onClick={() => handleNavigation(item.href)}
                  className={`flex items-center space-x-2 ${
                    isActive(item.href) 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Button>
              );
            })}
          </div>

          {/* Right side - WhatsApp Status & User Menu */}
          <div className="flex items-center space-x-4">
            {/* WhatsApp Status Badge */}
            <div className="hidden sm:flex items-center">
              {isSynced ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  WhatsApp Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                  WhatsApp Pendente
                </Badge>
              )}
            </div>

            {/* User Menu */}
            <UserNav />

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => {
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
                    <div className="text-left">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs opacity-70">{item.description}</div>
                    </div>
                  </Button>
                );
              })}
              
              {/* Mobile WhatsApp Status */}
              <div className="px-3 py-2 border-t border-border mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status WhatsApp:</span>
                  {isSynced ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      Conectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                      Pendente
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
