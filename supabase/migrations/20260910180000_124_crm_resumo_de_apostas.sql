-- 20260910180000_124_crm_resumo_de_apostas
--
-- Quantas apostas uma pessoa registrou, para o gancho da ficha.
--
-- O gancho do CRM (`src/components/socios/CONTEXT.md`) é o palpite sobre o que
-- atraiu a pessoa. O sinal mais forte que o banco tem é uso de verdade: quem
-- registrou aposta veio pelo Betinho, mesmo que o plano diga outra coisa. Foi
-- exatamente o caso que originou o CRM — um assinante do Essencial cujo olho
-- brilhou no Betinho.
--
-- ⚠️ POR QUE UMA FUNÇÃO, E NÃO UMA POLÍTICA EM `bets`
-- Dar ao sócio uma policy de select em `bets` abriria a aposta LINHA A LINHA:
-- valor, odd, descrição, o texto cru que a pessoa mandou no Telegram. A ficha
-- não precisa de nada disso — precisa de "registrou?" e "quando foi a última?".
-- A função devolve só o agregado, e a tabela continua fechada.
--
-- Conferência depois de aplicar, logado como sócio:
--   select * from public.crm_resumo_de_apostas('<uuid de alguém>');

create or replace function public.crm_resumo_de_apostas(p_user_id uuid)
returns table (total bigint, ultima timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  -- O portão vai DENTRO da função porque ela roda como dono do banco: sem esta
  -- linha, qualquer pessoa logada contaria as apostas de qualquer outra só
  -- sabendo o identificador.
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  return query
    select count(*)::bigint, max(b.bet_date)
      from public.bets b
     where b.user_id = p_user_id;
end;
$function$;

comment on function public.crm_resumo_de_apostas(uuid) is
  'Agregado de apostas de uma pessoa, para o gancho da ficha do CRM. Só sócio. Nunca devolve a aposta em si.';

-- Revoke antes do grant, mesmo motivo da 123: funcao nova nasce executavel por
-- PUBLIC, e PUBLIC inclui o anon.
revoke execute on function public.crm_resumo_de_apostas(uuid) from public;
grant execute on function public.crm_resumo_de_apostas(uuid) to authenticated;
