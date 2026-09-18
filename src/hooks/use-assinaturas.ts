import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import {
  montarAssinaturas,
  type Assinatura,
  type AssinaturaDoBanco,
} from '@/components/socios/crm-assinatura';
import type { Cadastro } from '@/components/socios/crm-lista';
import type { PlanoAVender } from '@/components/socios/crm-vocabulario';
import { CHAVES } from './crm-chaves';

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
 * As assinaturas manuais abertas, com quem são as pessoas.
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
    queryKey: CHAVES.assinaturas,
    queryFn: async (): Promise<AssinaturaDoBanco[]> => {
      const { data, error } = await createClient()
        .from('crm_assinatura_manual')
        .select('id, user_id, plano, vence_em, valor_mensal, criada_em, comecou_em, criada_por')
        .is('encerrada_em', null)
        .order('vence_em', { ascending: true });
      if (error) throw error;
      /*
       * ⚠️ Passa por `unknown` por causa de `comecou_em`.
       *
       * `src/integrations/supabase/types.ts` é GERADO a partir do banco, e o
       * banco de onde ele foi gerado não tem essa coluna: ela nasce na
       * migration 153, que sobe no deploy. Até lá o tipo gerado diz que a
       * coluna não existe, e o cast direto vira erro.
       *
       * Regenerar o arquivo exigiria ler produção, o que não se faz daqui. O
       * cast some sozinho quando alguém regenerar os tipos depois do deploy.
       */
      return (data ?? []) as unknown as AssinaturaDoBanco[];
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
 *
 * ⚠️ `venceEm` nulo é VITALÍCIA e `valorMensal` nulo é SEM COBRANÇA. São dois
 * nulos com significados diferentes, e nenhum dos dois é ausência de resposta:
 * os dois são escolhas que o sócio faz no formulário.
 */
export function useDarAssinatura(userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async ({
      plano,
      venceEm,
      valorMensal,
      comecouEm,
    }: {
      plano: PlanoAVender;
      venceEm: string | null;
      valorMensal: number | null;
      /** `YYYY-MM-DD`. Hoje no caso normal; pode ser retroativo ao CRIAR. */
      comecouEm: string;
    }) => {
      const { error } = await createClient().rpc('crm_dar_assinatura_manual', {
        p_user_id: userId!,
        p_plano: plano,
        p_vence_em: venceEm,
        p_valor_mensal: valorMensal,
        // ⚠️ Mesmo motivo do cast da consulta: os tipos gerados ainda descrevem
        // a função de quatro parâmetros, porque o quinto nasce na migration 153
        // e só existe depois do deploy. Regenerar exigiria ler produção.
        p_comecou_em: comecouEm,
      } as unknown as { p_user_id: string; p_plano: string; p_vence_em: string });
      if (error) throw error;
    },
    onSuccess: () => invalidar(fila, userId),
  });
}

/**
 * Encerrar uma assinatura manual.
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
  fila.invalidateQueries({ queryKey: CHAVES.assinaturas });
  // A ficha e a lista também: conceder um plano muda o acesso da pessoa, e com
  // isso a posição dela no funil.
  if (userId) {
    fila.invalidateQueries({ queryKey: CHAVES.pessoa(userId) });
    fila.invalidateQueries({ queryKey: CHAVES.linhaDoTempo(userId) });
  }
  fila.invalidateQueries({ queryKey: CHAVES.cadastros });
  // A fila de inadimplentes também: trocar o valor muda o que a pessoa deve.
  fila.invalidateQueries({ queryKey: CHAVES.pagamentosDeTodas });
}
