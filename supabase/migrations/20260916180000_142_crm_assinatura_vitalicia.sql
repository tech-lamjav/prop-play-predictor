-- 20260916180000_142_crm_assinatura_vitalicia
--
-- A concessão passa a combinar o VALOR, e a data de fim passa a poder não
-- existir.
--
-- ## O que estava furado
--
-- A 141 deu à assinatura manual uma coluna `valor_mensal` e construiu a tabela
-- de pagamentos em cima dela. Só que NINGUÉM ESCREVE essa coluna: a função que
-- concede é a da 131, que recebe plano e data e mais nada. Na prática toda
-- assinatura nascia sem valor, e sem valor não há mês em aberto, não há fila de
-- inadimplente e não há receita para somar. A metade financeira da 141 estava
-- inalcançável pela tela.
--
-- ## Vitalício
--
-- A 131 fez `vence_em` obrigatório, e a razão estava escrita: sem data não há
-- fila de cobrança, porque ninguém sabe quando cobrar. Isso continua valendo
-- para quem paga por mês.
--
-- O que faltava é o outro caso: alguém que tem acesso para sempre. Sócio,
-- parceiro, quem ajudou a construir a coisa. Para essa pessoa não existe
-- "válido até", e a única saída que o modelo oferecia era digitar uma data de
-- 2099: um número falso que o resto do sistema trataria como verdade, e que um
-- dia chegaria.
--
-- Nulo diz o que é: não há data. E o efeito em cascata é o certo, porque quem
-- não tem data nunca entra na fila de vencimento.
--
-- ## ⚠️ VITALÍCIO E SEM COBRANÇA SÃO COISAS DIFERENTES
--
-- Duas colunas, duas perguntas:
--
--   `valor_mensal` nulo  → sem cobrança: não se combinou pagar nada.
--   `vence_em` nulo      → vitalício: o acesso não expira.
--
-- Elas se combinam nos quatro jeitos, e todos existem na prática. Vitalício com
-- valor é quem paga todo mês e nunca perde acesso por atraso. Com data e sem
-- valor é acesso dado na mão por um tempo. É por isso que são duas colunas, e
-- não um campo "tipo" com quatro opções.
--
-- ## O que acontece quando a pessoa não paga
--
-- Nada automático, e isso é decisão tomada: quem não paga deixa de ter meses
-- quitados, então `vence_em` para de andar para frente e um dia fica no
-- passado. A tela mostra isso e o sócio decide encerrar. Não existe cron
-- cortando acesso sozinho: cortar o acesso de um cliente por engano custa mais
-- caro que deixá-lo um mês a mais, e um corte automático erra em silêncio.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_dar_assinatura_manual('<uuid>', 'completo', null, null);
--   select plano, vence_em, valor_mensal from public.crm_assinatura_manual;

alter table public.crm_assinatura_manual
  alter column vence_em drop not null;

comment on column public.crm_assinatura_manual.vence_em is
  'Ate quando o acesso esta PAGO. NULO quer dizer vitalicio: nao expira e nao entra na fila de vencimento. Registrar pagamento empurra esta data um mes.';

-- ── Conceder, agora com valor e com vitalício ───────────────────────────────
-- `drop` antes de criar, e não `create or replace`: o parâmetro novo muda a
-- assinatura da função, então o `replace` criaria uma SEGUNDA função em vez de
-- trocar a primeira. Com as duas no banco, uma chamada de três argumentos fica
-- ambígua e o Postgres recusa — o sócio veria "function is not unique" ao dar
-- uma assinatura.
drop function if exists public.crm_dar_assinatura_manual(uuid, text, date);

create or replace function public.crm_dar_assinatura_manual(
  p_user_id uuid,
  p_plano text,
  p_vence_em date,
  p_valor_mensal numeric default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_rotulo text;
  -- Sai daqui para o texto da linha do tempo não repetir a condição.
  v_vitalicio boolean := p_vence_em is null;
  -- Se a pessoa já tinha assinatura aberta e ela foi editada, e não criada.
  v_trocou boolean;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  -- Zero não é "sem cobrança": sem cobrança é NULO. Um zero gravado viraria
  -- receita de R$ 0,00 somada num total, e meses em aberto de valor nenhum
  -- numa fila de inadimplente.
  if p_valor_mensal is not null and p_valor_mensal <= 0 then
    raise exception 'valor mensal invalido';
  end if;

  -- O plano escolhe um RAMO, e nunca vira nome de coluna. A versão genérica
  -- com `execute format` transformaria "plano" em qualquer coluna da tabela de
  -- usuários, `is_socio` inclusive.
  --
  -- ⚠️ Em vitalício as colunas de prazo recebem NULO, e não uma data longe. O
  -- acesso é decidido pelo `status`, e o prazo só é exibido: nulo aparece como
  -- "sem data de renovação", que é a verdade, e é o mesmo que o futebol sempre
  -- foi.
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
   * Trocar o plano, o prazo ou o valor EDITA a assinatura aberta, e não
   * encerra uma para abrir outra.
   *
   * Os pagamentos penduram na assinatura. A primeira versão encerrava a aberta
   * e criava uma nova a cada troca, e com isso o histórico de Pix, o total
   * recebido e os meses em aberto voltavam a zero na tela: quem devia três
   * meses deixava de dever porque o sócio corrigiu o valor. Editar mantém o
   * mesmo acordo, com o mesmo começo, e só muda os termos dele.
   *
   * O índice único garante no máximo uma aberta por pessoa, então o
   * `returning` nunca devolve mais de uma linha.
   */
  update public.crm_assinatura_manual
    set plano = p_plano,
        vence_em = p_vence_em,
        valor_mensal = p_valor_mensal
    where user_id = p_user_id and encerrada_em is null
    returning id into v_id;

  v_trocou := v_id is not null;

  if v_id is null then
    insert into public.crm_assinatura_manual
      (user_id, plano, vence_em, valor_mensal, criada_por)
    values
      (p_user_id, p_plano, p_vence_em, p_valor_mensal, (select auth.uid()))
    returning id into v_id;
  end if;

  -- A anotação diz as duas coisas separadas, porque são duas: até quando vale,
  -- e quanto foi combinado. Daqui a três meses é esta linha que responde por
  -- que se está cobrando tanto dessa pessoa.
  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    p_user_id,
    'acesso',
    case when v_trocou then 'Assinatura trocada para ' || v_rotulo else v_rotulo || ' na mao' end || ', '
      || case when v_vitalicio then 'vitalicio' else 'valido ate ' || to_char(p_vence_em, 'DD/MM/YYYY') end
      || case when p_valor_mensal is null then ', sem cobranca'
              else ', R$ ' || to_char(p_valor_mensal, 'FM999999990.00') || ' por mes' end,
    (select auth.uid())
  );

  return v_id;
end;
$function$;

comment on function public.crm_dar_assinatura_manual(uuid, text, date, numeric) is
  'Socio concede um plano inteiro na mao, seguindo a escada cumulativa. Data nula e vitalicio; valor nulo e sem cobranca.';

revoke execute on function public.crm_dar_assinatura_manual(uuid, text, date, numeric) from public;
grant execute on function public.crm_dar_assinatura_manual(uuid, text, date, numeric) to authenticated;

-- ── Registrar pagamento não pode acabar com o vitalício ─────────────────────
-- A 141 empurrava a data com `greatest(vence_em, fim_do_mes)`, e em Postgres
-- `greatest` IGNORA nulo: devolve o outro valor. Então um pagamento lançado numa
-- assinatura vitalícia DAVA uma data a quem não tinha, e o vitalício virava
-- mensal sem ninguém pedir. O `if` abaixo é o conserto.
create or replace function public.crm_registrar_pagamento(
  p_assinatura_id uuid,
  p_competencia date,
  p_valor numeric,
  p_origem text,
  p_pago_em date default current_date
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_user_id uuid;
  v_plano text;
  v_vence_em date;
  v_vitalicio boolean;
  v_mes date := date_trunc('month', p_competencia)::date;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'valor invalido';
  end if;

  select a.user_id, a.plano, a.vence_em, a.vence_em is null
    into v_user_id, v_plano, v_vence_em, v_vitalicio
    from public.crm_assinatura_manual a
   where a.id = p_assinatura_id and a.encerrada_em is null;

  if v_user_id is null then
    raise exception 'assinatura nao encontrada ou ja encerrada';
  end if;

  insert into public.crm_pagamento
    (assinatura_id, competencia, valor, origem, pago_em, criada_por)
  values
    (p_assinatura_id, v_mes, p_valor, p_origem, coalesce(p_pago_em, current_date),
     (select auth.uid()))
  returning id into v_id;

  /*
   * O acesso anda um mês para frente, a partir do MAIOR entre o vencimento
   * atual e o fim do mês pago: quem paga adiantado não perde o que já tinha, e
   * quem paga atrasado não ganha um mês extra por ter atrasado.
   *
   * ⚠️ Vitalício continua vitalício. Ele paga e o registro do pagamento fica;
   * o que não acontece é ganhar uma data de fim que ele não tinha.
   */
  if not v_vitalicio then
    update public.crm_assinatura_manual
      set vence_em = greatest(vence_em, (v_mes + interval '1 month' - interval '1 day')::date)
      where id = p_assinatura_id
      returning vence_em into v_vence_em;
  end if;

  -- O acesso do produto acompanha, seguindo a mesma escada da 131. Em
  -- vitalício, `v_vence_em` é nulo e as colunas de prazo ficam nulas também.
  if v_plano = 'entrada' then
    update public.users
      set betinho_subscription_status = 'premium', betinho_subscription_period_end = v_vence_em
      where id = v_user_id;
  elsif v_plano = 'essencial' then
    update public.users
      set futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          betinho_subscription_period_end = v_vence_em
      where id = v_user_id;
  elsif v_plano = 'completo' then
    update public.users
      set futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          analytics_subscription_status = 'premium',
          betinho_subscription_period_end = v_vence_em,
          analytics_subscription_period_end = v_vence_em
      where id = v_user_id;
  else
    raise exception 'plano desconhecido ao registrar pagamento: %', v_plano;
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    v_user_id,
    'acesso',
    'Pagou ' || to_char(v_mes, 'MM/YYYY') || ' por ' || p_origem
      || ': R$ ' || to_char(p_valor, 'FM999999990.00')
      || case when v_vitalicio then '. Assinatura vitalicia, sem data de fim.'
              else '. Acesso pago ate ' || to_char(v_vence_em, 'DD/MM/YYYY') || '.' end,
    (select auth.uid())
  );

  return v_id;
end;
$function$;

comment on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) is
  'Registra dinheiro recebido na mao, empurra o acesso um mes e anota na linha do tempo. Vitalicio nao ganha data de fim.';

revoke execute on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) from public;
grant execute on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) to authenticated;
