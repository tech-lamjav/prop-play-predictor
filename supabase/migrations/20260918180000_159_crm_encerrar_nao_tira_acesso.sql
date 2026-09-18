-- 20260918180000_159_crm_encerrar_nao_tira_acesso
--
-- Encerrar uma assinatura manual passa a REGISTRAR que o acordo acabou, e para
-- de tirar o acesso ao produto.
--
-- ## O defeito que isto conserta
--
-- A função decidia se podia rebaixar o acesso perguntando "esta pessoa tem
-- assinatura no Stripe?", e respondia olhando `users.stripe_subscription_id`.
--
-- Esse campo é escrito num ÚNICO ponto do webhook: o evento de assinatura
-- criada ou alterada. Nem a compra nem a fatura paga o preenchem. Quem comprou
-- por um caminho que não gera aquele evento nunca ganha o identificador —
-- mesmo pagando todo mês.
--
-- Então encerrar uma cortesia derrubava o acesso de gente que estava pagando,
-- e ninguém ficava sabendo: a pessoa simplesmente perdia o produto.
--
-- O espelho do mesmo defeito também existia: um identificador antigo, de uma
-- assinatura já cancelada no gateway, ficava gravado e fazia a função poupar o
-- acesso de quem deveria perdê-lo — cortesia encerrada virava acesso eterno.
--
-- ## Por que não foi consertado trocando o sinal
--
-- Porque não existe sinal confiável no nosso banco. A coluna de situação crua
-- que a 151 criou começa vazia para todo mundo e só é preenchida quando o
-- gateway manda um aviso novo sobre aquela pessoa. Usá-la erraria para o outro
-- lado: o sistema passaria a achar que ninguém paga no cartão.
--
-- A fonte confiável é o Stripe, e uma função de banco não fala com ele.
--
-- ## A saída: parar de adivinhar
--
-- Encerrar marca o fim do acordo. Tirar o produto vira decisão separada e
-- explícita, nos interruptores por produto que já existem ao lado, na mesma
-- aba da ficha.
--
-- É a mesma forma que o estorno já usa nesta casa: ele marca o pagamento e NÃO
-- recua o acesso, com o motivo escrito de que a pessoa já usou e que tirar por
-- erro de lançamento castigaria quem não errou.
--
-- ⚠️ O custo é real e é aceito: encerrar uma cortesia não corta o acesso
-- sozinho. São dois passos do sócio. Em troca, o sistema nunca mais tira o
-- produto de quem está pagando por ele.

create or replace function public.crm_encerrar_assinatura_manual(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_plano text;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  update public.crm_assinatura_manual
    set encerrada_em = now(), encerrada_por = (select auth.uid())
    where id = p_id and encerrada_em is null
    returning user_id, plano into v_user_id, v_plano;

  if v_user_id is null then
    raise exception 'assinatura nao encontrada ou ja encerrada';
  end if;

  /*
   * ⚠️ Daqui para baixo, esta função NÃO escreve na tabela de usuários.
   *
   * A versão anterior rebaixava os acessos do plano quando achava que a pessoa
   * não tinha Stripe — e errava essa conta. O acesso agora é assunto dos
   * interruptores por produto, que são explícitos e ficam ao lado.
   *
   * A anotação diz isso com todas as letras, porque é a única coisa que impede
   * o sócio de encerrar e ir embora achando que cortou.
   *
   * O construto proibido não aparece escrito aqui de propósito: os guardas
   * procuram por ele no texto da função, e o `lerMigration` tira comentário de
   * linha mas não de bloco. Explicar a regra escrevendo o que ela proíbe faria
   * o comentário acusar a si mesmo — foi o que aconteceu na primeira versão.
   */
  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    v_user_id,
    'acesso',
    'Assinatura manual (' || v_plano || ') encerrada. O ACESSO NAO FOI TIRADO: '
      || 'se for para cortar, use os acessos avulsos ao lado.',
    (select auth.uid())
  );
end;
$function$;

comment on function public.crm_encerrar_assinatura_manual(uuid) is
  'Encerra a assinatura manual e anota na linha do tempo. NAO mexe em acesso: tirar produto e decisao separada, nos acessos avulsos. Antes ela rebaixava o acesso adivinhando quem paga no Stripe, e derrubava cliente pagante.';

-- Revoke antes do grant: função nasce executável por PUBLIC.
--
-- ⚠️ E o `anon` leva revoke PRÓPRIO. No Supabase, tirar de PUBLIC não fecha o
-- anônimo: o schema `public` dá EXECUTE explicitamente a `anon` e a
-- `authenticated`, e esse grant direto continua de pé depois do revoke de
-- PUBLIC.
revoke execute on function public.crm_encerrar_assinatura_manual(uuid) from public;
revoke execute on function public.crm_encerrar_assinatura_manual(uuid) from anon;
grant  execute on function public.crm_encerrar_assinatura_manual(uuid) to authenticated;
