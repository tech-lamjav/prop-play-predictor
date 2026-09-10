import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';

/**
 * Traduz o identificador do autor no nome dele.
 *
 * A tabela guarda o identificador, e identificador não é resposta — numa lista
 * que existe para saber quem falou com quem, o nome é o dado.
 *
 * Nome parecido com `use-socio`, que responde outra pergunta ("eu sou sócio?").
 * Este devolve uma FUNÇÃO porque quem chama tem uma lista de identificadores na
 * mão e quer o nome de cada um, sem precisar carregar o mapa inteiro.
 *
 * São duas ou três linhas, então a consulta fica em cache por meia hora.
 */
export function useNomeDoSocio(): (id: string | null) => string {
  const consulta = useQuery({
    queryKey: ['socios', 'nomes'],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('users')
        .select('id, name, email')
        .eq('is_socio', true);
      if (error) throw error;
      const nomes: Record<string, string> = {};
      for (const s of data ?? []) nomes[s.id] = s.name ?? s.email;
      return nomes;
    },
    staleTime: 30 * 60 * 1000,
  });

  return (id) => {
    if (!id) return 'sem autor';
    // Enquanto os nomes não chegam, reticências. Devolver "outro sócio" aqui
    // afirmaria que o autor não é sócio — inclusive para quem acabou de
    // escrever, que está olhando a própria anotação.
    if (!consulta.data) return '…';
    // Autor que não está na lista pode ser alguém que perdeu o acesso. Sumir
    // com o registro seria pior que dizer que não sabemos o nome.
    return consulta.data[id] ?? 'outro sócio';
  };
}
