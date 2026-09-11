import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import {
  montarAssinaturas,
  type Assinatura,
  type AssinaturaDoBanco,
} from '@/components/socios/crm-assinatura';
import type { Cadastro } from '@/components/socios/crm-lista';
import type { PlanoAVender } from '@/components/socios/crm-vocabulario';

const CHAVE = ['socios', 'assinaturas-manuais'] as const;

/**
 * O estado da fila de cobrança.
 *
 * União discriminada como o resto do painel: uma lista vazia diz ao sócio que
 * ninguém precisa ser cobrado, e ele fecha a tela em cima disso. "Ainda não
 * sei" tem que ser um estado próprio.
 */
export type EstadoDasAssinaturas =
  { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; assinaturas: Assinatura[] };

/**
 * As cortesias abertas, com quem são as pessoas.
 *
 * Só as abertas: `encerrada_em is null`. As encerradas ficam na tabela para o
 * histórico, e não pertencem a uma fila de cobrança.
 *
 * Os cadastros entram por fora em vez de virarem um join no banco: a lista já
 * está carregada no painel, e um join exigiria uma view nova só para juntar
 * duas listas curtas que o navegador junta de graça.
 */
export function useAssinaturas(cadastros: Cadastro[]): EstadoDasAssinaturas {
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<AssinaturaDoBanco[]> => {
      const { data, error } = await createClient()
        .from('crm_assinatura_manual')
        .select('id, user_id, plano, vence_em, criada_em, criada_por')
        .is('encerrada_em', null)
        .order('vence_em', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AssinaturaDoBanco[];
    },
    staleTime: 60 * 1000,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (!consulta.data) return { tipo: 'carregando' };
  return { tipo: 'pronto', assinaturas: montarAssinaturas(consulta.data, cadastros) };
}

/**
 * Conceder um plano inteiro na mão.
 *
 * Passa por função do banco pelo mesmo motivo do resto: a política do sócio
 * sobre `public.users` é de leitura, e dar `update` a ela abriria a tabela
 * inteira. A função segue a escada cumulativa, que é a mesma que o Stripe usa.
 */
export function useDarAssinatura(userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async ({ plano, venceEm }: { plano: PlanoAVender; venceEm: string }) => {
      const { error } = await createClient().rpc('crm_dar_assinatura_manual', {
        p_user_id: userId!,
        p_plano: plano,
        p_vence_em: venceEm,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(fila, userId),
  });
}

/**
 * Encerrar uma cortesia.
 *
 * Recebe o id da CONCESSÃO, e não o da pessoa: encerrar é fechar uma linha
 * específica, e com o id da pessoa a função teria que escolher qual fechar.
 */
export function useEncerrarAssinatura() {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await createClient().rpc('crm_encerrar_assinatura_manual', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => invalidar(fila, undefined),
  });
}

function invalidar(fila: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  fila.invalidateQueries({ queryKey: CHAVE });
  // A ficha e a lista também: conceder um plano muda o acesso da pessoa, e com
  // isso a posição dela no funil.
  if (userId) {
    fila.invalidateQueries({ queryKey: ['socios', 'pessoa', userId] });
    fila.invalidateQueries({ queryKey: ['socios', 'linha-do-tempo', userId] });
  }
  fila.invalidateQueries({ queryKey: ['socios', 'cadastros'] });
}
