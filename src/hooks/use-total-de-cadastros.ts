import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { Contagem } from '@/components/socios/PainelCrm';

/**
 * Quantos cadastros a base tem.
 *
 * `head: true` pede só a contagem, sem trazer linha nenhuma — o painel não
 * precisa dos dados para mostrar o número, e trazer a base inteira para contar
 * seria o tipo de consulta que fica lenta calada.
 *
 * Quem não é sócio recebe 1 aqui, a própria linha, por causa da política que
 * existe desde a migration 005. Não é erro: é a política funcionando. A tela
 * nunca chega a esse ponto porque o portão a segura antes.
 */
export function useTotalDeCadastros(): Contagem {
  const consulta = useQuery({
    queryKey: ['socios', 'cadastros', 'total'],
    queryFn: async () => {
      const { count, error } = await createClient()
        .from('users')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  if (consulta.isError) return { estado: 'erro' };
  if (consulta.data === undefined) return { estado: 'contando' };
  return { estado: 'pronta', total: consulta.data };
}
