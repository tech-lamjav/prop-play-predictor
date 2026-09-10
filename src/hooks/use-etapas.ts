import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { EtapasGravadas } from '@/components/socios/crm-funil';
import type { Etapa } from '@/components/socios/crm-vocabulario';

const CHAVE = ['socios', 'etapas'] as const;

/**
 * O que se sabe sobre as etapas no momento em que a tela desenha.
 *
 * Três estados, como nas outras consultas do painel. A primeira versão devolvia
 * um mapa vazio para carregando E para erro, e isso mentia duas vezes: enquanto
 * carregava, toda linha exibia o crachá "Novo", que é uma afirmação e não um
 * vazio; e quando a consulta falhava, o filtro de "Novo" — a lista de quem
 * ainda falta abordar — devolvia todo mundo que já tinha sido abordado.
 */
export type EstadoDasEtapas =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; etapas: EtapasGravadas };

/**
 * As etapas gravadas, de todo mundo.
 *
 * Vem a tabela inteira numa consulta só, e não uma por lead: a tabela só tem
 * linha de quem já foi tocado, então ela é sempre menor que a base — e o filtro
 * da lista precisa das etapas de todos ao mesmo tempo de qualquer jeito.
 */
export function useEtapas(): EstadoDasEtapas {
  const consulta = useQuery({
    queryKey: CHAVE,
    queryFn: async (): Promise<EtapasGravadas> => {
      const { data, error } = await createClient().from('crm_etapa').select('user_id, etapa');
      if (error) throw error;
      const mapa: EtapasGravadas = {};
      for (const linha of data ?? []) mapa[linha.user_id] = linha.etapa;
      return mapa;
    },
    staleTime: 60 * 1000,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronto', etapas: consulta.data };
}

/**
 * Move um lead de etapa.
 *
 * Passa pela função do banco, e não por dois inserts daqui: a linha atual e o
 * evento da linha do tempo precisam acontecer juntos ou não acontecer. Do
 * navegador elas não são uma transação, e a etapa andaria sem a linha do tempo
 * registrar — sem erro nenhum, com a tela mostrando a etapa nova.
 *
 * Quem chama precisa olhar o `isError`: o seletor da ficha é controlado pelo
 * valor do servidor, então uma gravação que falha faz ele voltar sozinho para a
 * etapa antiga. Sem aviso, isso parece um clique que não pegou.
 */
export function useMudarEtapa(userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async (etapa: Etapa) => {
      const { error } = await createClient().rpc('crm_mudar_etapa', {
        p_user_id: userId!,
        p_etapa: etapa,
      });
      if (error) throw error;
      return etapa;
    },
    onSuccess: () => {
      // A mesma chave alimenta a lista e a ficha, então invalidar uma vez
      // acerta as duas telas.
      fila.invalidateQueries({ queryKey: CHAVE });
    },
  });
}
