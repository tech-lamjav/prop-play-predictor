-- 20260916200000_143_crm_sem_whatsapp
--
-- Marcar um lead como "não dá para falar com essa pessoa por WhatsApp".
--
-- ## Por que existe
--
-- Nas palavras do sócio: "esses eu não consigo fazer nada". Um lead sem
-- WhatsApp é quase uma desqualificação — dá para mandar e-mail um dia, mas não
-- adianta para o trabalho de hoje. Misturados na fila, eles só se revelavam
-- depois de abrir a ficha e não achar botão nenhum.
--
-- ## Por que a tabela guarda SÓ a marca manual
--
-- Quem não tem número que abra conversa já é visível pelo próprio cadastro, com
-- a mesma regra do botão da ficha (número curto ou sem código do país não abre
-- conversa nenhuma). Gravar esses aqui seria manter uma cópia que envelhece
-- sozinha: no dia em que a pessoa cadastrasse um número, a linha continuaria
-- dizendo que ela está sem.
--
-- O que o cadastro NÃO consegue enxergar é o número bem formado que não leva à
-- pessoa — errado, antigo, de outra pessoa. Esse é o caso desta tabela, e ele
-- só existe porque alguém tentou e descobriu.
--
-- ## Por que não é etapa
--
-- A etapa diz até onde a conversa chegou; não ter número é fato do cadastro, e
-- os dois valem ao mesmo tempo. Como etapa, ela engoliria a etapa de todo mundo
-- que está sem número — o mesmo erro que escondeu 59 leads quando "em teste"
-- era etapa, e que a 138 desfez.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_marcar_sem_whatsapp('<uuid>', true);
--   select * from public.crm_sem_whatsapp where user_id = '<uuid>';
--   select * from public.crm_anotacao where user_id = '<uuid>' order by criada_em desc limit 1;
--   select public.crm_marcar_sem_whatsapp('<uuid>', false);

create table if not exists public.crm_sem_whatsapp (
  user_id uuid primary key references public.users(id) on delete cascade,
  -- ⚠️ NÃO existe coluna de motivo. A primeira versão tinha uma, ponta a ponta,
  -- e nenhuma tela mandava nada nela: campo pela metade é pior que campo
  -- nenhum, porque promete um dado que ninguém preenche. Se o motivo fizer
  -- falta, ele volta com a tela que o escreve, no mesmo commit.
  marcado_em timestamptz not null default now(),
  marcado_por uuid references public.users(id)
);

comment on table public.crm_sem_whatsapp is
  'Leads que o socio marcou na mao como impossiveis de abordar por WhatsApp. Quem simplesmente nao tem numero usavel NAO entra aqui: isso sai do proprio cadastro.';

alter table public.crm_sem_whatsapp enable row level security;

-- ⚠️ Só leitura por política. A escrita passa pela função `security definer`
-- abaixo, que carimba o autor e registra na linha do tempo na MESMA transação.
-- Com uma política `for all`, o sócio marcaria direto pela API e o registro
-- existiria só quando a tela fosse usada — foi a mesma decisão da 141 para os
-- pagamentos.
drop policy if exists "Socios gerenciam sem whatsapp" on public.crm_sem_whatsapp;
drop policy if exists "Socios leem sem whatsapp" on public.crm_sem_whatsapp;
create policy "Socios leem sem whatsapp"
  on public.crm_sem_whatsapp for select to authenticated
  using (public.eh_socio());

create or replace function public.crm_marcar_sem_whatsapp(
  p_user_id uuid,
  p_marcado boolean
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_quem uuid := (select auth.uid());
  v_ja boolean;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  select exists(select 1 from public.crm_sem_whatsapp s where s.user_id = p_user_id) into v_ja;

  -- Marcar quem já está marcado não faz nada, de propósito: um evento novo
  -- encheria a linha do tempo de mudanças que não aconteceram — a mesma regra
  -- que a 125 aplica quando alguém reescolhe a etapa que já valia.
  if p_marcado and not v_ja then
    insert into public.crm_sem_whatsapp (user_id, marcado_em, marcado_por)
    values (p_user_id, now(), v_quem);

    insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
    values (
      p_user_id,
      'anotacao',
      'Marcado como sem WhatsApp. Sai das listas de abordagem ate alguem desmarcar.',
      v_quem
    );

  elsif not p_marcado and v_ja then
    delete from public.crm_sem_whatsapp where user_id = p_user_id;

    insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
    values (
      p_user_id,
      'anotacao',
      'Desmarcado: voltou para as listas de abordagem.',
      v_quem
    );
  end if;

  return p_marcado;
end;
$function$;

comment on function public.crm_marcar_sem_whatsapp(uuid, boolean) is
  'Marca ou desmarca um lead como impossivel de abordar por WhatsApp, registrando na linha do tempo na mesma transacao. So socio. O autor vem de auth.uid(), nunca do cliente.';

-- Revoke antes do grant: função nova nasce executável por PUBLIC.
--
-- ⚠️ E o `anon` leva revoke PRÓPRIO. No Supabase, tirar de PUBLIC não fecha o
-- anônimo: o schema `public` dá EXECUTE explicitamente a `anon` e a
-- `authenticated`, e esse grant direto continua de pé depois do revoke de
-- PUBLIC. Só o de PUBLIC deixaria um visitante deslogado chamando uma função
-- que roda com privilégio de dono do banco.
revoke execute on function public.crm_marcar_sem_whatsapp(uuid, boolean) from public;
revoke execute on function public.crm_marcar_sem_whatsapp(uuid, boolean) from anon;
grant  execute on function public.crm_marcar_sem_whatsapp(uuid, boolean) to authenticated;
