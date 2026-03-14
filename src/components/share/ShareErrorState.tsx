import React from 'react';
import { AlertCircle, Link2Off, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareErrorStateProps {
  status?: number;
  message?: string;
  onRetry: () => void;
}

export const ShareErrorState: React.FC<ShareErrorStateProps> = ({
  status,
  message,
  onRetry,
}) => {
  const is404 = status === 404 || message?.includes('não encontrado');
  const is410 = status === 410 || message?.includes('expirou');

  const title = is404
    ? 'Este link não existe ou foi removido'
    : is410
      ? 'Este link expirou'
      : 'Erro ao carregar';

  const description = is404
    ? 'O link de compartilhamento pode ter sido excluído ou o endereço está incorreto.'
    : is410
      ? 'O prazo de validade deste link acabou.'
      : 'Não foi possível carregar as apostas. Verifique sua conexão e tente novamente.';

  return (
    <div className="min-h-screen bg-terminal-black flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-4">
          {is404 || is410 ? (
            <Link2Off className="w-16 h-16 text-terminal-yellow/80" />
          ) : (
            <AlertCircle className="w-16 h-16 text-terminal-red/80" />
          )}
        </div>
        <h1 className="text-xl font-semibold text-terminal-text mb-2">{title}</h1>
        <p className="text-sm text-terminal-text/70 mb-6">{description}</p>
        <Button
          onClick={onRetry}
          className="terminal-button border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-terminal-black"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
};
