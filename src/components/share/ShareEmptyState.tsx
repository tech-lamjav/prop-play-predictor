import React from 'react';
import { Target } from 'lucide-react';

export const ShareEmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Target className="w-16 h-16 text-terminal-text/30 mb-4" />
      <h2 className="text-lg font-medium text-terminal-text mb-2">
        Nenhuma aposta encontrada
      </h2>
      <p className="text-sm text-terminal-text/70 max-w-sm">
        Não há apostas que correspondam aos filtros aplicados neste link de compartilhamento.
      </p>
    </div>
  );
};
