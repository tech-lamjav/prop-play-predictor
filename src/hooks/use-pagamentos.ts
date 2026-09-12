import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import {
  montarPagamentos,
  type Pagamento,
  type PagamentoDoBanco,
} from '@/components/socios/crm-receita';

const CHAVE = (assinaturaId: string) => ['socios', 'pagamentos', assinaturaId] as const;

/**
 * O estado dos pagamentos de uma assinatura.
 *
 * União discriminada como o resto do painel, e aqui ela pesa mais que nos
 * outros lugares: uma lista vazia diz "essa pessoa nunca pagou", e o sócio vai
 * cobrar em cima disso. "Ainda não sei" tem que ser um estado próprio, ou a
 * tela cobra quem está em dia enquanto a consulta ainda está no ar.
 */
export type EstadoDosPagamentos =
  { tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'pronto'; pagamentos: Pagamento[] };

/**
 * Os pagamentos recebidos na mão de uma assinatura.
 *
 * Inclui os ESTORNADOS, marcados. Some da soma, não da lista: um lançamento
 * errado que desaparece da tela é um lançamento que ninguém consegue auditar, e
 * quem estornou precisa ver que estornou.
 */
export function usePagamentos(assinaturaId: string | undefined): EstadoDosPagamentos {
  const consulta = useQuery({
    queryKey: CHAVE(assinaturaId ?? 'nenhuma'),
    enabled: !!assinaturaId,
    queryFn: async (): Promise<PagamentoDoBanco[]> => {
      const { data, error } = await createClient()
        .from('crm_pagamento')
        .select('id, competencia, valor, origem, pago_em, estornado_em, motivo_do_estorno')
        .eq('assinatura_id', assinaturaId!)
        .order('competencia', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PagamentoDoBanco[];
    },
    staleTime: 60 * 1000,
  });

  // Sem assinatura não há o que pagar, e a consulta nem sai. Lista vazia em vez
  // de "carregando": não há nada para esperar.
  if (!assinaturaId) return { tipo: 'pronto', pagamentos: [] };
  if (consulta.isError) return { tipo: 'erro' };
  if (!consulta.data) return { tipo: 'carregando' };
  return { tipo: 'pronto', pagamentos: montarPagamentos(consulta.data) };
}

export interface PagamentoALancar {
  /** `YYYY-MM`, o mês a que o dinheiro se refere. */
  mes: string;
  valor: number;
  origem: string;
  /** `YYYY-MM-DD`, o dia em que caiu. */
  pagoEm: string;
}

/**
 * Registrar dinheiro recebido na mão.
 *
 * ⚠️ Escreve mais coisa do que o nome diz, e é de propósito: a função do banco
 * empurra o vencimento da assinatura um mês, libera os acessos do plano e anota
 * na linha do tempo. É uma transação só porque as quatro coisas são o mesmo
 * fato — se o pagamento entrasse e o acesso não, a pessoa teria pago para
 * continuar sem o produto.
 */
export function useRegistrarPagamento(assinaturaId: string | undefined, userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async ({ mes, valor, origem, pagoEm }: PagamentoALancar) => {
      const { error } = await createClient().rpc('crm_registrar_pagamento', {
        p_assinatura_id: assinaturaId!,
        // O banco quer uma data e guarda o mês: manda sempre o dia 1º, que é o
        // que a restrição da tabela exige. A tela pensa em mês.
        p_competencia: `${mes}-01`,
        p_valor: valor,
        p_origem: origem,
        p_pago_em: pagoEm,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(fila, assinaturaId, userId),
  });
}

/**
 * Estornar um lançamento errado.
 *
 * Exige motivo, e o banco recusa sem ele. Não recua o acesso: a pessoa já usou,
 * e tirar por erro de lançamento castiga quem não errou.
 */
export function useEstornarPagamento(assinaturaId: string | undefined, userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await createClient().rpc('crm_estornar_pagamento', {
        p_id: id,
        p_motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(fila, assinaturaId, userId),
  });
}

function invalidar(
  fila: ReturnType<typeof useQueryClient>,
  assinaturaId: string | undefined,
  userId: string | undefined,
) {
  if (assinaturaId) fila.invalidateQueries({ queryKey: CHAVE(assinaturaId) });

  // A assinatura também: registrar um pagamento empurra o `vence_em`, e sem
  // isto a ficha continuaria mostrando a data velha ao lado do pagamento novo.
  fila.invalidateQueries({ queryKey: ['socios', 'assinaturas-manuais'] });

  if (userId) {
    fila.invalidateQueries({ queryKey: ['socios', 'pessoa', userId] });
    fila.invalidateQueries({ queryKey: ['socios', 'linha-do-tempo', userId] });
  }
  fila.invalidateQueries({ queryKey: ['socios', 'cadastros'] });
}
