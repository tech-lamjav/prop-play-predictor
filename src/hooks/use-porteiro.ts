import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

/**
 * O que o porteiro respondeu sobre este acesso.
 *
 * Spec na issue #548, ticket #550.
 *
 * A tela OBEDECE isto. Ela não lê cabeçalho, não consulta lista de faixas e não
 * refaz a conta de país — quem decide é o servidor, num lugar só. O motivo está
 * na spec: dois lugares decidindo o mesmo país acabam discordando, e aí o
 * bloqueio sai por um critério enquanto a prova sai por outro.
 */

export type OrigemObservada = 'brasil' | 'fora' | 'nao_sei';
export type Veredito = 'entrou' | 'barrado';

export interface RespostaDoPorteiro {
  readonly origem: OrigemObservada;
  readonly veredito: Veredito;
}

export interface EstadoDoPorteiro {
  /** Enquanto verdadeiro, ainda não se sabe. "Não sei" NUNCA é "não". */
  carregando: boolean;
  resposta: RespostaDoPorteiro | null;
}

/**
 * Uma chamada por carregamento de página, e não uma por tela.
 *
 * O cache é por pessoa porque o veredito depende de quem ela é — o sócio
 * atravessa. Sem a chave por pessoa, quem entrasse na conta depois da primeira
 * chamada ficaria com a resposta de visitante deslogado.
 *
 * Não usa `sessionStorage` de propósito: o que está guardado aqui é uma decisão
 * do servidor sobre ESTE momento, e recarregar a página é justamente quando
 * vale a pena perguntar de novo. Guardar entre recarregamentos deixaria uma
 * resposta velha mandando na tela.
 */
const emAndamento = new Map<string, Promise<RespostaDoPorteiro>>();

function perguntar(chave: string): Promise<RespostaDoPorteiro> {
  const existente = emAndamento.get(chave);
  if (existente) return existente;

  const promessa = supabase.functions
    .invoke<RespostaDoPorteiro>('porteiro')
    .then(({ data, error }) => {
      if (error || !data) throw error ?? new Error('porteiro não respondeu');
      return data;
    })
    .catch((erro) => {
      // Falha de rede não tranca ninguém. É a mesma escolha que o servidor faz,
      // pelo mesmo motivo: o que sobra aqui é defeito nosso, e trancar todo
      // mundo por causa de um defeito é pior do que deixar passar quem será
      // verificado no próximo carregamento.
      console.warn('[porteiro] não respondeu, deixando entrar:', erro);
      return { origem: 'nao_sei', veredito: 'entrou' } as const;
    });

  emAndamento.set(chave, promessa);
  return promessa;
}

export function usePorteiro(): EstadoDoPorteiro {
  const { user, isLoading } = useAuth();
  const [resposta, setResposta] = useState<RespostaDoPorteiro | null>(null);

  useEffect(() => {
    // Esperar a sessão resolver é o que impede a pergunta de sair como
    // visitante e depois valer para uma pessoa logada — inclusive para um
    // sócio, que seria barrado por meio segundo.
    if (isLoading) return;

    let vivo = true;
    void perguntar(user?.id ?? 'visitante').then((r) => {
      if (vivo) setResposta(r);
    });
    return () => {
      vivo = false;
    };
  }, [isLoading, user?.id]);

  return { carregando: isLoading || resposta === null, resposta };
}
