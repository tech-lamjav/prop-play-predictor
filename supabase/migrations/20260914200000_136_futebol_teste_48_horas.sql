-- 20260914200000_136_futebol_teste_48_horas
--
-- O teste grátis do futebol passa de 7 dias para 48 horas.
-- A duração era um número escrito na mão em cinco lugares do servidor, e cada
-- cópia decidia sozinha quem ainda tinha acesso: a RPC de acesso, a lista do
-- daily de oportunidades, as duas da fila de alerta em tempo real, e a função
-- que o sócio usa para ligar o teste na ficha.
--
-- Aqui o FIM do teste vira coluna, gravada no mesmo instante em que o relógio
-- larga. Todo mundo passa a ler a coluna, e a duração deixa de ser conhecida
-- por quem lê.
--
-- O CORTE ENTRE AS DUAS COORTES é o que a coluna já guarda, e não uma data
-- pendurada no código:
--   · quem já tinha relógio correndo é preenchido com início + 7 dias, porque
--     foi isso que a página prometeu a essa pessoa;
--   · quem ainda não abriu o módulo recebe 48 horas quando abrir, mesmo que
--     tenha se cadastrado meses atrás.
--
-- O critério é o RELÓGIO, não a data de cadastro. O teste não começa no
-- cadastro: começa na primeira vez que a pessoa abre o futebol. Cortar por
-- "cadastrados nos últimos dias" mataria no nascimento o teste de quem se
-- cadastrou antes e abriu agora, e protegeria quem nunca abriu e não tem
-- relógio nenhum para proteger.
--
-- O ganho de materializar é que a decisão é tomada uma vez, na largada, e nunca
-- mais: as consultas de alerta acertam as duas coortes sem saber que existem
-- duas, e não sobra data de corte para alguém esquecer de remover depois.
-- ============================================================================

-- ── A duração, num lugar só ─────────────────────────────────────────────────
-- Função, e não constante repetida: são dois escritores do relógio (a RPC de
-- acesso e a função do sócio), e eles precisam concordar. É a próxima coisa que
-- vai mudar de valor, então ela tem endereço.
create or replace function public.futebol_trial_duracao()
 returns interval
 language sql
 immutable
as $function$ select interval '48 hours' $function$;

revoke execute on function public.futebol_trial_duracao() from public;
grant execute on function public.futebol_trial_duracao() to anon, authenticated, service_role;

comment on function public.futebol_trial_duracao() is
  'Quanto dura o teste grátis do futebol para quem começa agora. Quem já tinha o relógio correndo não passa por aqui: o fim dessa pessoa já está gravado.';

-- ── O acesso vigente, num lugar só ──────────────────────────────────────────
-- Três funções deste arquivo faziam a mesma pergunta com o mesmo par de linhas
-- copiado. STABLE, e não IMMUTABLE, porque a resposta depende de now().
create or replace function public.futebol_acesso_vigente(
  p_status text,
  p_fim timestamptz
)
 returns boolean
 language sql
 stable
as $function$ select coalesce(coalesce(p_status, 'free') = 'premium' or p_fim > now(), false) $function$;

comment on function public.futebol_acesso_vigente(text, timestamptz) is
  'Se o acesso ao futebol está de pé agora: assinante, ou teste cujo fim ainda não chegou. Não sabe quanto o teste dura — quem larga o relógio já gravou o fim.';

revoke execute on function public.futebol_acesso_vigente(text, timestamptz) from public;
grant execute on function public.futebol_acesso_vigente(text, timestamptz) to anon, authenticated, service_role;

-- ── A coluna do fim ─────────────────────────────────────────────────────────
alter table public.users
  add column if not exists futebol_trial_ends_at timestamptz;

comment on column public.users.futebol_trial_ends_at is
  'Quando o teste grátis do futebol termina para esta pessoa. Gravada junto com o início e nunca recalculada: é ela que faz a promessa vista na largada valer até o fim, mesmo depois de a duração do produto mudar.';

-- ── O corte: quem já estava correndo mantém os 7 dias ───────────────────────
-- O `futebol_trial_ends_at is null` no filtro deixa a migration idempotente: se
-- rodar de novo, não estica o teste de ninguém.
update public.users
   set futebol_trial_ends_at = futebol_trial_started_at + interval '7 days'
 where futebol_trial_started_at is not null
   and futebol_trial_ends_at is null;

-- ── A RPC de acesso ─────────────────────────────────────────────────────────
-- Além de passar a ler a coluna, ela ganha `hours_left`. Com 48 horas, o
-- arredondamento em dias só consegue dizer "2 dias" e depois "1 dia", que é o
-- oposto da urgência que motivou encurtar.
--
-- O `days_left` fica no contrato, e não porque a tela leia — depois deste PR
-- nenhuma lê. Fica porque o banco sobe antes do bundle: entre a migration
-- aplicada e o deploy do frontend, e depois dele para quem está com a página
-- aberta ou com o JS antigo em cache, existe navegador pedindo `days_left`. Um
-- campo removido do contrato vira `undefined` lá, e o contador zera na tela de
-- quem tem acesso.
create or replace function public.get_futebol_access()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_started timestamptz;
  v_ends timestamptz;
  v_status text;
  v_days_left int;
  v_hours_left int;
begin
  -- Deslogado: bloqueado, CTA pra criar conta
  if v_uid is null then
    return jsonb_build_object('state','anon','unlocked',false,'days_left',null,'hours_left',null,'trial_ends_at',null);
  end if;

  select u.futebol_trial_started_at, u.futebol_trial_ends_at, coalesce(u.futebol_subscription_status,'free')
    into v_started, v_ends, v_status
  from public.users u where u.id = v_uid;

  -- Assinante do Futebol: liberado
  if v_status = 'premium' then
    return jsonb_build_object('state','subscribed','unlocked',true,'days_left',null,'hours_left',null,'trial_ends_at',null);
  end if;

  -- 1º acesso: o relógio larga agora, e o fim é gravado na MESMA escrita. Se o
  -- fim ficasse para um passo seguinte, uma linha com início e sem fim seria um
  -- teste de duração indefinida — e é justamente essa linha que não pode
  -- existir. O `returning` lê de volta o que foi gravado, em vez de repetir a
  -- conta aqui.
  --
  -- ⚠️ Sem `if not found`, de propósito: se a linha não existe, o UPDATE não
  -- grava nada e a função devolve um teste que ela não persistiu, então a
  -- chamada seguinte cunha outras 48 horas — teste perpétuo. É o comportamento
  -- que já existia antes desta migration, com 7 dias, pela mesma razão
  -- (`v_started := now()` solto depois de um UPDATE que podia casar zero
  -- linhas). Mantido aqui porque mudar semântica de ACESSO numa migration sobre
  -- DURAÇÃO trocaria um teste perpétuo raro por um bloqueio possível durante a
  -- corrida entre criar a conta e criar a linha. Decisão à parte.
  if v_started is null then
    v_started := now();
    v_ends := v_started + public.futebol_trial_duracao();
    update public.users set futebol_trial_started_at = v_started, futebol_trial_ends_at = v_ends where id = v_uid;
  end if;

  -- Defesa para uma linha que não deveria existir: relógio correndo com fim
  -- nulo. Conta a partir do início desta pessoa, e não de agora — senão um
  -- teste vencido há meses ganharia 48 horas novas de presente.
  if v_ends is null then
    v_ends := v_started + public.futebol_trial_duracao();
  end if;

  v_days_left := greatest(0, ceil(extract(epoch from (v_ends - now())) / 86400.0)::int);
  v_hours_left := greatest(0, ceil(extract(epoch from (v_ends - now())) / 3600.0)::int);

  if now() < v_ends then
    return jsonb_build_object('state','trial','unlocked',true,'days_left',v_days_left,'hours_left',v_hours_left,'trial_ends_at',v_ends);
  else
    return jsonb_build_object('state','expired','unlocked',false,'days_left',0,'hours_left',0,'trial_ends_at',v_ends);
  end if;
end $function$;

revoke execute on function public.get_futebol_access() from public;
grant execute on function public.get_futebol_access() to anon, authenticated, service_role;

-- ── O daily de oportunidades (ver 081 e 090) ────────────────────────────────
-- Só muda como o segmento A é medido. O teto de 5 envios do segmento B segue
-- como a 090 deixou.
create or replace function public.get_opportunity_recipients()
returns table(user_id uuid, chat_id text, user_name text, segment text, sends_without_click integer)
language sql stable security definer set search_path to 'public'
as $function$
  with base as (
    select u.id, u.telegram_chat_id, u.name,
           public.futebol_acesso_vigente(u.futebol_subscription_status, u.futebol_trial_ends_at) as futebol_ativo,
           (select max(b.bet_date) from bets b where b.user_id = u.id) as ultima_aposta
    from users u
    where u.telegram_chat_id is not null
      and coalesce(u.settlement_reminders_muted, false) = false
  )
  select b.id, b.telegram_chat_id::text, b.name::text,
         case when b.futebol_ativo then 'A' else 'B' end as segment,
         coalesce(s.sends_without_click, 0)
  from base b
  left join opportunity_dispatch_state s on s.user_id = b.id
  where b.futebol_ativo
     or (
       -- reativação: inativo há 14+ dias (ou nunca apostou) e regra dos 5 envios
       (b.ultima_aposta is null or b.ultima_aposta < now() - interval '14 days')
       and coalesce(s.sends_without_click, 0) < 5
     );
$function$;

revoke execute on function public.get_opportunity_recipients() from public;
grant execute on function public.get_opportunity_recipients() to service_role;

-- ── A fila do alerta em tempo real (ver 111 e a preferência de 28/08) ───────
create or replace function public.get_futebol_publication_alert_recipients()
returns table(user_id uuid, chat_id text, user_name text)
language sql stable security definer set search_path to 'public'
as $function$
  select u.id, u.telegram_chat_id::text, u.name::text
  from public.users u
  where u.telegram_chat_id is not null
    and coalesce(u.futebol_publication_alerts_enabled, true) = true
    and public.futebol_acesso_vigente(u.futebol_subscription_status, u.futebol_trial_ends_at);
$function$;

revoke execute on function public.get_futebol_publication_alert_recipients() from public;
grant execute on function public.get_futebol_publication_alert_recipients() to service_role;

-- Reconfere a preferência quando a entrega é reservada. Pausar no site ou no
-- Telegram vale imediatamente inclusive para lotes que já estavam na fila.
create or replace function public.claim_futebol_publication_alert_deliveries()
returns table(batch_id uuid, user_id uuid, chat_id text, attempt_id uuid, opportunities jsonb)
language plpgsql security definer set search_path to 'public'
as $function$
begin
  update public.futebol_publication_alert_deliveries d
  set status = 'expired', attempt_id = null, claimed_at = null
  where d.status in ('pending', 'failed', 'processing')
    and not exists (
      select 1 from public.futebol_publication_alerts a
      where a.batch_id = d.batch_id and a.kickoff_utc > now()
    );

  return query
  with claimed as (
    update public.futebol_publication_alert_deliveries d
    set status = 'processing',
        attempts = d.attempts + 1,
        attempt_id = gen_random_uuid(),
        claimed_at = now(),
        last_attempt_at = now()
    from public.users u
    where d.user_id = u.id
      and d.status in ('pending', 'failed')
      and u.telegram_chat_id is not null
      and coalesce(u.futebol_publication_alerts_enabled, true) = true
      and exists (
        select 1 from public.futebol_publication_alerts a
        where a.batch_id = d.batch_id and a.kickoff_utc > now()
      )
      and public.futebol_acesso_vigente(u.futebol_subscription_status, u.futebol_trial_ends_at)
    returning d.batch_id, d.user_id, u.telegram_chat_id::text, d.attempt_id
  )
  select c.batch_id,
         c.user_id,
         c.telegram_chat_id,
         c.attempt_id,
         jsonb_agg(
           jsonb_build_object(
             'alert_id', a.id,
             'fixture_id', a.fixture_id,
             'home_team_name', a.home_team_name,
             'away_team_name', a.away_team_name,
             'competition', a.competition,
             'kickoff_utc', a.kickoff_utc,
             'market', a.market,
             'outcome', a.outcome,
             'line_value', a.line_value,
             'best_odd', a.best_odd,
             'score', a.score,
             'faixa', a.faixa,
             'evidencias', a.evidencias
           ) order by a.score desc
         )
  from claimed c
  join public.futebol_publication_alerts a on a.batch_id = c.batch_id
  where a.kickoff_utc > now()
  group by c.batch_id, c.user_id, c.telegram_chat_id, c.attempt_id;
end;
$function$;

revoke execute on function public.claim_futebol_publication_alert_deliveries() from public;
grant execute on function public.claim_futebol_publication_alert_deliveries() to service_role;

-- ── O teste que o sócio liga na ficha (ver 129) ─────────────────────────────
-- Passa a gravar as duas colunas. Sem isto o sócio ligaria o teste, a coluna do
-- fim ficaria nula e a pessoa cairia como vencida na hora: acesso concedido que
-- não acontece.
create or replace function public.crm_definir_teste_do_futebol(
  p_user_id uuid,
  p_ligado boolean
)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := case when p_ligado then now() else null end;
  v_fim timestamptz := case when p_ligado then v_inicio + public.futebol_trial_duracao() else null end;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  update public.users
    set futebol_trial_started_at = v_inicio,
        futebol_trial_ends_at = v_fim
    where id = p_user_id;

  if not found then
    raise exception 'pessoa nao encontrada';
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    p_user_id,
    'acesso',
    case when p_ligado then 'Teste do futebol: comecou hoje' else 'Teste do futebol: encerrado' end,
    (select auth.uid())
  );

  return v_inicio;
end;
$function$;

comment on function public.crm_definir_teste_do_futebol(uuid, boolean) is
  'Começa ou encerra o teste gratuito do futebol. Grava início e fim juntos, com a duração vigente do produto, e nunca mexe no status de assinatura.';

revoke execute on function public.crm_definir_teste_do_futebol(uuid, boolean) from public;
grant execute on function public.crm_definir_teste_do_futebol(uuid, boolean) to authenticated;
