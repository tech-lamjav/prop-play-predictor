import React from 'react';

interface BetinhoCTAProps {
  /**
   * - 'pre': jogo ainda não aconteceu — convida a registrar a aposta
   * - 'post': jogo finalizado — convida a registrar o resultado da aposta
   */
  variant: 'pre' | 'post';
}

/**
 * CTA discreto que aparece no rodapé do MatchPredictionCard.
 * Leva pra LP variante /betinho/bolao (mesma rota, hero customizado pra
 * usuários do bolão). Abre em nova aba pra não interromper o fluxo de
 * palpites.
 */
export const BetinhoCTA: React.FC<BetinhoCTAProps> = ({ variant }) => {
  const linkText = variant === 'post' ? 'Registre o resultado aqui' : 'Registre aqui';

  return (
    <div
      className="px-3 sm:px-4 pb-2 -mt-1 text-[11px] text-ink-3 leading-tight"
      data-testid={`betinho-cta-${variant}`}
    >
      Apostou nesse jogo?{' '}
      <a
        href="/betinho/bolao"
        target="_blank"
        rel="noopener noreferrer"
        className="text-forest hover:text-forest-2 font-medium underline-offset-2 hover:underline"
      >
        {linkText}
      </a>
    </div>
  );
};
