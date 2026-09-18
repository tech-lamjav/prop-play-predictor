-- 20260918020000_153_crm_assinatura_comecou_em
--
-- A assinatura manual passa a ter um COMEÇO próprio, que pode ser no passado.
--
-- ## O que estava furado
--
-- Não havia onde dizer que um acordo começou antes de hoje. Uma vitalícia dada
-- a um parceiro em janeiro só podia ser cadastrada como se tivesse nascido no
-- dia do cadastro, e os meses anteriores sumiam da conta.
--
-- A conta de meses em aberto saía de `criada_em`, que é o carimbo de quando a
-- LINHA nasceu. Usar aquilo como início do acordo funcionava só porque os dois
-- coincidiam — e a alternativa preguiçosa seria gravar `criada_em` no passado.
--
-- ⚠️ Não se falsifica `criada_em`. Ele é fato de auditoria: responde quando
-- isso foi lançado no sistema, e é a única coisa que permite descobrir depois
-- que alguém lançou um acordo antigo ontem à noite. Coluna nova, e cada uma
-- responde a sua pergunta.
--
-- ## ⚠️ Trocar o plano NÃO mexe no começo
--
-- A 142 fez a troca EDITAR a assinatura aberta em vez de encerrar e recriar, e
-- o motivo está escrito lá: encerrar e recriar zerava o histórico de Pix, o
-- total recebido e os meses em aberto, então quem devia três meses deixava de
-- dever porque o sócio corrigiu o valor.
--
-- Sobrescrever o começo numa troca reintroduz exatamente esse estrago por outro
-- caminho: bastaria corrigir o valor para a dívida toda desaparecer. Por isso o
-- `update` abaixo não toca em `comecou_em`.
--
-- ## O limite de doze meses
--
-- Fica na TELA, e não aqui. Ele existe como proteção contra ano digitado errado
-- — alguém escrever 2019 em vez de 2026 —, e não como limite da conta: a conta
-- passou a somar a dívida inteira na #451. O banco recusa só o que é
-- impossível, que é começar no futuro.

-- ── O começo do acordo ──────────────────────────────────────────────────────
alter table public.crm_assinatura_manual
  add column if not exists comecou_em date;

-- As que já existem começaram no dia em que foram lançadas, que é a verdade que
-- se tinha até agora. Em Brasília, e não em UTC: uma assinatura dada às 22h de
-- 31 de agosto é de agosto para quem deu.
update public.crm_assinatura_manual
   set comecou_em = (criada_em at time zone 'America/Sao_Paulo')::date
 where comecou_em is null;

alter table public.crm_assinatura_manual
  alter column comecou_em set not null;

alter table public.crm_assinatura_manual
  alter column comecou_em set default (now() at time zone 'America/Sao_Paulo')::date;

comment on column public.crm_assinatura_manual.comecou_em is
  'Quando o ACORDO comecou, e nao quando a linha nasceu. E daqui que saem os meses em aberto. Pode ser retroativo; criada_em continua sendo o carimbo de auditoria e nunca e falsificado.';

-- ── Conceder, agora com começo ──────────────────────────────────────────────
-- `drop` antes de criar, e não `create or replace`: o parâmetro novo muda a
-- assinatura da função, então o `replace` criaria uma SEGUNDA função em vez de
-- trocar a primeira. Com as duas no banco, uma chamada de quatro argumentos
-- fica ambígua e o Postgres recusa com "function is not unique".
drop function if exists public.crm_dar_assinatura_manual(uuid, text, date, numeric);

create or replace function public.crm_dar_assinatura_manual(
  p_user_id uuid,
  p_plano text,
  p_vence_em date,
  p_valor_mensal numeric default null,
  p_comecou_em date default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_rotulo text;
  v_vitalicio boolean := p_vence_em is null;
  v_trocou boolean;
  -- Nulo quer dizer "começa hoje", que é o caso normal.
  v_comecou date := coalesce(p_comecou_em, (now() at time zone 'America/Sao_Paulo')::date);
  /*
   * ⚠️ Variável SEPARADA para o que volta do banco, e isto não é estilo.
   *
   * A primeira versão reusava `v_comecou` no `returning ... into` do update. Em
   * plpgsql, um `update` que não acerta nenhuma linha atribui NULO a TODOS os
   * alvos do `into` — e o caminho de criar é exatamente o caminho em que o
   * update não acerta nada. O começo escolhido era apagado ali, o `insert`
   * gravava nulo numa coluna `not null`, e TODA concessão nova falhava.
   *
   * Uma variável, dois trabalhos: o começo pedido e o começo lido. Separá-las é
   * o conserto.
   */
  v_comecou_do_banco date;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  if p_valor_mensal is not null and p_valor_mensal <= 0 then
    raise exception 'valor mensal invalido';
  end if;

  -- Acordo que ainda não começou não tem mês em aberto, e a fila de
  -- inadimplentes contaria meses negativos. O limite de doze meses para trás
  -- mora na tela, porque é proteção contra digitação e não regra do modelo.
  if v_comecou > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'comeco no futuro';
  end if;

  if p_plano = 'entrada' then
    v_rotulo := 'Entrada';
    update public.users
      set subscription_product_type = 'entrada',
          betinho_subscription_status = 'premium',
          betinho_subscription_period_end = p_vence_em
      where id = p_user_id;

  elsif p_plano = 'essencial' then
    v_rotulo := 'Essencial';
    update public.users
      set subscription_product_type = 'essencial',
          futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          betinho_subscription_period_end = p_vence_em
      where id = p_user_id;

  elsif p_plano = 'completo' then
    v_rotulo := 'Completo';
    update public.users
      set subscription_product_type = 'completo',
          futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          analytics_subscription_status = 'premium',
          betinho_subscription_period_end = p_vence_em,
          analytics_subscription_period_end = p_vence_em
      where id = p_user_id;

  else
    raise exception 'plano desconhecido: %', p_plano;
  end if;

  if not found then
    raise exception 'pessoa nao encontrada';
  end if;

  /*
   * Trocar o plano, o prazo ou o valor EDITA a assinatura aberta.
   *
   * ⚠️ E NÃO mexe em `comecou_em`. O histórico de pagamento pendura nesta
   * linha, e os meses em aberto contam a partir do começo: sobrescrever o
   * começo numa troca faria a dívida inteira desaparecer só porque o sócio
   * corrigiu o valor. É o mesmo estrago que a 142 evitou ao parar de encerrar
   * e recriar, chegando por outro caminho.
   */
  update public.crm_assinatura_manual
    set plano = p_plano,
        vence_em = p_vence_em,
        valor_mensal = p_valor_mensal
    where user_id = p_user_id and encerrada_em is null
    returning id, comecou_em into v_id, v_comecou_do_banco;

  -- Numa troca, o começo é o que já estava gravado: o histórico de pagamento
  -- pendura nesta linha. Numa criação, `v_comecou_do_banco` é nulo e o pedido
  -- continua valendo.
  v_comecou := coalesce(v_comecou_do_banco, v_comecou);

  v_trocou := v_id is not null;

  if v_id is null then
    insert into public.crm_assinatura_manual
      (user_id, plano, vence_em, valor_mensal, comecou_em, criada_por)
    values
      (p_user_id, p_plano, p_vence_em, p_valor_mensal, v_comecou, (select auth.uid()))
    returning id into v_id;
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    p_user_id,
    'acesso',
    case when v_trocou then 'Assinatura trocada para ' || v_rotulo else v_rotulo || ' na mao' end || ', '
      || case when v_vitalicio then 'vitalicio' else 'valido ate ' || to_char(p_vence_em, 'DD/MM/YYYY') end
      || case when p_valor_mensal is null then ', sem cobranca'
              else ', R$ ' || to_char(p_valor_mensal, 'FM999999990.00') || ' por mes' end
      -- Só aparece quando é retroativo. Numa concessão que começa hoje a frase
      -- seria ruído, e daqui a três meses é esta linha que responde por que a
      -- pessoa apareceu devendo nove meses de uma vez.
      || case when not v_trocou and v_comecou < (now() at time zone 'America/Sao_Paulo')::date
              then '. Comecou em ' || to_char(v_comecou, 'DD/MM/YYYY') || ', retroativo'
              else '' end,
    (select auth.uid())
  );

  return v_id;
end;
$function$;

comment on function public.crm_dar_assinatura_manual(uuid, text, date, numeric, date) is
  'Socio concede um plano inteiro na mao, seguindo a escada cumulativa. Data de fim nula e vitalicio; valor nulo e sem cobranca; comeco nulo e hoje. Trocar o plano NAO mexe no comeco.';

-- Revoke antes do grant: função nasce executável por PUBLIC.
--
-- ⚠️ E o `anon` leva revoke PRÓPRIO. No Supabase, tirar de PUBLIC não fecha o
-- anônimo: o schema `public` dá EXECUTE explicitamente a `anon` e a
-- `authenticated`, e esse grant direto continua de pé depois do revoke de
-- PUBLIC.
revoke execute on function public.crm_dar_assinatura_manual(uuid, text, date, numeric, date) from public;
revoke execute on function public.crm_dar_assinatura_manual(uuid, text, date, numeric, date) from anon;
grant  execute on function public.crm_dar_assinatura_manual(uuid, text, date, numeric, date) to authenticated;
