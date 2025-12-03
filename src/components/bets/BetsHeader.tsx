import React from 'react';
import { UserIcon, BarChartIcon, ArrowLeft, Users, LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface BetsHeaderProps {
  title?: string;
  onReferralClick?: () => void;
}

export const BetsHeader: React.FC<BetsHeaderProps> = ({ title = "STATIX BETS", onReferralClick }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="terminal-header p-3 flex justify-between items-center">
      <div className="flex items-center">
        <button 
          onClick={() => navigate('/bets')}
          className="terminal-button px-3 py-2 text-sm font-medium mr-4 flex items-center border-terminal-border hover:border-terminal-green transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          INÍCIO
        </button>
        <span className="text-base font-semibold mr-6 text-terminal-green tracking-wide">
          Betinho
        </span>
      </div>
      <div className="flex items-center space-x-2">
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
        <button className="terminal-button p-1.5">
          <BarChartIcon size={16} />
        </button>
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
