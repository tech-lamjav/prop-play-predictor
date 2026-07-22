import React from 'react';
import { useAuth } from '../hooks/use-auth';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  User,
  Settings,
  LogOut,
  Send,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { telegramBotUrl } from '@/config/environment';
import { useReferral } from './ReferralProvider';

interface UserNavProps {
  className?: string;
  /** 'rebrand' aplica o dropdown claro (Direção A) — o Portal renderiza fora do
   * .theme-bolao, então precisa da classe + bg/texto explícitos. Default = terminal (dark). */
  variant?: 'terminal' | 'rebrand';
}

export default function UserNav({ className, variant = 'terminal' }: UserNavProps) {
  const rebrand = variant === 'rebrand';
  const contentCls = rebrand ? 'theme-bolao bg-white border-line text-ink' : '';
  const itemCls = rebrand ? 'focus:bg-canvas-2 focus:text-forest cursor-pointer' : 'cursor-pointer';
  const mutedCls = rebrand ? 'text-ink-2' : 'text-muted-foreground';
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { openReferral } = useReferral();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/*
            Affordance universal: borda visível em qualquer fundo (clara ou escura)
            via `border-current/15` (adapta à cor de texto do contexto) e fallback
            sólido `bg-forest text-white` que contrasta em qualquer tema.

            Sem `variant` prop — o mesmo trio funciona em header terminal (preto)
            e em header rebrand (branco) sem ajuste por chamador.
          */}
          <Button
            variant="ghost"
            className="relative h-9 w-9 rounded-full p-0 border border-current/15 hover:border-current/30 hover:bg-current/5 transition-colors"
            aria-label="Menu da conta"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-forest text-white text-xs font-semibold">
                {user?.user_metadata?.name ? getInitials(user.user_metadata.name) : 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={`w-56 ${contentCls}`} align="end" forceMount>
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium">{user?.user_metadata?.name || 'Usuário'}</p>
              <p className={`w-[200px] truncate text-sm ${mutedCls}`}>
                {user?.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemCls} onClick={() => navigate('/bets')}>
            <User className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemCls} onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemCls} onClick={() => window.open(telegramBotUrl, '_blank')}>
            <Send className="mr-2 h-4 w-4" />
            <span>Abrir Telegram</span>
          </DropdownMenuItem>
          <DropdownMenuItem className={itemCls} onClick={openReferral}>
            <Users className="mr-2 h-4 w-4" />
            <span>Indique um amigo</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemCls} onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
