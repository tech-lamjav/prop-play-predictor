-- 20260914220000_145_futebol_vitrine_com_periodo
--
-- O mercado que volta à vitrine não pode trazer junto o que nunca esteve nela.
--
-- A 116 criou a vitrine e a 119 deu a ela a data de saída (`oculto_desde`), para
-- o histórico parar de devolver no dia seguinte a linha escondida hoje. Mas a
-- 119 só resolve enquanto o mercado ESTÁ fora. A leitura filtra `where oculto`,
-- então no dia em que o mercado volta (`oculto = false`) ele some da vitrine
-- inteira — e o histórico passa a mostrar todas as linhas do período em que ele
-- esteve fora, que nunca foram exibidas a ninguém.
--
-- No handicap isso é concreto: a 119 mediu 31 linhas fantasma em quatro dias,
-- contra 23 reais. Religar o mercado semanas depois de 01/09 despejaria centenas
-- delas no histórico e no placar de uma vez.
--
-- A correção é guardar o FIM do período, e a vitrine devolver o período inteiro,
-- aberto ou fechado. Quem decide sobre o presente (board, catálogo, selo) olha só
-- o período aberto; quem decide sobre o passado (histórico, placar) olha os dois.
--
-- ⚠️ POR QUE GATILHO
-- Religar tem de continuar sendo um UPDATE de uma coluna. Um passo manual a mais
-- ("lembre de preencher oculto_ate") é exatamente o passo que é esquecido no dia,
-- e o esquecimento é silencioso: nada quebra, o histórico só passa a mentir. O
-- gatilho preenche; o check garante que ninguém grave um estado incoerente.
--
-- ⚠️ UM PERÍODO POR MERCADO
-- Esconder de novo um mercado que já voltou abre um período NOVO e sobrescreve o
-- anterior — as linhas do primeiro período voltam a aparecer no histórico. Aceito
-- enquanto esconder e religar for raro; se virar rotina, isto vira tabela de
-- períodos.
--
-- Conferência depois de aplicar:
--   select * from public.get_futebol_vitrine();
--   -- espera asian_handicap, oculto_desde 2026-09-01 00:00:00+00, oculto_ate null
--
-- Religar, quando for decidido (o gatilho preenche oculto_ate):
--   update public.futebol_mercados_ocultos set oculto = false where market = 'asian_handicap';

-- ── O fim do período ────────────────────────────────────────────────────────
alter table public.futebol_mercados_ocultos
  add column if not exists oculto_ate timestamptz;

-- Um mercado que já estivesse com `oculto = false` antes desta migration não tem
-- como saber quando voltou. `now()` é o menos errado: esconde a mais o intervalo
-- em que ele já estava na tela, em vez de mostrar tudo que nunca esteve.
update public.futebol_mercados_ocultos
   set oculto_ate = greatest(now(), oculto_desde + interval '1 second')
 where not oculto and oculto_ate is null;

alter table public.futebol_mercados_ocultos
  drop constraint if exists futebol_mercados_ocultos_periodo;
alter table public.futebol_mercados_ocultos
  add constraint futebol_mercados_ocultos_periodo check (
    (oculto and oculto_ate is null)
    or (not oculto and oculto_ate is not null and oculto_ate > oculto_desde)
  );

comment on column public.futebol_mercados_ocultos.oculto_ate is
  'Quando o mercado voltou à vitrine. Null enquanto está fora. Preenchido pelo gatilho ao virar oculto = false.';

-- ── O gatilho ───────────────────────────────────────────────────────────────
-- Datas explícitas no UPDATE são respeitadas; sem elas, vale o momento da troca.
create or replace function public.futebol_mercados_ocultos_periodo()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if old.oculto and not new.oculto then
    -- voltou à vitrine: fecha o período
    new.oculto_ate := coalesce(new.oculto_ate, now());
  elsif not old.oculto and new.oculto then
    -- saiu de novo: abre um período novo
    if new.oculto_desde is not distinct from old.oculto_desde then
      new.oculto_desde := now();
    end if;
    new.oculto_ate := null;
  end if;
  return new;
end;
$function$;

-- Função de gatilho não é chamada por ninguém de fora, e nasce executável por
-- PUBLIC como qualquer outra (issue #408).
revoke execute on function public.futebol_mercados_ocultos_periodo() from public;
-- No Supabase o schema public dá EXECUTE explícito a anon e authenticated em toda
-- função nova (privilégio padrão), e o revoke de PUBLIC não tira isso. Conferido em staging.
revoke execute on function public.futebol_mercados_ocultos_periodo() from anon, authenticated;
grant execute on function public.futebol_mercados_ocultos_periodo() to service_role;

drop trigger if exists futebol_mercados_ocultos_periodo on public.futebol_mercados_ocultos;
create trigger futebol_mercados_ocultos_periodo
  before update of oculto on public.futebol_mercados_ocultos
  for each row execute function public.futebol_mercados_ocultos_periodo();

-- ── A leitura, com o período inteiro ────────────────────────────────────────
-- DROP porque o tipo de retorno muda, e `create or replace` não troca colunas
-- de saída. Nada no banco depende desta função: o único consumidor é o painel,
-- que tolera a coluna nova. (O script de ROI lê a tabela direto, não a função.)
--
-- `get_futebol_mercados_ocultos` NÃO muda: as DMs só olham o presente, e para
-- elas o mercado que voltou está na tela.
drop function if exists public.get_futebol_vitrine();

create function public.get_futebol_vitrine()
returns table (market text, oculto_desde timestamptz, oculto_ate timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  select o.market, o.oculto_desde, o.oculto_ate
    from public.futebol_mercados_ocultos o
   where o.oculto or o.oculto_ate is not null
   order by o.market;
$function$;

comment on function public.get_futebol_vitrine() is
  'Períodos fora da vitrine, abertos (oculto_ate null) e fechados. O período é o que separa a linha que foi publicada e vista da que nunca esteve na tela.';

revoke execute on function public.get_futebol_vitrine() from public;
grant execute on function public.get_futebol_vitrine() to anon, authenticated, service_role;
