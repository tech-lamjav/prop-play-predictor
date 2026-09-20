/**
 * A mesma pessoa nas três pontas.
 *
 * O contrato é simples e já estava quase de pé: o `distinct_id` é sempre o
 * `auth.users.id` do Supabase. O front já chamava `identify(user.id)` nos dois
 * formulários de login e no retorno do OAuth; o backend já usava `user_id` como
 * `distinctId`; e os dois são o MESMO número, porque `public.users.id` é o id do
 * auth (a RLS da tabela é `auth.uid() = id`).
 *
 * Faltavam as duas pontas soltas, e são elas que este gancho fecha:
 *
 *  1. Sessão restaurada. Quem volta ao site com sessão válida não passa por
 *     nenhum dos três pontos de login, então nada chamava `identify`. O
 *     `distinct_id` sobrevivia no cookie do PostHog — até o dia em que não
 *     sobrevive (cookie limpo, outro navegador), e aí a pessoa vira um anônimo
 *     novo que nunca mais se liga à conta.
 *
 *  2. Logout. NÃO existia `posthog.reset()` em lugar nenhum do frontend. Sem
 *     ele o navegador continua carimbado com quem saiu: num computador
 *     compartilhado, tudo o que a próxima pessoa faz antes de entrar é creditado
 *     à conta anterior.
 *
 * Não identifica a cada render: a `ref` guarda quem já foi identificado nesta
 * montagem, e só a TROCA de pessoa dispara.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { esquecerPessoa, identificar } from '@/lib/analytics';

export function useIdentidadeAnalytics(): void {
  const { user, isLoading } = useAuth();
  const ultimoId = useRef<string | null>(null);

  useEffect(() => {
    // Enquanto a sessão não resolveu, `user` é nulo por desconhecimento e não
    // por ausência. Resetar aqui apagaria a identidade de quem está logado toda
    // vez que a página carrega.
    if (isLoading) return;

    const idAtual = user?.id ?? null;
    if (idAtual === ultimoId.current) return;

    if (idAtual) {
      // Sem e-mail nem nome: o `distinct_id` já identifica, e o `identify` dos
      // pontos de login continua enviando as propriedades de pessoa que os
      // painéis atuais usam. Repeti-las aqui só multiplicaria o dado pessoal.
      identificar(idAtual);
    } else if (ultimoId.current !== null) {
      // Só quando havia alguém: a primeira passada com `null` é o estado
      // inicial de um visitante anônimo, e resetar ali jogaria fora a ligação
      // com o que ele fez antes de se cadastrar.
      esquecerPessoa();
    }

    ultimoId.current = idAtual;
  }, [user?.id, isLoading]);
}
