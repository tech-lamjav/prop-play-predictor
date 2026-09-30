import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePorteiro } from '@/hooks/use-porteiro';
import { queMostrar } from '@/utils/bloqueio-de-origem';
import { TelaDeBloqueio } from './TelaDeBloqueio';

/**
 * A porta: mostra o produto, a tela de bloqueio, ou espera.
 *
 * Spec na issue #548, tickets #550 e #551.
 *
 * Embrulha as rotas porque precisa poder aparecer NO LUGAR delas. Os outros
 * sentinelas do App desenham por cima do produto; este substitui o produto, e
 * por isso é o único que recebe filhos.
 *
 * Ele OBEDECE o veredito do servidor e não decide nada sobre país. A regra de
 * qual das três coisas mostrar mora numa função pura em `@/utils/bloqueio-de-origem`,
 * que é onde o teste está.
 *
 * ⚠️ CUSTO CONHECIDO: enquanto a resposta não chega, a tela espera — e isso põe
 * uma ida à rede na frente do primeiro desenho, para todo mundo, inclusive
 * quem está no Peru. Foi a escolha combinada, porque a alternativa é mostrar o
 * produto primeiro e trocar depois, o que faria a tela de bloqueio piscar em
 * cima de quem foi barrado e, pior, deixaria o app fazer chamadas de dados
 * nesse intervalo.
 *
 * Duas formas de tirar essa espera existem e não foram feitas aqui, de
 * propósito, porque mudam o combinado: perguntar em paralelo com a sessão em
 * vez de depois dela, e lembrar o último veredito da sessão para pular a espera
 * a partir do segundo carregamento.
 */
export const Porteiro: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { carregando, resposta } = usePorteiro();
  const { pathname } = useLocation();

  const mostrar = queMostrar({
    carregando,
    veredito: resposta?.veredito ?? null,
    pathname,
  });

  if (mostrar === 'bloqueio') return <TelaDeBloqueio />;

  if (mostrar === 'espera') {
    return (
      <div className="min-h-dvh flex items-center justify-center" aria-busy="true">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest" />
      </div>
    );
  }

  return <>{children}</>;
};
