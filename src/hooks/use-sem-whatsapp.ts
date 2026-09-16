import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import { CHAVES } from './crm-chaves';

/**
 * Quem o sócio marcou na mão como "não dá para falar por WhatsApp".
 *
 * ⚠️ Esta consulta traz só a marca MANUAL. A automática — quem não tem número
 * que abra conversa — não mora no banco, porque ela já está no próprio
 * cadastro: gravar seria manter uma cópia que envelhece sozinha no dia em que a
 * pessoa cadastrar um número.
 *
 * A marca manual existe para o caso que o cadastro não consegue enxergar: o
 * número está lá, bem formado, e não é da pessoa — ou não existe mais.
 */
/**
 * Três estados, como nas outras consultas do painel.
 *
 * Carregando e erro não podem virar conjunto vazio na mesma porta: vazio quer
 * dizer "ninguém foi marcado", e é uma afirmação. Quem chama decide o que fazer
 * com o erro — no painel, ele continua escondendo pelo número e DIZ que as
 * marcas não chegaram.
 */
export type EstadoDasMarcas =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; marcados: ReadonlySet<string> };

/**
 * As marcas de todo mundo, numa consulta só.
 *
 * Como as etapas: a tabela só tem linha de quem foi marcado, então ela é sempre
 * menor que a base — e a lista precisa das marcas de todos ao mesmo tempo para
 * poder esconder quem não dá para abordar.
 */
export function useMarcasSemWhatsApp(): EstadoDasMarcas {
  const consulta = useQuery({
    queryKey: CHAVES.semWhatsApp,
    queryFn: async (): Promise<ReadonlySet<string>> => {
      const { data, error } = await createClient().from('crm_sem_whatsapp').select('user_id');
      if (error) throw error;
      return new Set((data ?? []).map((l) => l.user_id));
    },
    staleTime: 60 * 1000,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronto', marcados: consulta.data };
}

/**
 * Marca ou desmarca uma pessoa.
 *
 * Passa pela função do banco, e não por um insert daqui, pelo mesmo motivo da
 * etapa: a marca e o registro na linha do tempo precisam acontecer juntos. E o
 * autor é carimbado com `auth.uid()` lá dentro — quem marcou não é coisa que o
 * cliente deva poder dizer.
 *
 * Desmarcar é do mesmo tamanho que marcar: quem classificou errado tem de
 * conseguir desfazer sem pedir para ninguém.
 */
export function useMarcarSemWhatsApp(userId: string | undefined) {
  const fila = useQueryClient();

  return useMutation({
    mutationFn: async (marcado: boolean) => {
      const { error } = await createClient().rpc('crm_marcar_sem_whatsapp', {
        p_user_id: userId!,
        p_marcado: marcado,
      });
      if (error) throw error;
      return marcado;
    },
    onSuccess: () => {
      // A mesma marca esconde o lead da lista e desenha o selo na ficha, e o
      // registro entra na linha do tempo: as três telas precisam saber.
      fila.invalidateQueries({ queryKey: CHAVES.semWhatsApp });
      if (userId) fila.invalidateQueries({ queryKey: CHAVES.linhaDoTempo(userId) });
    },
  });
}
