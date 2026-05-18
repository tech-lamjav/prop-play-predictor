import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import LandingBolao from '@/pages/LandingBolao';
import BolaoHome from '@/pages/BolaoHome';

/**
 * Decide entre landing pública e dashboard autenticado em /bolao:
 *  - Logado → BolaoHome (lista de bolões + criar)
 *  - Deslogado → LandingBolao (landing pública pra SEO + conversão)
 *  - Loading → null (evita flicker)
 */
const BolaoEntry: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (user) return <BolaoHome />;
  return <LandingBolao />;
};

export default BolaoEntry;
