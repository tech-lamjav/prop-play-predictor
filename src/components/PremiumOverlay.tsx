import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';

interface PremiumOverlayProps {
  onUnlock?: () => void;
  className?: string;
}

export function PremiumOverlay({ onUnlock, className = '' }: PremiumOverlayProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleUnlock = () => {
    if (onUnlock) {
      onUnlock();
    } else {
      // Se não está logado, redireciona para login
      // Se está logado mas é free, redireciona para paywall
      if (!user) {
        navigate('/auth');
      } else {
        navigate('/paywall-platform');
      }
    }
  };

  return (
    <div
      className={`absolute inset-0 bg-terminal-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-center p-4 space-y-4">
        <div className="w-16 h-16 bg-terminal-green/20 border-2 border-terminal-green rounded-full flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-terminal-green" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-terminal-green mb-2">CONTEÚDO PREMIUM</h3>
          <p className="text-sm text-terminal-text opacity-70 mb-4">
            Assine o plano premium para acessar análises completas deste jogador
          </p>
        </div>
        <Button
          onClick={handleUnlock}
          className="terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold"
        >
          {user ? 'ASSINAR AGORA' : 'FAZER LOGIN'}
        </Button>
      </div>
    </div>
  );
}
