-- ============================================================
-- 080_telegram_link_tokens — vínculo Telegram por deep-link
-- ============================================================
-- Onboarding redesign (docs/onboarding-betinho-redesign.md §4):
-- o vínculo web↔Telegram deixa de depender de matching por telefone
-- (fonte de becos quando o nº do Telegram ≠ nº do cadastro) e passa a
-- usar token de uso único no /start: t.me/<bot>?start=link_<token>.
-- O fluxo por compartilhamento de contato permanece como fallback.

create table if not exists public.telegram_link_tokens (
  token       uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  used_at     timestamptz
);

create index if not exists telegram_link_tokens_user_idx
  on public.telegram_link_tokens (user_id);

-- Sem policies de leitura/escrita: o front só emite via RPC (security definer)
-- e o webhook usa service role.
alter table public.telegram_link_tokens enable row level security;

-- Emite um token novo pro usuário logado, invalidando os anteriores não usados.
-- Uso único + expiry: link vazado não vincula a conta de terceiro indefinidamente.
create or replace function public.get_telegram_link_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update telegram_link_tokens
     set expires_at = now()
   where user_id = auth.uid()
     and used_at is null
     and expires_at > now();

  insert into telegram_link_tokens (user_id)
  values (auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.get_telegram_link_token() from public, anon;
grant execute on function public.get_telegram_link_token() to authenticated;
