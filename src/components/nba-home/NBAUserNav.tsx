import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/**
 * Avatar dropdown com tema light do rebrand. Espelho funcional de UserNav,
 * mas com classes Tailwind explícitas (bg-white/text-ink/forest) pra não herdar
 * o tema dark global via popover portal.
 */
export const NBAUserNav: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = (name?: string) =>
    (name ?? user?.email ?? 'U')
      .split(/\s+|@/)
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const displayName = user?.user_metadata?.name as string | undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-transparent">
          <Avatar className="h-9 w-9 border border-line">
            <AvatarFallback className="bg-forest text-white text-[12px] font-semibold">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 bg-white text-ink border border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]"
        align="end"
        forceMount
      >
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none min-w-0">
            <p className="font-medium text-ink truncate">{displayName ?? 'Usuário'}</p>
            <p className="w-[200px] truncate text-sm text-ink-2">{user?.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-line" />
        <DropdownMenuItem
          onClick={() => navigate('/bets')}
          className="cursor-pointer text-ink focus:bg-forest-tint focus:text-forest"
        >
          <User className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => navigate('/settings')}
          className="cursor-pointer text-ink focus:bg-forest-tint focus:text-forest"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Configurações</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-line" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-ink focus:bg-rose-50 focus:text-rose-700"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
