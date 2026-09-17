-- ============================================================================
-- 150 — a oferta depois do teste do futebol
-- ============================================================================
-- Quem tem Telegram vinculado e teve o teste do futebol encerrado sem assinar
-- recebe UMA mensagem, 24 horas depois do fim.
--
-- O vínculo do Telegram é o mais perto de "concluiu o onboarding" que este
-- banco tem: não existe coluna para isso, e o próprio onboarding deixa pular o
-- passo do vínculo. Quem pulou fica de fora — o que não é perda de alvo, porque
-- sem chat não existe para onde mandar.
--
-- Quatro decisões moram aqui, e nenhuma é óbvia lendo só o código:
--
--  1. OPT-OUT PRÓPRIO, QUE SOMA AO GERAL. `settlement_reminders_muted` cala
--     SERVIÇO: o lembrete da aposta da própria pessoa. Oferta é VENDA, e usar a
--     mesma chave obrigaria quem não quer ser vendido a perder um lembrete que
--     ele quer. Daí `futebol_ofertas_muted`. Mas quem calou TUDO não pediu
--     exceção para venda: os dois silêncios valem, e a régua respeita os dois.
--
--  2. RECORTE DE COORTE. Existe gente do tempo em que o teste durava 7 dias.
--     Sem corte, o primeiro disparo acorda uma lista fria inteira de uma vez, e
--     lista queimada não volta. O padrão é 09/09/2026, quando o futebol passou
--     a ser vendável.
--
--  3. UMA POR PESSOA, PARA SEMPRE. A tabela de notificações tem o usuário como
--     chave primária. Não é cache: é a promessa de que um cron mal configurado
--     não remanda oferta para a mesma pessoa.
--
--  4. SEM CRON. Esta migration cria a máquina e NÃO agenda nada. Neste
--     repositório migration aplica sozinha no merge, e mensagem de venda que
--     começa a sair por efeito colateral de um merge é exatamente o acidente
--     que não pode acontecer. O agendamento está no fim, comentado, para ser um
--     passo humano depois de o texto ser aprovado.
-- ============================================================================

-- ── O opt-out da oferta ─────────────────────────────────────────────────────
alter table public.users
  add column if not exists futebol_ofertas_muted boolean not null default false;

comment on column public.users.futebol_ofertas_muted is
  'Opt-out de mensagem de oferta (venda), separado de settlement_reminders_muted, que é serviço. O bot liga e desliga pelo comando /ofertas.';

-- ── Idempotência: uma oferta por pessoa, nunca duas ─────────────────────────
-- Três colunas e não uma: a reserva nasce antes do envio, então "reservada" e
-- "enviada" são momentos diferentes, e o erro precisa de lugar para ser lido
-- depois — sem ele, uma falha vira uma linha muda que ninguém sabe explicar.
create table if not exists public.futebol_oferta_pos_teste_notifications (
  user_id      uuid primary key references public.users(id) on delete cascade,
  reservada_em timestamptz not null default now(),
  enviada_em   timestamptz,
  erro         text
);

comment on table public.futebol_oferta_pos_teste_notifications is
  'Quem já recebeu a oferta pós-teste do futebol. Chave primária no usuário: a mensagem é uma só, e a tabela é o que garante isso mesmo com o cron repetindo.';

alter table public.futebol_oferta_pos_teste_notifications enable row level security;
-- Sem policy, no padrão da 079: só o service_role alcança, e o RLS fecha
-- anon e authenticated.

-- ── Os alvos ────────────────────────────────────────────────────────────────
-- O acesso é decidido por `futebol_acesso_vigente`, a mesma função que o resto
-- do produto usa — e não por uma cópia da regra aqui. Ela já devolve verdadeiro
-- para assinante, qualquer que seja a data do teste antigo, então não há
-- checagem de `premium` solta: regra de acesso copiada é como os dois lados
-- passam a divergir sem ninguém notar.
--
-- Os DOIS silêncios contam. `futebol_ofertas_muted` é o opt-out desta mensagem;
-- `settlement_reminders_muted` é o silêncio geral, que todas as outras DMs
-- respeitam — inclusive as one-shot do winback e do handoff. Opt-out próprio
-- SOMA ao global, nunca substitui: quem mandou calar tudo não pediu para abrir
-- exceção para venda.
create or replace function public.get_futebol_oferta_pos_teste_targets(
  p_desde timestamptz default '2026-09-09 03:00:00+00',
  p_horas integer default 24
)
returns table(user_id uuid, chat_id text, user_name text, trial_ends_at timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  select u.id, u.telegram_chat_id::text, u.name::text, u.futebol_trial_ends_at
    from public.users u
   where u.telegram_chat_id is not null
     and u.futebol_trial_started_at is not null
     and u.futebol_trial_started_at >= p_desde
     and u.futebol_trial_ends_at is not null
     and u.futebol_trial_ends_at <= now() - make_interval(hours => p_horas)
     and not public.futebol_acesso_vigente(u.futebol_subscription_status, u.futebol_trial_ends_at)
     and coalesce(u.settlement_reminders_muted, false) = false
     and coalesce(u.futebol_ofertas_muted, false) = false
     and not exists (
       select 1
         from public.futebol_oferta_pos_teste_notifications n
        where n.user_id = u.id
     )
   order by u.futebol_trial_ends_at;
$function$;

comment on function public.get_futebol_oferta_pos_teste_targets(timestamptz, integer) is
  'Quem terminou o teste do futebol sem assinar, tem Telegram, não silenciou (nem ofertas, nem tudo) e ainda não recebeu. p_desde recorta a coorte; p_horas é a espera depois do fim.';

revoke execute on function public.get_futebol_oferta_pos_teste_targets(timestamptz, integer) from public;
-- No Supabase o schema public dá EXECUTE explícito a anon e authenticated em toda
-- função nova (privilégio padrão), e o revoke de PUBLIC não tira isso (issue #408).
revoke execute on function public.get_futebol_oferta_pos_teste_targets(timestamptz, integer) from anon, authenticated;
grant execute on function public.get_futebol_oferta_pos_teste_targets(timestamptz, integer) to service_role;

-- ── A reserva ───────────────────────────────────────────────────────────────
-- Reservar ANTES de mandar, e não registrar depois: entre o envio e o registro
-- cabe um timeout, e o preço de errar para esse lado é mandar oferta duas vezes
-- para a mesma pessoa. Devolve falso quando alguém já reservou — aí a função de
-- borda pula sem mandar.
create or replace function public.claim_futebol_oferta_pos_teste(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reservou boolean;
begin
  insert into public.futebol_oferta_pos_teste_notifications (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  get diagnostics v_reservou = row_count;
  return v_reservou;
end;
$function$;

comment on function public.claim_futebol_oferta_pos_teste(uuid) is
  'Reserva o envio da oferta pós-teste. Verdadeiro quando reservou agora; falso quando já estava reservado.';

revoke execute on function public.claim_futebol_oferta_pos_teste(uuid) from public;
revoke execute on function public.claim_futebol_oferta_pos_teste(uuid) from anon, authenticated;
grant execute on function public.claim_futebol_oferta_pos_teste(uuid) to service_role;

-- ── Desfazer a reserva, à mão ───────────────────────────────────────────────
-- NÃO é chamada pela função de borda, e isso é decisão, não esquecimento.
-- Quando o envio falha por timeout, ninguém sabe se o Telegram entregou —
-- soltar a vaga ali transforma dúvida em segundo envio, que é o pior desfecho
-- possível de uma mensagem de venda. O erro fica gravado na linha, e devolver a
-- vaga é escolha humana, depois de olhar o que aconteceu.
create or replace function public.release_futebol_oferta_pos_teste(p_user_id uuid)
returns void
language sql
security definer
set search_path to ''
as $function$
  delete from public.futebol_oferta_pos_teste_notifications where user_id = p_user_id;
$function$;

revoke execute on function public.release_futebol_oferta_pos_teste(uuid) from public;
revoke execute on function public.release_futebol_oferta_pos_teste(uuid) from anon, authenticated;
grant execute on function public.release_futebol_oferta_pos_teste(uuid) to service_role;

-- ── O agendamento, quando for decidido ──────────────────────────────────────
-- Propositalmente COMENTADO. Rode este bloco à mão, no editor de SQL, depois de
-- o texto da mensagem ser aprovado e de um `mode=report` ter mostrado quem
-- receberia. Antes disso a função existe e não manda nada.
--
-- Os dois segredos precisam estar no Vault, como nos outros crons (081, 078):
--   notify_futebol_oferta_url e notify_futebol_oferta_cron_secret
--
-- '0 14 * * *' é 11h de Brasília: dentro da janela de silêncio (09h–23h) e
-- longe do horário em que o board sai.
--
-- do $$
-- begin
--   if exists (select 1 from cron.job where jobname = 'notify-futebol-oferta') then
--     perform cron.unschedule('notify-futebol-oferta');
--   end if;
-- end $$;
--
-- select cron.schedule('notify-futebol-oferta', '0 14 * * *', $job$
--   select net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'notify_futebol_oferta_url') || '?mode=send',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_futebol_oferta_cron_secret')
--     ),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 60000
--   );
-- $job$);
