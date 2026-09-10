import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { Comportamento } from '@/components/socios/crm-comportamento';

export type EstadoDoComportamento =
  | { tipo: 'carregando' }
  /** `motivo` chega à tela: "não configurado" e "falhou" pedem coisas diferentes. */
  | { tipo: 'erro'; motivo: string }
  | { tipo: 'pronto'; comportamento: Comportamento };

/**
 * O que o PostHog sabe sobre uma pessoa.
 *
 * Passa pela edge function `crm-comportamento`, e não direto: a chave de
 * consulta do PostHog lê o comportamento de TODA a base, e no navegador ela
 * ficaria à vista de qualquer visitante.
 *
 * Só sai quando a ficha abre — o modal monta este hook, e a lista nunca o
 * chama. Uma consulta por pessoa aberta é barata; uma por linha da lista seria
 * seiscentas.
 */
export function useComportamento(userId: string | undefined): EstadoDoComportamento {
  const consulta = useQuery({
    queryKey: ['socios', 'comportamento', userId ?? ''],
    enabled: !!userId,
    // Comportamento não muda de minuto a minuto, e reabrir a mesma ficha duas
    // vezes na mesma conversa não deveria custar duas consultas ao PostHog.
    staleTime: 10 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<Comportamento> => {
      const { data, error } = await createClient().functions.invoke('crm-comportamento', {
        body: { user_id: userId },
      });
      if (error) throw error;
      // A função responde com `erro` no corpo quando a chave não está
      // configurada ou o PostHog recusou. Sem isto, o corpo de erro seria lido
      // como um resumo com zero em tudo.
      if (data?.erro) throw new Error(String(data.erro));
      return data as Comportamento;
    },
  });

  if (consulta.isError) return { tipo: 'erro', motivo: String(consulta.error) };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronto', comportamento: consulta.data };
}
