import React from 'react';
import { UserIcon, ArrowLeft, Users, LogOut, Settings, BarChart3, Send } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface BetsHeaderProps {
  title?: string;
  onReferralClick?: () => void;
  showUnitsView?: boolean;
  onShowUnitsViewChange?: (checked: boolean) => void;
  onUnitConfigClick?: () => void;
  unitsConfigured?: boolean;
}

export const BetsHeader: React.FC<BetsHeaderProps> = ({
  title = "STATIX BETS",
  onReferralClick,
  showUnitsView = false,
  onShowUnitsViewChange,
  onUnitConfigClick,
  unitsConfigured = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isDashboard = location.pathname === '/betting-dashboard';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="terminal-header p-3 flex justify-between items-center">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => navigate('/bets')}
          className="terminal-button px-3 py-2 text-sm font-medium mr-4 flex items-center border-terminal-border hover:border-terminal-green transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          INÍCIO
        </button>
        {!isDashboard && (
          <button
            type="button"
            onClick={() => navigate('/betting-dashboard')}
            className="terminal-button px-3 py-2 text-sm font-medium mr-4 flex items-center border-terminal-border hover:border-terminal-green transition-colors"
          >
            <BarChart3 size={16} className="mr-2" />
            DASHBOARD
          </button>
        )}
        <span className="text-base font-semibold mr-6 text-terminal-green tracking-wide">
          Betinho
        </span>
      </div>
      <div className="flex items-center space-x-2">
        {onShowUnitsViewChange !== undefined && (
          <div className="flex items-center gap-2 mr-2">
            <Label htmlFor="header-show-units" className="text-xs whitespace-nowrap text-terminal-text opacity-80 cursor-pointer">
              Unidades
            </Label>
            <Switch
              id="header-show-units"
              checked={showUnitsView}
              onCheckedChange={onShowUnitsViewChange}
              disabled={!unitsConfigured}
              className="data-[state=unchecked]:bg-white/80 data-[state=checked]:bg-[var(--terminal-green)]"
            />
          </div>
        )}
        {onUnitConfigClick && (
          <button
            type="button"
            onClick={onUnitConfigClick}
            className="terminal-button px-3 py-2 text-sm font-medium flex items-center gap-2 border-terminal-border hover:border-terminal-green transition-colors mr-2"
          >
            <Settings size={16} className="shrink-0" />
            <span className="hidden sm:inline">UNIDADES</span>
          </button>
        )}
        {onReferralClick && (
          <button 
            onClick={onReferralClick}
            className="terminal-button px-3 py-2 text-sm font-medium flex items-center border-terminal-border hover:border-terminal-green transition-colors"
            title="Indique um amigo"
          >
            <Users size={16} className="mr-2" />
            <span className="hidden sm:inline">Indique um amigo</span>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="terminal-button p-1.5 hover:border-terminal-green transition-colors">
              <UserIcon size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            className="bg-terminal-dark-gray border-terminal-border text-terminal-text w-48" 
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
              onClick={() => navigate('/onboarding')}
              className="text-terminal-text hover:bg-terminal-gray focus:bg-terminal-gray cursor-pointer"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => window.open('https://t.me/betinho_assistente_bot', '_blank')}
              className="text-terminal-text hover:bg-terminal-gray focus:bg-terminal-gray cursor-pointer"
            >
              <Send className="mr-2 h-4 w-4" />
              <span>Abrir Telegram</span>
            </DropdownMenuItem>
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
      </div>
    </div>
  );
};
