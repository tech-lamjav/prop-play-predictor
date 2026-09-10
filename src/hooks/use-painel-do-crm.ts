import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import type { Apostas, Toques } from '@/components/socios/crm-painel';

/**
 * Quando cada pessoa recebeu o último toque, e quantas apostas ela registrou.
 *
 * As duas coisas vêm juntas porque a tabela do painel precisa das duas em toda
 * linha, e separá-las em dois hooks faria a tela desenhar metade da informação
 * primeiro — a coluna "parado há" pulando de vazia para preenchida.
 *
 * Toque é o mais recente entre a última mudança de etapa e a última anotação.
 * As duas tabelas só têm linha de quem já foi tocado, então elas são sempre
 * menores que a base.
 */
export interface Movimento {
  toques: Toques;
  /** Nulo quando a contagem falhou. NÃO é o mesmo que ninguém ter apostado. */
  apostas: Apostas | null;
}

/**
 * Três estados, como nas outras consultas do painel.
 *
 * Falhar não pode virar mapa vazio: sem toque nenhum, todo mundo aparece como
 * nunca abordado, a fila de primeiro contato incha com gente que já foi
 * abordada, e "parado há N dias" passa a contar desde o cadastro. A tela
 * inteira mente e nada acusa.
 */
export type EstadoDoMovimento =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'pronto'; movimento: Movimento };

export function useMovimento(): EstadoDoMovimento {
  const consulta = useQuery({
    queryKey: ['socios', 'movimento'],
    queryFn: async (): Promise<Movimento> => {
      const cliente = createClient();

      const [etapas, anotacoes, apostas] = await Promise.all([
        cliente.from('crm_etapa').select('user_id, atualizada_em'),
        cliente.from('crm_anotacao').select('user_id, criada_em'),
        cliente.rpc('crm_apostas_de_todos'),
      ]);

      if (etapas.error) throw etapas.error;
      if (anotacoes.error) throw anotacoes.error;

      const toques: Toques = {};
      const maisRecente = (id: string, quando: string) => {
        const atual = toques[id];
        if (!atual || quando > atual) toques[id] = quando;
      };
      for (const e of etapas.data ?? []) maisRecente(e.user_id, e.atualizada_em);
      for (const a of anotacoes.data ?? []) maisRecente(a.user_id, a.criada_em);

      // A contagem de apostas pode falhar sozinha sem derrubar o resto: sem ela
      // o gancho perde um sinal, e a tabela continua útil. Derrubar a tela toda
      // por causa da coluna de gancho seria trocar um problema pequeno por um
      // grande.
      // A contagem de apostas pode falhar sozinha sem derrubar o resto: sem
      // ela o gancho perde um sinal e diz que perdeu. Derrubar a tela toda por
      // causa de uma coluna seria trocar um problema pequeno por um grande.
      let contagem: Apostas | null = null;
      if (!apostas.error) {
        contagem = {};
        for (const linha of apostas.data ?? []) contagem[linha.user_id] = Number(linha.total);
      }

      return { toques, apostas: contagem };
    },
    staleTime: 60 * 1000,
  });

  if (consulta.isError) return { tipo: 'erro' };
  if (consulta.data === undefined) return { tipo: 'carregando' };
  return { tipo: 'pronto', movimento: consulta.data };
}
