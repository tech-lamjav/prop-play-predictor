import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { LinhaPublicada } from '@/components/placar/placar-agregacao';

export type EstadoDoPlacar =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; publicadas: LinhaPublicada[] };

/**
 * As oportunidades publicadas num período, com o placar do jogo.
 *
 * Traz a FOTO DE NASCIMENTO de cada uma — a odd, a nota e a faixa da publicação
 * —, que é o que o placar da metodologia julga (ADR 0003). A RPC é restrita a
 * sócio no banco: quem não é recebe erro, e a tela já está atrás do portão.
 *
 * A RPC devolve tudo que TOCA o período pelos dois eixos: jogo dentro do
 * intervalo, ou detecção dentro do intervalo. Quem escolhe o eixo é a tela, com
 * as duas datas na mão — são perguntas diferentes, e uma consulta serve as duas.
 *
 * Não liquida nada: o veredito sai da regra do site, no módulo de agregação.
 */
export function useOportunidadesPublicadas(de: string, ate: string): EstadoDoPlacar {
  const consulta = useQuery({
    queryKey: ['socios', 'placar', de, ate],
    queryFn: async () => {
      const { data, error } = await createClient().rpc('get_futebol_oportunidades_publicadas', {
        p_de: de,
        p_ate: ate,
      });
      if (error) throw error;
      return (data ?? []) as LinhaPublicada[];
    },
    // O histórico de um período passado não muda a cada minuto: o que muda é o
    // jogo de hoje liquidando. Cinco minutos é o suficiente para o sócio ver a
    // conta andar sem a tela consultar a cada clique de filtro.
    staleTime: 5 * 60 * 1000,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronto', publicadas: consulta.data };
}
