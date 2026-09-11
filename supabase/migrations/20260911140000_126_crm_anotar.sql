-- 20260911140000_126_crm_anotar
--
-- Escrever na linha do tempo de uma pessoa.
--
-- A tabela `crm_anotacao` nasceu na migration 123, com política de sócio e a
-- restrição de texto em branco. Esta função existe por um motivo só, o mesmo do
-- `crm_mudar_etapa`: carimbar o AUTOR com `auth.uid()` em vez de aceitá-lo do
-- cliente. Com insert direto do navegador, um sócio poderia gravar uma
-- anotação em nome do outro — e numa linha do tempo que existe justamente para
-- saber quem falou com quem, isso é o registro mentindo.
--
-- O `trim` também acontece aqui, e não só na tela: a tela é um dos caminhos até
-- a tabela, não o único.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_anotar('<uuid>', 'feedback', 'achou o Betinho confuso');

create or replace function public.crm_anotar(p_user_id uuid, p_tipo text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  -- Espaço em branco não é anotação. A restrição da tabela já recusaria, mas o
  -- erro que ela devolve fala de `check constraint` — este fala de anotação.
  if v_texto = '' then
    raise exception 'anotacao vazia';
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (p_user_id, p_tipo, v_texto, (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.crm_anotar(uuid, text, text) is
  'Escreve na linha do tempo de uma pessoa. So socio. O autor vem de auth.uid(), nunca do cliente.';

-- Revoke antes do grant: funcao nova nasce executavel por PUBLIC, e PUBLIC
-- inclui o anon.
revoke execute on function public.crm_anotar(uuid, text, text) from public;
grant execute on function public.crm_anotar(uuid, text, text) to authenticated;
