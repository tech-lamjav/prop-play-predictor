-- 20260905180000_119_futebol_vitrine_com_data
--
-- O mercado escondido voltava à tela no dia seguinte.
--
-- A 116 tirou o `asian_handicap` da vitrine e guardou `oculto_desde` justamente
-- para separar o antes do depois. Só que a leitura (`get_futebol_mercados_ocultos`)
-- devolve `text[]` — o nome do mercado e mais nada. A data ficava no banco, sem
-- chegar em quem decide o que aparece.
--
-- Sem a data, o painel só sabia esconder no PRESENTE. O histórico é o registro
-- do que foi publicado e visto, e não filtra de propósito: esconder ali
-- reescreveria o passado de quem apostou no Handicap enquanto ele estava na
-- prateleira. Correto — para as linhas anteriores ao corte.
--
-- Para as posteriores, não: elas nunca estiveram na tela. Medido em produção em
-- 05/09/2026, com o corte em 01/09:
--
--   antes do corte    23 linhas de Handicap em 19 jogos   (publicadas e vistas)
--   depois do corte   31 linhas de Handicap em 14 jogos   (nunca exibidas)
--
-- As 23 são exatamente as que motivaram esconder o mercado (ver a 116). As 31
-- são fantasma, e já são MAIS que o registro real. O efeito visível é o pior
-- possível de explicar: o jogo de hoje não mostra Handicap, e amanhã o mesmo
-- jogo mostra — porque no dia seguinte a linha passa a vir do histórico.
--
-- ⚠️ POR QUE UMA SEGUNDA RPC, E NÃO MUDAR A PRIMEIRA
-- `get_futebol_mercados_ocultos()` continua como está porque os dois
-- consumidores de notificação (Telegram) só olham o board — presente e futuro,
-- sempre depois do corte — e para eles a lista de nomes basta. Trocar o tipo de
-- retorno obrigaria a mexer em três runtimes por causa de um deles.
--
-- Conferência depois de aplicar:
--   select * from public.get_futebol_vitrine();
--   -- espera asian_handicap com oculto_desde 2026-09-01 00:00:00+00

create or replace function public.get_futebol_vitrine()
returns table (market text, oculto_desde timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  select o.market, o.oculto_desde
    from public.futebol_mercados_ocultos o
   where o.oculto
   order by o.market;
$function$;

comment on function public.get_futebol_vitrine() is
  'Mercados fora da vitrine COM a data de corte. A data é o que separa a linha que foi publicada e vista da que nunca esteve na tela.';

grant execute on function public.get_futebol_vitrine() to anon, authenticated, service_role;
