-- 20260911180000_127_crm_apostas_de_todos
--
-- O agregado de apostas de TODO MUNDO, de uma vez.
--
-- A migration 124 devolve o resumo de uma pessoa, e serve à ficha. A lista
-- precisa da mesma informação para todos ao mesmo tempo: o gancho é o que
-- separa quem veio pelo Betinho de quem veio pelo futebol, e sem ele a coluna
-- de gancho da tabela ficaria vazia — ou, pior, chamaria a função de uma
-- pessoa seiscentas vezes.
--
-- ⚠️ Continua sem devolver aposta nenhuma. Só a contagem e a data da última,
-- pelo mesmo motivo da 124: valor, odd, descrição e o texto cru que a pessoa
-- mandou no Telegram não têm por que sair da tabela.
--
-- Devolve só quem TEM aposta. Quem não tem simplesmente não aparece, e quem
-- chama trata a ausência como zero — mandar seiscentas linhas de zero pela rede
-- para dizer "nada aqui" é desperdício.
--
-- Conferência depois de aplicar, logado como sócio:
--   select * from public.crm_apostas_de_todos() order by total desc limit 5;

create or replace function public.crm_apostas_de_todos()
returns table (user_id uuid, total bigint, ultima timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  return query
    select b.user_id, count(*)::bigint, max(b.bet_date)
      from public.bets b
     where b.user_id is not null
     group by b.user_id;
end;
$function$;

comment on function public.crm_apostas_de_todos() is
  'Agregado de apostas por pessoa, para o gancho na lista do CRM. So socio. Nunca devolve a aposta em si.';

revoke execute on function public.crm_apostas_de_todos() from public;
grant execute on function public.crm_apostas_de_todos() to authenticated;
