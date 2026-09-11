-- 20260911100000_125_crm_mudar_etapa
--
-- Mover um lead de etapa, com a linha do tempo saindo junto.
--
-- ⚠️ POR QUE UMA FUNÇÃO, E NÃO DOIS INSERTS DO NAVEGADOR
-- Mudar de etapa são duas escritas: a linha atual em `crm_etapa` e o evento em
-- `crm_etapa_evento`. Feitas do navegador, elas não são uma transação — a
-- segunda pode falhar sozinha, e aí a etapa anda sem a linha do tempo registrar.
-- Isso não dá erro em lugar nenhum: a tela mostra a etapa nova, e o buraco só
-- aparece meses depois, quando alguém for medir quanto tempo cada lead ficou
-- parado onde. Aqui as duas acontecem ou nenhuma acontece.
--
-- E o `por` é carimbado com `auth.uid()` DENTRO da função, não recebido como
-- parâmetro: quem registrou a mudança não é algo que o cliente deva poder
-- dizer.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_mudar_etapa('<uuid>', 'contatado');
--   select * from public.crm_etapa_evento order by em desc limit 1;

create or replace function public.crm_mudar_etapa(p_user_id uuid, p_etapa text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_de text;
  v_quem uuid := (select auth.uid());
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  -- Sem linha, a etapa vale `novo`. É o mesmo padrão que a tela assume, e
  -- repetir a regra aqui evita que o primeiro evento de um lead registre um
  -- `de` nulo que ninguém sabe ler depois.
  select e.etapa into v_de from public.crm_etapa e where e.user_id = p_user_id;
  v_de := coalesce(v_de, 'novo');

  -- Reescolher a mesma etapa não é mudança: gravar um evento aqui encheria o
  -- a linha do tempo de eventos que não aconteceram, e a medida de tempo parado em
  -- cada etapa é justamente o que isso estragaria.
  if v_de = p_etapa then
    return v_de;
  end if;

  insert into public.crm_etapa (user_id, etapa, atualizada_em, atualizada_por)
  values (p_user_id, p_etapa, now(), v_quem)
  on conflict (user_id) do update
    set etapa = excluded.etapa,
        atualizada_em = excluded.atualizada_em,
        atualizada_por = excluded.atualizada_por;

  insert into public.crm_etapa_evento (user_id, de, para, por)
  values (p_user_id, v_de, p_etapa, v_quem);

  return p_etapa;
end;
$function$;

comment on function public.crm_mudar_etapa(uuid, text) is
  'Move um lead de etapa e registra o evento na mesma transacao. So socio. O autor vem de auth.uid(), nunca do cliente.';

-- Revoke antes do grant: funcao nova nasce executavel por PUBLIC, e PUBLIC
-- inclui o anon.
revoke execute on function public.crm_mudar_etapa(uuid, text) from public;
grant execute on function public.crm_mudar_etapa(uuid, text) to authenticated;
