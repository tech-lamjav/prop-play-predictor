import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { isNbaOffSeason } from '@/components/onboarding/demo/nba';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  /** Em off-season da NBA (jul-set), libera a rota mesmo deslogado — vitrine
   *  do produto em modo exemplo. Só usar em rotas NBA. */
  allowNbaOffSeason?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = '/auth',
  allowNbaOffSeason = false,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Vitrine de off-season: qualquer um (mesmo deslogado) pode conhecer a NBA
  // em modo exemplo enquanto não há temporada. Volta a travar sozinho depois.
  if (allowNbaOffSeason && isNbaOffSeason()) {
    return <>{children}</>;
  }

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-forest"></div>
      </div>
    );
  }

  // If authentication is required but user is not logged in
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If user is logged in but trying to access auth pages, send to the hub.
  // (Não gateia onboarding aqui — o card do Betinho no /inicio leva pro vínculo
  // se ainda faltar; o gate fica no login/OAuth via resolveHomePath.)
  if (!requireAuth && user) {
    return <Navigate to="/inicio" replace />;
  }

  return <>{children}</>;
}
