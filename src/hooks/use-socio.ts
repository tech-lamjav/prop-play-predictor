import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/integrations/supabase/client';

// ============================================================================
// Quem é sócio
// ============================================================================
// A coluna vive em `public.users` e é ligada na mão, direto no banco. Este hook
// só a lê, e a leitura passa pela política que já existia desde a migration
// 005: cada um enxerga a própria linha. Ou seja, ninguém precisa ser sócio para
// descobrir que NÃO é.
//
// O que este hook NÃO é: segurança. Ele governa o que a tela desenha. Quem
// impede um curioso de ler a base inteira é a política de linha da migration
// 123, do lado do banco — o bundle é público e o caminho da rota está dentro
// dele.
// ============================================================================

const CHAVE = ['eh_socio'] as const;

async function buscarSeEhSocio(userId: string): Promise<boolean> {
  const { data, error } = await createClient()
    .from('users')
    .select('is_socio')
    .eq('id', userId)
    .single();

  // Erro vira "não é sócio" de propósito: errar para menos aqui esconde um
  // painel de quem tinha direito, e errar para mais mostraria a base inteira.
  if (error) return false;
  return data?.is_socio === true;
}

export interface EstadoDoSocio {
  ehSocio: boolean;
  carregando: boolean;
}

export function useSocio(): EstadoDoSocio {
  const { user, isLoading: autenticando } = useAuth();

  const consulta = useQuery({
    queryKey: [...CHAVE, user?.id ?? ''],
    queryFn: () => buscarSeEhSocio(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    ehSocio: consulta.data === true,
    // Enquanto a sessão carrega, `enabled` é falso e a consulta fica ociosa —
    // `isLoading` seria falso e o portão decidiria com a resposta errada,
    // piscando a página de erro na cara do sócio a cada F5. Por isso as duas
    // esperas contam como uma só.
    carregando: autenticando || (!!user?.id && consulta.isLoading),
  };
}
