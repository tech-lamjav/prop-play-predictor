import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { ProdutoEditavel } from '@/components/socios/crm-acesso';

/**
 * Mexer no acesso de alguém, pela ficha.
 *
 * ⚠️ Passa por função do banco, e não por `update` direto. A política do sócio
 * sobre `public.users` é de LEITURA: dar `update` a ela abriria a tabela
 * inteira, `is_socio` incluído, e um sócio comprometido viraria todos os
 * sócios. A função da migration 129 recebe o id de um produto, escolhe um ramo
 * e mexe só nas colunas daquele ramo.
 *
 * O que ela invalida depois é a ficha E a lista: o acesso decide a posição da
 * pessoa no funil, então mexer aqui e não invalidar a lista deixaria o painel
 * mostrando o funil de antes até alguém recarregar a página.
 */
export function useDefinirAcesso(userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async ({
      produto,
      ativo,
      ate,
    }: {
      produto: ProdutoEditavel['id'];
      ativo: boolean;
      /** `YYYY-MM-DD`, ou nulo para sem prazo. */
      ate: string | null;
    }) => {
      const { error } = await createClient().rpc('crm_definir_acesso', {
        p_user_id: userId!,
        p_produto: produto,
        p_ativo: ativo,
        // O dia vira o FIM do dia, e não a meia-noite: "libera até 12/10"
        // querendo dizer que no dia 12 a pessoa ainda entra. Com a meia-noite,
        // o acesso morre na virada do 11 para o 12 e o sócio não entende por quê.
        p_ate: ate ? new Date(`${ate}T23:59:59`).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarFicha(fila, userId),
  });
}

/**
 * Começar ou encerrar o teste gratuito de sete dias.
 *
 * Função à parte no banco, e mutação à parte aqui, porque o teste NÃO é status
 * de assinatura: é um carimbo de início de onde se contam sete dias. Enfiar ele
 * na mutação de cima como um quarto produto convidaria a implementá-lo como
 * `status = 'premium'`, que dá acesso para sempre com cara de teste.
 */
export function useDefinirTeste(userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async (ligado: boolean) => {
      const { error } = await createClient().rpc('crm_definir_teste_do_futebol', {
        p_user_id: userId!,
        p_ligado: ligado,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarFicha(fila, userId),
  });
}

function invalidarFicha(fila: ReturnType<typeof useQueryClient>, userId: string | undefined) {
  fila.invalidateQueries({ queryKey: ['socios', 'pessoa', userId ?? ''] });
  // A linha do tempo também: as duas funções gravam um registro de acesso lá,
  // e sem isto o sócio salva e não vê nada acontecer.
  fila.invalidateQueries({ queryKey: ['socios', 'linha-do-tempo', userId ?? ''] });
  // E a lista, porque o acesso decide a posição da pessoa no funil.
  fila.invalidateQueries({ queryKey: ['socios', 'cadastros'] });
}
