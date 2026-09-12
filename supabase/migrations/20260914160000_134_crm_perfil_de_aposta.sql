-- 20260914160000_134_crm_perfil_de_aposta
--
-- Como uma pessoa aposta, para o sócio estudar os power users.
--
-- ⚠️ A TABELA `bets` CONTINUA FECHADA. Esta função é `security definer` e
-- devolve SÓ AGREGADO: nenhuma linha de aposta, nenhuma descrição, nenhum
-- `raw_input`, nenhuma odd individual. A decisão de não dar policy de select em
-- `bets` ao sócio está na migration 124 e continua de pé — dar policy abriria a
-- aposta linha a linha, com o texto cru que a pessoa mandou no Telegram dentro.
-- Há teste que reprova coluna proibida no corpo desta função.
--
-- ⚠️ TAGS FICAM DE FORA, e é decisão, não esquecimento. Tag é texto livre que a
-- pessoa escreve para si, e na prática carrega nome de tipster, "tilt",
-- "recuperação", nome de grupo pago. É o campo mais indiscreto do conjunto,
-- mais que mercado ou valor, e não muda nenhuma conversa comercial.
--
-- ## Por que existe, com os números na mesa
--
-- 110 pessoas já apostaram na história toda; seis apostaram nos últimos trinta
-- dias; sete concentram 78% de todas as apostas. Eu levei ao Victor que um ROI
-- por pessoa seria estatisticamente vazio para quase todos, e a resposta foi
-- que é justamente por isso que vale: são os sete que interessam estudar, e o
-- perfil de aposta deles é o que ensina sobre o produto.
--
-- Por isso a função devolve o N junto de cada número. "Over/Under" sozinho
-- mente; "Over/Under, 2 de 3" se explica.
--
-- ## A regra de lucro está escrita pela TERCEIRA vez
--
-- A fonte da verdade é `profitForBet`, em `src/utils/dashboardAggregations.ts`.
-- A migration 086 já a replicou em SQL para o resumo semanal do Telegram, e
-- esta é a terceira cópia. Não há como evitar: o navegador não roda Postgres e
-- o Postgres não importa TypeScript.
--
-- O `CASE` abaixo é copiado da 086 caractere a caractere, de propósito, e há um
-- teste que lê os três arquivos e cobra que os casos de status sejam os mesmos.
-- Se divergirem, o CRM mostra um ROI diferente do que o próprio usuário vê na
-- tela dele — e o sócio abre uma conversa com o número errado na mão.
--
-- Conferência depois de aplicar, logado como sócio:
--   select * from public.crm_perfil_de_aposta('<uuid>');

create or replace function public.crm_perfil_de_aposta(p_user_id uuid)
returns table (
  total bigint,
  liquidadas bigint,
  primeira timestamptz,
  ultima timestamptz,
  apostado numeric,
  lucro numeric,
  por_esporte jsonb,
  por_mercado jsonb,
  por_faixa_de_odd jsonb
)
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
  with apostas as (
    select
      b.status,
      b.odds::numeric as odd,
      b.stake_amount::numeric as stake,
      b.bet_date,
      -- Nulo e string vazia caem no mesmo balde. As duas ocorrem: a coluna é
      -- texto livre sem restrição, e a 086 já trata assim.
      coalesce(nullif(b.sport, ''), 'Outros')::text as esporte,
      coalesce(nullif(b.betting_market, ''), 'Outros')::text as mercado,
      b.status in ('won', 'lost', 'cashout', 'half_won', 'half_lost', 'void') as liquidada,
      -- profitForBet (src/utils/dashboardAggregations.ts) — fonte de verdade do app
      case b.status
        when 'won'       then b.potential_return - b.stake_amount
        when 'lost'      then -b.stake_amount
        when 'cashout'   then (case when b.cashout_amount is not null then b.cashout_amount - b.stake_amount else 0 end)
        when 'half_won'  then (b.stake_amount + b.potential_return) / 2.0 - b.stake_amount
        when 'half_lost' then b.stake_amount / 2.0 - b.stake_amount
        else 0  -- void e pending
      end::numeric as profit
    from public.bets b
    where b.user_id = p_user_id
  ),
  -- Os agregados de dinheiro contam só liquidada. Somar stake de `pending` no
  -- denominador do ROI é dividir lucro por aposta que ainda não terminou, e
  -- cerca de 72% da base fica em `pending` para sempre: o ROI sairia diluído a
  -- ponto de não significar nada.
  fechadas as (select * from apostas where liquidada),

  /*
   * Cada recorte devolve o N junto, e não só o nome do campeão.
   *
   * "Aposta mais em Over/Under" sozinho é uma frase que mente quando a pessoa
   * tem três apostas. Com o N, a tela consegue dizer "2 de 3" e quem lê decide
   * se aquilo é perfil ou coincidência.
   *
   * Cinco por recorte: passa disso e vira lista, e lista não é perfil.
   */
  esportes as (
    select jsonb_agg(x order by x->>'lucro' desc) as j from (
      select jsonb_build_object(
               'nome', a.esporte,
               'n', count(*),
               'apostado', coalesce(sum(a.stake) filter (where a.liquidada), 0),
               'lucro', coalesce(sum(a.profit), 0)
             ) as x
      from apostas a group by a.esporte order by count(*) desc limit 5
    ) t
  ),
  mercados as (
    select jsonb_agg(x) as j from (
      select jsonb_build_object(
               'nome', a.mercado,
               'n', count(*),
               'apostado', coalesce(sum(a.stake) filter (where a.liquidada), 0),
               'lucro', coalesce(sum(a.profit), 0)
             ) as x
      from apostas a group by a.mercado order by count(*) desc limit 5
    ) t
  ),
  /*
   * As faixas de odd são as mesmas do painel de apostas do próprio usuário
   * (`aggregateOddsDistribution`, em `src/utils/dashboardAggregations.ts`), e
   * isso não é capricho: o sócio e o assinante precisam ver o mesmo recorte,
   * senão a conversa começa com os dois olhando gráficos diferentes.
   */
  faixas as (
    select jsonb_agg(x order by x->>'ordem') as j from (
      select jsonb_build_object(
               'ordem', min(f.ordem),
               'nome', f.faixa,
               'n', count(*),
               'apostado', coalesce(sum(a.stake) filter (where a.liquidada), 0),
               'lucro', coalesce(sum(a.profit), 0)
             ) as x
      from apostas a
      cross join lateral (
        select case
          when a.odd < 1.5  then 1 else case
          when a.odd < 2.0  then 2 else case
          when a.odd < 3.0  then 3 else case
          when a.odd < 5.0  then 4 else case
          when a.odd < 10.0 then 5 else 6 end end end end end as ordem,
          case
          when a.odd < 1.5  then 'até 1.50' else case
          when a.odd < 2.0  then '1.50 a 1.99' else case
          when a.odd < 3.0  then '2.00 a 2.99' else case
          when a.odd < 5.0  then '3.00 a 4.99' else case
          when a.odd < 10.0 then '5.00 a 9.99' else '10.00 ou mais' end end end end end as faixa
      ) f
      group by f.faixa
    ) t
  )
  select
    (select count(*) from apostas),
    (select count(*) from fechadas),
    (select min(a.bet_date) from apostas a),
    (select max(a.bet_date) from apostas a),
    coalesce((select sum(f.stake) from fechadas f), 0),
    coalesce((select sum(f.profit) from fechadas f), 0),
    coalesce((select j from esportes), '[]'::jsonb),
    coalesce((select j from mercados), '[]'::jsonb),
    coalesce((select j from faixas), '[]'::jsonb);
end;
$function$;

comment on function public.crm_perfil_de_aposta(uuid) is
  'Perfil de aposta de uma pessoa, so agregado, so socio. Nenhuma linha de aposta sai daqui. Tags ficam de fora de proposito.';

-- Revoke antes do grant: funcao nova nasce executavel por PUBLIC, e PUBLIC
-- inclui o anon. Duas funcoes do repositorio esqueceram exatamente isto, e
-- estao na issue #408.
revoke execute on function public.crm_perfil_de_aposta(uuid) from public;
grant execute on function public.crm_perfil_de_aposta(uuid) to authenticated;
