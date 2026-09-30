import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePorteiro } from '@/hooks/use-porteiro';
import { queMostrar } from '@/utils/bloqueio-de-origem';
import { TelaDeBloqueio } from './TelaDeBloqueio';

/**
 * A porta: mostra o produto ou a tela de bloqueio.
 *
 * Spec na issue #548, tickets #550, #551 e #552.
 *
 * Embrulha as rotas porque precisa poder aparecer NO LUGAR delas. Os outros
 * sentinelas do App desenham por cima do produto; este substitui o produto, e
 * por isso é o único que recebe filhos.
 *
 * Ele OBEDECE o veredito do servidor e não decide nada sobre país. A regra de
 * qual das duas coisas mostrar mora numa função pura em
 * `@/utils/bloqueio-de-origem`, que é onde o teste está.
 *
 * ⚠️ Enquanto a resposta não chega, o produto aparece normalmente. Não há
 * espera, e isso é deliberado: com a chave do bloqueio desligada ninguém nunca
 * é barrado, então uma espera não compraria nada e cobraria uma ida à rede de
 * cada pessoa do mundo. O motivo completo está na função pura.
 */
export const Porteiro: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { resposta } = usePorteiro();
  const { pathname } = useLocation();

  const mostrar = queMostrar({ veredito: resposta?.veredito ?? null, pathname });

  // O servidor derruba a sessão de quem foi barrado (#552); aqui o navegador
  // joga fora o que ainda tem guardado. Não é a trava — a trava é do lado de
  // lá — mas é o que impede o app de seguir tentando usar um token morto e
  // encher a tela de erro por trás da explicação.
  useEffect(() => {
    if (mostrar !== 'bloqueio') return;
    void supabase.auth.signOut({ scope: 'local' }).catch(() => {
      /* sair já falhou do lado do servidor ou não havia sessão: a tela de
         bloqueio continua valendo de qualquer jeito */
    });
  }, [mostrar]);

  if (mostrar === 'bloqueio') return <TelaDeBloqueio />;

  return <>{children}</>;
};
