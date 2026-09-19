import { useState, useEffect } from 'react';
import { createClient } from '../integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { esquecerFaixaDeAcesso } from '@/hooks/use-faixa-de-acesso';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // O que o navegador lembrava sobre o acesso desta pessoa sai junto com a
    // sessão. O porquê está em use-faixa-de-acesso.ts: aquela memória só é
    // segura enquanto "não tem nada guardado" significar "não tem ninguém
    // logado", e é aqui que as duas coisas deixam de valer ao mesmo tempo.
    esquecerFaixaDeAcesso();
  };

  return {
    user,
    isLoading,
    signOut
  };
}
