import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { EstadoDoPainel } from '@/components/socios/PainelCrm';
import type { Cadastro } from '@/components/socios/crm-lista';

/**
 * Os campos que a lista usa, e só eles.
 *
 * Trazer a linha inteira carregaria token de sincronia do WhatsApp e
 * identificador do Stripe para dentro do navegador sem nenhuma tela precisar
 * deles. A lista é escrita à mão de propósito: `select('*')` cresce sozinho
 * toda vez que alguém acrescenta uma coluna sensível na tabela.
 *
 * O `satisfies` é o que impede a lista de divergir do tipo em silêncio: pedir
 * uma coluna a menos do que o `Cadastro` promete vira erro de tipo aqui, e não
 * um campo `undefined` aparecendo na tela.
 */
const CAMPOS = [
  'id',
  'name',
  'email',
  'whatsapp_number',
  'created_at',
  'betinho_subscription_status',
  'futebol_subscription_status',
  'analytics_subscription_status',
] as const satisfies readonly (keyof Cadastro)[];

/**
 * Teto de linhas.
 *
 * A base tinha 603 contas no retrato de julho, então isto sobra. Quando faltar,
 * quem avisa é a tela: a consulta pede a contagem exata junto, e o painel
 * compara o total com o que recebeu. Um teto silencioso faria a lista parar num
 * dia antigo com os contadores contando só a fatia.
 */
const TETO = 5000;

/**
 * A base inteira, do cadastro mais novo para o mais velho.
 *
 * Vem tudo de uma vez, e é decisão consciente: com essa ordem de grandeza,
 * filtrar e agrupar em memória é instantâneo, e uma busca que fosse ao servidor
 * a cada tecla seria mais código e mais lenta.
 *
 * Quem não é sócio recebe só a própria linha aqui, por causa da política que
 * existe desde a migration 005. Não é erro: é a política funcionando. A tela
 * nunca chega a esse ponto porque o portão a segura antes.
 */
export function useCadastros(): EstadoDoPainel {
  const consulta = useQuery({
    queryKey: ['socios', 'cadastros'],
    queryFn: async () => {
      const { data, count, error } = await createClient()
        .from('users')
        .select(CAMPOS.join(', '), { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(TETO);
      if (error) throw error;
      const cadastros = (data ?? []) as unknown as Cadastro[];
      return { cadastros, totalNaBase: count ?? cadastros.length };
    },
    staleTime: 60 * 1000,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronto', ...consulta.data };
}
