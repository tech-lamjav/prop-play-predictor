import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import {
  linhaDoTempo,
  type AnotacaoDoBanco,
  type EventoDeEtapa,
} from '@/components/socios/crm-linha-do-tempo';
import type { EstadoDaLinhaDoTempo } from '@/components/socios/LinhaDoTempo';
import type { TipoDeAnotacao } from '@/components/socios/crm-vocabulario';

const chaveDa = (id: string) => ['socios', 'linha-do-tempo', id] as const;

/**
 * A linha do tempo de uma pessoa: anotações e mudanças de etapa.
 *
 * Duas consultas, juntadas aqui. Uma união no banco economizaria uma ida ao
 * servidor e custaria uma função nova — por pessoa, são duas listas curtas, e
 * ninguém sente a diferença.
 *
 * O estado vem em união discriminada, como nas outras consultas do painel: uma
 * lista vazia diz ao sócio que ninguém falou com essa pessoa, e ele age em cima
 * disso, então "ainda não sei" precisa ser um estado próprio.
 */
export function useLinhaDoTempo(userId: string | undefined): EstadoDaLinhaDoTempo {
  const consulta = useQuery({
    queryKey: chaveDa(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const cliente = createClient();

      const [anotacoes, eventos] = await Promise.all([
        cliente
          .from('crm_anotacao')
          .select('id, tipo, texto, criada_em, criada_por')
          .eq('user_id', userId!),
        cliente.from('crm_etapa_evento').select('id, de, para, em, por').eq('user_id', userId!),
      ]);

      if (anotacoes.error) throw anotacoes.error;
      if (eventos.error) throw eventos.error;

      return linhaDoTempo(
        (anotacoes.data ?? []) as AnotacaoDoBanco[],
        (eventos.data ?? []) as EventoDeEtapa[],
      );
    },
    staleTime: 30 * 1000,
  });

  // Endereço sem identificador não é linha do tempo vazia: dizer "nada
  // registrado" ali afirmaria algo sobre uma pessoa que nem foi encontrada.
  if (!userId) return { tipo: 'carregando' };
  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronta', itens: consulta.data };
}

/**
 * Escreve na linha do tempo.
 *
 * Passa pela função do banco para o autor ser carimbado com `auth.uid()`. Com
 * insert direto, um sócio poderia gravar em nome do outro — e numa lista que
 * existe para saber quem falou com quem, isso é o registro mentindo.
 */
export function useAnotar(userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async ({ tipo, texto }: { tipo: TipoDeAnotacao; texto: string }) => {
      const { error } = await createClient().rpc('crm_anotar', {
        p_user_id: userId!,
        p_tipo: tipo,
        p_texto: texto,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      fila.invalidateQueries({ queryKey: chaveDa(userId ?? '') });
    },
  });
}
