import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { EstadoDaFicha } from '@/components/socios/Ficha';
import type { Pessoa, ResumoDeApostas } from '@/components/socios/crm-ficha';

/**
 * Os campos da ficha, e só eles.
 *
 * Mais largo que o da lista, e ainda assim escrito à mão: o token de sincronia
 * do WhatsApp e o identificador do Stripe continuam fora, porque nenhuma tela
 * precisa deles e `select('*')` os traria de graça.
 *
 * O mapa é `Record<keyof Pessoa, true>` de propósito, e não um array: um objeto
 * com esse tipo obriga a listar TODA chave da `Pessoa`, então esquecer uma
 * coluna vira erro de tipo aqui. Com um array, mesmo com `satisfies`, faltar
 * coluna passa batido e o campo chega `undefined` na tela.
 */
const MAPA_DE_CAMPOS: Record<keyof Pessoa, true> = {
  id: true,
  name: true,
  email: true,
  whatsapp_number: true,
  created_at: true,
  betinho_subscription_status: true,
  futebol_subscription_status: true,
  analytics_subscription_status: true,
  telegram_username: true,
  telegram_synced: true,
  subscription_product_type: true,
  betinho_subscription_period_end: true,
  analytics_subscription_period_end: true,
  futebol_trial_started_at: true,
  futebol_publication_alerts_ack_at: true,
  has_report_access: true,
};

const CAMPOS = Object.keys(MAPA_DE_CAMPOS).join(', ');

/** Sem linha encontrada. O PostgREST devolve este código no `single()`. */
const NAO_ENCONTRADO = 'PGRST116';

/**
 * A ficha de uma pessoa.
 *
 * São duas leituras: a linha da tabela de usuários, que a política do sócio
 * libera, e o agregado de apostas, que vem por função porque a tabela `bets`
 * continua fechada — a ficha precisa saber SE a pessoa registrou aposta, nunca
 * o que ela apostou.
 *
 * As apostas falharem não derruba a ficha, mas TAMBÉM não viram zero. A função
 * do banco levanta exceção para quem não é sócio, e engolir esse erro faria a
 * ficha dizer "não deu sinal nenhum" com a cara de quem tinha conferido. O nulo
 * atravessa até a tela, que avisa que o palpite está incompleto.
 */
export function usePessoa(id: string | undefined): EstadoDaFicha {
  const consulta = useQuery({
    queryKey: ['socios', 'pessoa', id ?? ''],
    enabled: !!id,
    queryFn: async () => {
      const cliente = createClient();

      const { data, error } = await cliente.from('users').select(CAMPOS).eq('id', id!).single();

      if (error) {
        if (error.code === NAO_ENCONTRADO) return null;
        throw error;
      }

      const { data: resumo, error: erroDasApostas } = await cliente.rpc('crm_resumo_de_apostas', {
        p_user_id: id!,
      });

      const apostas: ResumoDeApostas | null = erroDasApostas
        ? null
        : resumo?.[0]
          ? { total: Number(resumo[0].total), ultima: resumo[0].ultima }
          : { total: 0, ultima: null };

      return { pessoa: data as unknown as Pessoa, apostas };
    },
    staleTime: 60 * 1000,
  });

  // Rota sem parâmetro não é falha de carregamento: é endereço que não aponta
  // para ninguém, e "não deu para carregar agora" mentiria sobre isso.
  if (!id) return { tipo: 'nao-encontrada' };
  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  if (consulta.data === null) return { tipo: 'nao-encontrada' };
  return { tipo: 'pronta', ...consulta.data };
}
