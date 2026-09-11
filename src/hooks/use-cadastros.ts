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
 * ⚠️ `Record<keyof Cadastro, true>`, e NÃO um array com `satisfies`. Este
 * arquivo já teve a versão com array, e ela deixou passar quatro colunas: o
 * `satisfies readonly (keyof Cadastro)[]` valida cada item da lista e nunca a
 * completude dela, então pedir oito de doze passava calado. O que chegava à
 * tela eram quatro campos `undefined`, e a consequência era o degrau "Em teste"
 * ficar em zero para sempre e o gancho da lista discordar do gancho da ficha
 * sobre a mesma pessoa.
 *
 * Com o objeto, faltar uma coluna vira erro de compilação aqui. É a mesma forma
 * que `use-pessoa.ts` usa, e foi por isso que a ficha nunca teve o problema.
 */
const MAPA_DE_CAMPOS: Record<keyof Cadastro, true> = {
  id: true,
  name: true,
  email: true,
  whatsapp_number: true,
  created_at: true,
  betinho_subscription_status: true,
  futebol_subscription_status: true,
  analytics_subscription_status: true,
  // Os quatro do gancho e da posição calculada. Sem eles, `posicaoDe` pergunta
  // pelo teste do futebol com `undefined` na mão.
  telegram_synced: true,
  subscription_product_type: true,
  futebol_trial_started_at: true,
  futebol_publication_alerts_ack_at: true,
};

const CAMPOS = Object.keys(MAPA_DE_CAMPOS) as (keyof Cadastro)[];

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
