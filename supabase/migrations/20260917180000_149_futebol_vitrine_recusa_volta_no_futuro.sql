-- ============================================================================
-- 149 — a vitrine recusa uma volta marcada para o futuro
-- ============================================================================
-- O incidente que esta migration fecha, porque ele volta se ninguém escrever:
--
-- Em 15/09/2026 o handicap foi religado com `oculto_ate` escrito à mão para
-- 17/09. A coluna REGISTRA quando o mercado voltou — ela não agenda a volta.
-- Com um valor no futuro, as duas leituras do sistema discordam:
--
--   · "está escondido hoje?" — board, catálogo do jogo, DM do Telegram e selo
--     do placar — só olha se a coluna está preenchida, e passou a mostrar o
--     handicap na hora;
--   · "esta linha esteve na vitrine?" — o placar — compara a detecção com a
--     volta, e classificou como fora da vitrine tudo que foi detectado antes
--     de 17/09.
--
-- Resultado: o assinante viu e apostou handicap, enquanto o painel do sócio
-- afirmava que aquelas linhas nunca estiveram na tela. Dois green e um red
-- ficaram fora da leitura do produto, e a divergência só apareceu dois dias
-- depois, por alguém estranhar o painel.
--
-- A guarda recusa a escrita na origem. O erro passa a aparecer no editor de
-- SQL, no segundo em que é cometido, em vez de virar contradição silenciosa
-- entre a tela e o painel.
-- ============================================================================

-- ── O gatilho não via o UPDATE que causou o problema ────────────────────────
-- Ele disparava em `update of oculto`, e aquele UPDATE mexeu só na data: o
-- gatilho não chegou a ser chamado. Uma guarda que mora nele só vale se ele
-- acordar também quando a data muda sozinha — e no INSERT, que nunca passou
-- por gatilho nenhum.
create or replace function public.futebol_mercados_ocultos_periodo()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  -- `old` não existe no INSERT, e fechar ou abrir período é conversa de UPDATE.
  if tg_op = 'UPDATE' then
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
  end if;

  -- ── A guarda ──────────────────────────────────────────────────────────────
  -- Data futura não é agendamento: é um fato que ainda não aconteceu, escrito
  -- como se já tivesse acontecido. Quem quiser agendar a volta precisa de outra
  -- coluna e de duas leituras que concordem sobre ela — e isso é uma decisão de
  -- produto, não um efeito colateral de um UPDATE.
  if new.oculto_ate is not null and new.oculto_ate > now() then
    raise exception
      'oculto_ate (%) está no futuro para o mercado %: a coluna registra QUANDO o mercado voltou à vitrine, ela não agenda a volta.',
      new.oculto_ate, new.market
      using
        errcode = 'check_violation',
        hint = 'Para religar agora, deixe oculto_ate em branco e mude oculto para false: o gatilho preenche com o instante da troca. Para corrigir um religamento que já aconteceu, use o instante real dele.';
  end if;

  return new;
end;
$function$;

-- Função de gatilho não é chamada por ninguém de fora, e nasce executável por
-- PUBLIC como qualquer outra (issue #408).
revoke execute on function public.futebol_mercados_ocultos_periodo() from public;
-- No Supabase o schema public dá EXECUTE explícito a anon e authenticated em toda
-- função nova (privilégio padrão), e o revoke de PUBLIC não tira isso.
revoke execute on function public.futebol_mercados_ocultos_periodo() from anon, authenticated;
grant execute on function public.futebol_mercados_ocultos_periodo() to service_role;

drop trigger if exists futebol_mercados_ocultos_periodo on public.futebol_mercados_ocultos;
create trigger futebol_mercados_ocultos_periodo
  before insert or update on public.futebol_mercados_ocultos
  for each row execute function public.futebol_mercados_ocultos_periodo();

-- ── O que já está escrito errado ────────────────────────────────────────────
-- Uma volta no futuro é inválida pela definição da coluna, e deixá-la viva
-- manteria a divergência até a data chegar. `now()` é o menos errado: o mercado
-- está na tela desde o religamento, então é isso que a coluna passa a registrar.
--
-- Em produção isto não muda nada: a linha do handicap já foi acertada à mão em
-- 16/09. Quem esta linha corrige é o staging, que ficou com a data original.
update public.futebol_mercados_ocultos
   set oculto_ate = greatest(now(), oculto_desde + interval '1 second')
 where oculto_ate is not null
   and oculto_ate > now();

comment on column public.futebol_mercados_ocultos.oculto_ate is
  'Quando o mercado voltou à vitrine. Null enquanto está fora. Preenchido pelo gatilho ao virar oculto = false, e recusado no futuro (migration 149): a coluna registra a volta, não a agenda.';
