import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import {
  montarFeedbacks,
  type AnotacaoDoBanco,
  type FeedbackNaLista,
} from '@/components/socios/crm-linha-do-tempo';
import type { Cadastro } from '@/components/socios/crm-lista';

export type EstadoDosFeedbacks =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; feedbacks: FeedbackNaLista[] };

/**
 * Todos os feedbacks da base.
 *
 * A consulta pede só os do tipo `feedback`, e não a tabela inteira filtrada
 * depois: a linha do tempo cresce com anotação e objeção, e trazer tudo para
 * descartar a maior parte no navegador fica mais caro a cada semana de uso.
 *
 * Os nomes vêm de fora, do mesmo `useCadastros` que o painel já usa. Isso é de
 * propósito: a consulta está em cache, então abrir os feedbacks logo depois do
 * painel não custa uma segunda leitura da base.
 */
export function useFeedbacks(cadastros: Cadastro[]): EstadoDosFeedbacks {
  const consulta = useQuery({
    queryKey: ['socios', 'feedbacks'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('crm_anotacao')
        .select('id, user_id, tipo, texto, criada_em, criada_por')
        .eq('tipo', 'feedback');
      if (error) throw error;
      return (data ?? []) as (AnotacaoDoBanco & { user_id: string })[];
    },
    staleTime: 60 * 1000,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };

  const nomes: Record<string, string> = {};
  for (const c of cadastros) nomes[c.id] = c.name?.trim() || c.email;

  return { tipo: 'pronto', feedbacks: montarFeedbacks(consulta.data, nomes) };
}
