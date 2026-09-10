import type { ReactNode } from 'react';
import NotFound from '@/pages/NotFound';
import { useSocio } from '@/hooks/use-socio';

/**
 * Deixa passar quem é sócio; para todo mundo, a página de não encontrado.
 *
 * Não é uma tela de acesso negado de propósito: negar acesso confirma que o
 * painel existe naquele endereço, e ele não é anunciado em canto nenhum — nem
 * no menu, nem no sitemap, nem no robots.txt.
 *
 * Enquanto a resposta não chega não desenha nada. Um vazio de meio segundo é
 * melhor que a página de erro piscando na cara do sócio a cada recarga.
 */
export function PortaoDoSocio({ children }: { children: ReactNode }) {
  const { ehSocio, carregando } = useSocio();

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-forest" />
      </div>
    );
  }

  if (!ehSocio) return <NotFound />;

  return <>{children}</>;
}
