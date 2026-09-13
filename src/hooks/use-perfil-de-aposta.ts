import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import { montarPerfil, type Perfil, type PerfilDoBanco } from '@/components/socios/crm-perfil';

/**
 * O estado do perfil de aposta.
 *
 * `vazio` é estado próprio, separado de `pronto`: quem nunca apostou não é o
 * mesmo que alguém com números zerados, e a tela fala diferente com os dois.
 * Perto de 110 pessoas na base inteira já apostaram, então `vazio` é o caso
 * comum e precisa de um texto que não pareça erro.
 */
export type EstadoDoPerfil =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'vazio' }
  | { tipo: 'pronto'; perfil: Perfil };

/**
 * Como uma pessoa aposta, por trás de uma função do banco.
 *
 * ⚠️ Passa por função e não por consulta porque a tabela `bets` continua
 * FECHADA para o sócio, e isso é decisão da migration 124. A função é
 * `security definer` e devolve só agregado: nenhuma linha de aposta, nenhuma
 * descrição, nenhum texto cru que a pessoa mandou no Telegram. Dar policy de
 * select em `bets` abriria tudo isso de uma vez.
 */
export function usePerfilDeAposta(userId: string | undefined): EstadoDoPerfil {
  const consulta = useQuery({
    queryKey: ['socios', 'perfil-de-aposta', userId],
    enabled: !!userId,
    queryFn: async (): Promise<PerfilDoBanco | null> => {
      const { data, error } = await createClient().rpc('crm_perfil_de_aposta', {
        p_user_id: userId!,
      });
      if (error) throw error;
      // `returns table` devolve lista. Sem apostas a lista tem uma linha com
      // tudo zerado, e não lista vazia — mas as duas coisas podem acontecer se
      // a função mudar, então as duas viram nulo aqui.
      const linhas = (data ?? []) as PerfilDoBanco[];
      return linhas[0] ?? null;
    },
    // Aposta não muda de minuto em minuto, e a ficha abre e fecha muitas vezes
    // seguidas enquanto o sócio percorre a lista.
    staleTime: 5 * 60 * 1000,
  });

  if (!userId) return { tipo: 'carregando' };
  if (consulta.isError) return { tipo: 'erro' };
  if (!consulta.data) {
    return consulta.isLoading ? { tipo: 'carregando' } : { tipo: 'vazio' };
  }

  const perfil = montarPerfil(consulta.data);
  // Zero apostas é `vazio`, e não um perfil de zeros. A tela diz "nunca
  // apostou" em vez de desenhar tabelas em branco.
  if (perfil.total === 0) return { tipo: 'vazio' };
  return { tipo: 'pronto', perfil };
}
