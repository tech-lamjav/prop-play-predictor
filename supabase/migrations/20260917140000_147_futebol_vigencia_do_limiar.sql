-- 20260917140000_147_futebol_vigencia_do_limiar
--
-- Mudar o limiar do corte de valor não pode reescrever o passado.
--
-- `futebol_limiar_valor` (migration 144) tem duas colunas que precisam andar
-- juntas: `limiar` e `vigente_desde`. A segunda é o que faz o corte valer de uma
-- data em diante, e é ela que impede o histórico de esconder linha que o
-- assinante já viu. É a lição da 119.
--
-- Nada obrigava as duas a mudarem juntas. Um `update` só no limiar passava, e
-- reescrevia o passado nos DOIS sentidos:
--
--   apertar   (-0,02 -> 0)      somem do histórico e do placar as linhas entre
--                               -2% e 0 desde 16/09 -- linhas que foram vistas
--   afrouxar  (-0,02 -> -0,04)  voltam linhas que nunca estiveram na tela
--
-- A regra de mudar as duas juntas estava escrita num comentário da 144.
-- Comentário não segura UPDATE. Mesmo gatilho e mesmo motivo da 145: o passo
-- manual a mais é o que se esquece no dia, e o esquecimento é silencioso.
--
-- ⚠️ CARIMBA SÓ QUANDO O VALOR MUDA, e não quando a coluna é apenas mencionada.
-- `update of` dispara por MENÇÃO: reescrever o mesmo -0,02 -- reexecutando o
-- comando anterior, ou por uma ferramenta que grava todas as colunas de volta --
-- empurraria a vigência para frente e esconderia linhas passadas, que é o
-- próprio defeito desta issue entrando por outra porta.
--
-- ⚠️ LIMITE CONHECIDO, e não tem conserto em gatilho de linha. O `is not
-- distinct from` é o mais perto que dá de "a coluna não veio no comando": o
-- plpgsql não distingue coluna AUSENTE do SET de coluna PRESENTE com o mesmo
-- valor. Então um update que muda o limiar E repete a vigência que já estava na
-- linha tem a data sobrescrita por `now()`. Herdado da 145, onde o caso não
-- aparecia porque lá a coluna saía de nulo. Para datar uma mudança de propósito,
-- passe uma vigência DIFERENTE da que está gravada.
--
-- ⚠️ UMA VIGÊNCIA POR MERCADO. Mudar o limiar joga fora a régua anterior: o
-- histórico passa a julgar tudo pelo limiar novo desde a data nova, e o período
-- anterior fica sem régua própria. Aceito enquanto o limiar for um só por
-- mercado e mudar raramente. Se virar rotina, isto vira tabela de vigências, e
-- aí o histórico escolhe a régua pela data da LINHA.
--
-- ⚠️ O FALLBACK DO CÓDIGO NÃO VEM JUNTO, E ISSO É RELEASE, NÃO UPDATE.
-- `CORTE_FALLBACK` existe em duas cópias, `src/utils/futebol-corte-de-valor.ts` e
-- `supabase/functions/shared/corte-de-valor.ts`, com guarda de paridade entre
-- elas, e carrega o limiar embutido para quando o banco não responde. Mudar o
-- limiar aqui sem mudar as duas cópias faz a falha de leitura aplicar o corte
-- VELHO -- e o painel e a DM passam a discordar do banco exatamente na janela em
-- que ninguém está olhando.
--
-- ⚠️ ISTO PROTEGE O PAINEL E O HISTÓRICO, NÃO A DM. A cópia do lado das
-- mensagens (`shared/corte-de-valor.ts`) lê só `market` e `limiar`, e descarta a
-- vigência: ela decide sobre linha VIVA do dia, onde a data não muda nada. Quem
-- usa `vigente_desde` é o painel, no `cortadaNaData`.
--
-- Conferência depois de aplicar:
--
--   -- 1) update só no limiar: a vigência anda sozinha
--   update public.futebol_limiar_valor set limiar = -0.03 where market = 'asian_handicap';
--   select market, limiar, vigente_desde from public.futebol_limiar_valor;
--   -- espera vigente_desde = agora
--
--   -- 2) update com data explícita e DIFERENTE: o valor dado vence
--   update public.futebol_limiar_valor
--      set limiar = -0.02, vigente_desde = timestamptz '2026-09-16 00:00:00-03'
--    where market = 'asian_handicap';
--   -- espera vigente_desde = 16/09/2026 00:00 BRT, e limiar de volta a -0,02
--
--   -- 3) reescrever o mesmo limiar: NÃO carimba
--   update public.futebol_limiar_valor set limiar = -0.02 where market = 'asian_handicap';
--   -- espera vigente_desde inalterada

-- ── O gatilho ───────────────────────────────────────────────────────────────
create or replace function public.futebol_limiar_valor_vigencia()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- Valor igual não é mudança de régua: sai sem carimbar.
  if new.limiar is not distinct from old.limiar then
    return new;
  end if;
  -- Carimba só quando a vigência NÃO veio explícita na mesma instrução.
  if new.vigente_desde is not distinct from old.vigente_desde then
    new.vigente_desde := now();
  end if;
  return new;
end;
$function$;

comment on column public.futebol_limiar_valor.vigente_desde is
  'Data a partir da qual o limiar vale. RECARIMBADA pelo gatilho futebol_limiar_valor_vigencia quando o limiar muda sem vigencia explicita (migration 147). Para datar a mudanca, passe uma vigencia diferente da gravada.';

-- Função de gatilho não é chamada por ninguém de fora, e nasce executável por
-- PUBLIC como qualquer outra (issue #408). Revogar de anon e authenticated não
-- desliga o gatilho: o privilégio é conferido no CREATE TRIGGER, não no disparo.
revoke execute on function public.futebol_limiar_valor_vigencia() from public;
revoke execute on function public.futebol_limiar_valor_vigencia() from anon, authenticated;
grant execute on function public.futebol_limiar_valor_vigencia() to service_role;

drop trigger if exists futebol_limiar_valor_vigencia on public.futebol_limiar_valor;
create trigger futebol_limiar_valor_vigencia
  before update of limiar on public.futebol_limiar_valor
  for each row execute function public.futebol_limiar_valor_vigencia();
