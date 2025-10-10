import React from 'react';
import { useAuth } from '../hooks/use-auth';
import { useWhatsAppSync } from '../hooks/use-whatsapp-sync';
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
  MessageCircle,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserNavProps {
  className?: string;
}

export default function UserNav({ className }: UserNavProps) {
  const { user, signOut } = useAuth();
  const { isSynced, isLoading } = useWhatsAppSync(user?.id || '');
  const navigate = useNavigate();

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

  const getWhatsAppStatus = () => {
    if (isLoading) {
      return { icon: AlertCircle, text: 'Verificando...', color: 'text-gray-500' };
    }
    if (isSynced) {
      return { icon: CheckCircle, text: 'WhatsApp Sincronizado', color: 'text-green-600' };
    }
    return { icon: MessageCircle, text: 'Sincronizar WhatsApp', color: 'text-blue-600' };
  };

  const whatsappStatus = getWhatsAppStatus();
  const StatusIcon = whatsappStatus.icon;

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* WhatsApp Status */}
      <div className="flex items-center space-x-2">
        <StatusIcon className={`w-4 h-4 ${whatsappStatus.color}`} />
        <span className={`text-sm ${whatsappStatus.color}`}>
          {whatsappStatus.text}
        </span>
      </div>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {user?.user_metadata?.name ? getInitials(user.user_metadata.name) : 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              <p className="font-medium">{user?.user_metadata?.name || 'Usuário'}</p>
              <p className="w-[200px] truncate text-sm text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/betting')}>
            <User className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/onboarding')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
