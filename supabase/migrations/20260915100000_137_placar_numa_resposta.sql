-- ============================================================================
-- 137 — o placar da metodologia numa resposta só
-- ============================================================================
-- A RPC da 133/134 devolve uma linha por oportunidade, e a API do Supabase
-- corta resposta de várias linhas em 1.000 (max_rows). O período padrão do
-- placar passa de 3.000 linhas, e a RPC ordena do jogo mais distante para o
-- mais antigo: cortada, a tela recebia só jogos por jogar e dizia que nada
-- tinha liquidado. Em staging não aparecia, porque lá o limite é 5.000.
--
-- Esta função devolve as MESMAS linhas, na mesma ordem, como um único jsonb. Um
-- valor escalar não passa pelo corte de linhas, e a consulta roda uma vez.
--
-- Ela lê a função da 134 em vez de repetir a consulta: a regra da foto de
-- nascimento continua morando num lugar só. A de linhas fica viva também porque
-- o front que já está no ar a chama até o deploy novo sair — o banco e a Vercel
-- publicam separados.
--
-- Idempotente de propósito: ela pode ser aplicada à mão em staging antes do
-- merge, e o `db push` do deploy roda de novo sem quebrar.
-- ============================================================================

create or replace function public.get_futebol_placar_da_metodologia(
  p_de date,
  p_ate date
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  -- O porteiro se repete aqui, e não só na função de dentro: quem lê esta
  -- função sozinha precisa ver que ela é restrita, sem ter de abrir a outra.
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  return coalesce(
    (
      select jsonb_agg(to_jsonb(o) order by o.kickoff_utc desc, o.score desc, o.opportunity_key)
      from public.get_futebol_oportunidades_publicadas(p_de, p_ate) o
    ),
    '[]'::jsonb
  );
end;
$function$;

revoke execute on function public.get_futebol_placar_da_metodologia(date, date) from public;
grant execute on function public.get_futebol_placar_da_metodologia(date, date) to authenticated;

comment on function public.get_futebol_placar_da_metodologia(date, date) is
  'O placar da metodologia numa resposta só: as linhas de get_futebol_oportunidades_publicadas como um jsonb, para não passar pelo corte de 1.000 linhas da API. Restrita a sócio.';
