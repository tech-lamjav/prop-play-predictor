-- ============================================================================
-- 103 · A fase da escalação é escolhida por TEMPO, não por existência
-- ============================================================================
-- Conserta um defeito que a 098 introduziu, e que só ficou visível agora que o
-- Matheus entregou a C1 do lado do dbt (analytics-engineering PR #88, em draft
-- justamente esperando esta correção).
--
-- ----------------------------------------------------------------------------
-- O DEFEITO
-- ----------------------------------------------------------------------------
-- A 098 fez a `get_futebol_fixture_extras` devolver UMA fase de escalação, para
-- o front não desenhar cada jogador duas vezes. Até aí certo. O erro está na
-- regra de escolha, que é por EXISTÊNCIA:
--
--     se existe qualquer linha 'confirmed' -> usa 'confirmed'
--     senão                                -> usa 'real'
--
-- Uma regra que vira a tela inteira com base na existência de UMA linha. E a
-- fase `confirmed` é justamente a que chega incompleta enquanto a fonte não
-- publicou tudo.
--
-- Medido no dev em 18/08, nos 154 jogos que têm as DUAS fases (todos já
-- encerrados):
--
--   · `confirmed`:  306 linhas,  2,0 jogadores por jogo
--   · `real`:     7.156 linhas, 46,5 jogadores por jogo
--
-- Ou seja: a regra atual desenharia um campinho com DOIS jogadores num jogo já
-- encerrado, e esconderia os outros ~44. Pior, o bloco de estatísticas da mesma
-- tela vem de `fact_fixture_player_stats`, que é realidade pós-jogo: a tela
-- mostraria nota e minutagem de gente que não está no campinho.
--
-- Não chegou a machucar ninguém porque a 098 nunca foi promovida para produção.
--
-- ----------------------------------------------------------------------------
-- A REGRA NOVA (é a que o Matheus propôs no comentário da C1)
-- ----------------------------------------------------------------------------
-- Por tabela, independentemente:
--
--   1. kickoff já passou E existe 'real'  -> 'real'      (quem entrou em campo)
--   2. senão, existe 'confirmed'          -> 'confirmed' (o XI anunciado)
--   3. senão                              -> 'real'
--
-- O corte é `kickoff <= now()`, e NÃO "jogo terminado", pelo mesmo motivo da
-- 101: durante os 90 minutos o que interessa já é quem entrou em campo, e a
-- linha 1 só dispara se o `real` existir de fato, então não há risco de esvaziar
-- a tela enquanto a fonte não publicou.
--
-- As duas tabelas decidem SEPARADAS de propósito, como na 098: elas divergem no
-- dado real (a fase `confirmed` aparece em contagens diferentes em cada uma), e
-- forçar uma fase comum esvaziaria uma das duas.
--
-- ----------------------------------------------------------------------------
-- ⚠️ ORDEM EM PRODUÇÃO
-- ----------------------------------------------------------------------------
-- Esta migration EDITA o corpo que a 098 criou. Se a 098 não tiver sido
-- aplicada, o bloco abaixo aborta com mensagem explícita em vez de trocar
-- pedaço errado em silêncio. Aplicar 097 -> 103 na mesma janela.
--
-- Depois desta chegar em produção, o Matheus tira o PR #88 do draft, mergeia e
-- roda o build-and-push. Antes disso o gate dele continua valendo.
-- ============================================================================

do $do$
declare
  v_def text;
  v_novo text;
  -- Cada âncora é única porque difere na variável e na tabela.
  v_ancora_times constant text :=
    'select case when count(*) filter (where lineup_phase = ''confirmed'') > 0
              then ''confirmed'' else ''real'' end
    into v_fase_times
    from futebol.fact_fixture_lineups where fixture_id = p_fixture_id;';
  v_ancora_jog constant text :=
    'select case when count(*) filter (where lineup_phase = ''confirmed'') > 0
              then ''confirmed'' else ''real'' end
    into v_fase_jogadores
    from futebol.fact_fixture_lineups_players where fixture_id = p_fixture_id;';
  v_novo_times constant text :=
    'select case
           when v_fix.kickoff_utc <= (now() at time zone ''UTC'')
                and count(*) filter (where lineup_phase = ''real'') > 0 then ''real''
           when count(*) filter (where lineup_phase = ''confirmed'') > 0 then ''confirmed''
           else ''real'' end
    into v_fase_times
    from futebol.fact_fixture_lineups where fixture_id = p_fixture_id;';
  v_novo_jog constant text :=
    'select case
           when v_fix.kickoff_utc <= (now() at time zone ''UTC'')
                and count(*) filter (where lineup_phase = ''real'') > 0 then ''real''
           when count(*) filter (where lineup_phase = ''confirmed'') > 0 then ''confirmed''
           else ''real'' end
    into v_fase_jogadores
    from futebol.fact_fixture_lineups_players where fixture_id = p_fixture_id;';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_futebol_fixture_extras'
    and pg_get_function_identity_arguments(p.oid) = 'p_fixture_id bigint';

  if v_def is null then
    raise exception '103: get_futebol_fixture_extras(bigint) não existe.';
  end if;

  -- Idempotência: a marca da regra nova é o teste de kickoff.
  if position('v_fix.kickoff_utc <= (now() at time zone ''UTC'')' in v_def) > 0 then
    raise notice '103: a fase já é escolhida por tempo, nada a fazer.';
    return;
  end if;

  -- Cada âncora é conferida SEPARADAMENTE e o erro diz qual falhou, como na
  -- 101. Uma mensagem genérica obriga quem está aplicando às 3h da manhã a ir
  -- ler o corpo da função para descobrir qual das duas divergiu.
  if array_length(string_to_array(v_def, v_ancora_times), 1) - 1 <> 1 then
    raise exception '103: a âncora da fase de TIMES (fact_fixture_lineups) aparece % vez(es) em get_futebol_fixture_extras, esperava exatamente 1. Aplique a 098 antes, e confira se alguém mexeu no corpo depois dela.',
      array_length(string_to_array(v_def, v_ancora_times), 1) - 1;
  end if;

  if array_length(string_to_array(v_def, v_ancora_jog), 1) - 1 <> 1 then
    raise exception '103: a âncora da fase de JOGADORES (fact_fixture_lineups_players) aparece % vez(es) em get_futebol_fixture_extras, esperava exatamente 1. Aplique a 098 antes, e confira se alguém mexeu no corpo depois dela.',
      array_length(string_to_array(v_def, v_ancora_jog), 1) - 1;
  end if;

  v_novo := replace(v_def, v_ancora_times, v_novo_times);
  v_novo := replace(v_novo, v_ancora_jog, v_novo_jog);

  execute v_novo;
  raise notice '103: fase da escalação passou a ser escolhida por tempo (real depois do apito).';
end
$do$;

grant execute on function public.get_futebol_fixture_extras(bigint) to anon, authenticated, service_role;
