import React from 'react';

interface BolaoLayoutProps {
  children: React.ReactNode;
}

/**
 * Wrapper que aplica o tema "Direção A" (rebrand do Bolão) em todas as rotas
 * do bolão. As CSS vars do tema estão escopadas em `.theme-bolao` no
 * `index.css`, então só dentro deste wrapper as classes novas (bg-canvas,
 * text-ink, bg-forest, etc.) ativam.
 *
 * Tudo fora do wrapper continua usando o tema "terminal" do resto do app.
 */
export const BolaoLayout: React.FC<BolaoLayoutProps> = ({ children }) => {
  return (
    <div className="theme-bolao min-h-screen flex flex-col">{children}</div>
  );
};
