-- 20260917140000_147_futebol_vigencia_do_limiar
--
-- Mudar o limiar do corte nao pode reescrever o passado.
--
-- `futebol_limiar_valor` (migration 144) tem duas colunas que precisam andar
-- juntas: `limiar` e `vigente_desde`. A segunda e o que faz o corte valer de uma
-- data em diante, e e ela que impede o historico de esconder linha que ja foi
-- exibida ao assinante. E a licao da 119.
--
-- Nada obrigava as duas a mudarem juntas. Um `update` so no limiar passava, e
-- reescrevia o passado nos DOIS sentidos:
--
--   apertar   (-0,02 -> 0)      somem do historico e do placar as linhas entre
--                               -2% e 0 desde 16/09 -- linhas que foram vistas
--   afrouxar  (-0,02 -> -0,04)  voltam linhas que nunca estiveram na tela
--
-- A regra de mudar as duas juntas estava escrita num comentario da 144.
-- Comentario nao segura UPDATE. Mesmo gatilho e mesmo motivo da 145: o passo
-- manual a mais e o que se esquece no dia, e o esquecimento e silencioso.
--
-- ⚠️ CARIMBA SO QUANDO O VALOR MUDA, e nao quando a coluna e apenas mencionada.
-- `update ... set limiar = -0.02` com o mesmo -0.02 nao e mudanca de regua: se
-- carimbasse, empurraria a data de corte para frente e esconderia linhas
-- passadas -- o proprio defeito que esta migration existe para fechar, entrando
-- por outra porta. O gatilho da 145 tem o mesmo cuidado (`old.oculto and not
-- new.oculto`), e aqui ele vale em dobro, porque reaplicar a semente da 144 e
-- exatamente o tipo de comando que alguem roda duas vezes.
--
-- ⚠️ UMA VIGENCIA POR MERCADO. Mudar o limiar joga fora a regua anterior: o
-- historico passa a julgar tudo pelo limiar novo desde a data nova, e o periodo
-- anterior fica sem regua propria. Aceito enquanto o limiar for um so por
-- mercado e mudar raramente. Se virar rotina, isto vira tabela de vigencias, e
-- ai o historico escolhe a regua pela data da LINHA.
--
-- ⚠️ O FALLBACK DO CODIGO NAO VEM JUNTO, E ISSO E RELEASE, NAO UPDATE.
-- `CORTE_FALLBACK` existe em duas copias, `src/utils/futebol-corte-de-valor.ts` e
-- `supabase/functions/shared/corte-de-valor.ts`, com guarda de paridade entre
-- elas, e carrega o limiar embutido para quando o banco nao responde. Mudar o
-- limiar aqui sem mudar as duas copias faz a falha de leitura aplicar o corte
-- VELHO -- e o painel e a DM passam a discordar do banco exatamente na janela em
-- que ninguem esta olhando.
--
-- Conferencia depois de aplicar:
--
--   -- 1) update so no limiar: a vigencia anda sozinha
--   update public.futebol_limiar_valor set limiar = -0.03 where market = 'asian_handicap';
--   select market, limiar, vigente_desde from public.futebol_limiar_valor;
--   -- espera vigente_desde = agora
--
--   -- 2) update com data explicita: o valor dado vence
--   update public.futebol_limiar_valor
--      set limiar = -0.02, vigente_desde = timestamptz '2026-09-16 00:00:00-03'
--    where market = 'asian_handicap';
--   -- espera vigente_desde = 16/09/2026 00:00 BRT, e limiar de volta a -0,02

-- ── O gatilho ───────────────────────────────────────────────────────────────
create or replace function public.futebol_limiar_valor_vigencia()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- Valor igual nao e mudanca de regua: sai sem carimbar.
  if new.limiar is not distinct from old.limiar then
    return new;
  end if;
  -- Carimba so quando a vigencia NAO veio explicita na mesma instrucao. Mesmo
  -- `is not distinct from` da 145: quem quiser datar a mudanca de proposito --
  -- uma correcao retroativa combinada -- continua podendo.
  if new.vigente_desde is not distinct from old.vigente_desde then
    new.vigente_desde := now();
  end if;
  return new;
end;
$function$;

-- Funcao de gatilho nao e chamada por ninguem de fora, e nasce executavel por
-- PUBLIC como qualquer outra (issue #408).
revoke execute on function public.futebol_limiar_valor_vigencia() from public;
-- No Supabase o schema public da EXECUTE explicito a anon e authenticated em toda
-- funcao nova (privilegio padrao), e o revoke de PUBLIC nao tira isso.
revoke execute on function public.futebol_limiar_valor_vigencia() from anon, authenticated;
grant execute on function public.futebol_limiar_valor_vigencia() to service_role;

drop trigger if exists futebol_limiar_valor_vigencia on public.futebol_limiar_valor;
create trigger futebol_limiar_valor_vigencia
  before update of limiar on public.futebol_limiar_valor
  for each row execute function public.futebol_limiar_valor_vigencia();
