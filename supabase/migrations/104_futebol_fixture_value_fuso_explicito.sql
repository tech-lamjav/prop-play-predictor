-- ============================================================================
-- 104 · `get_futebol_fixture_value`: fuso explícito no corte de kickoff
-- ============================================================================
-- Achado no code review do PR #261. Não é bug hoje, é dependência escondida.
--
-- A 101 escreveu o corte da fonte assim:
--
--     fx.kickoff_utc > now()          -- e  fx.kickoff_utc <= now()
--
-- `kickoff_utc` é `timestamp without time zone` guardando UTC; `now()` é
-- `timestamptz`. Postgres resolve a comparação convertendo o `now()` para o
-- **TimeZone da sessão**. No Supabase o TimeZone é UTC, então o resultado está
-- certo — por coincidência de configuração, não por construção.
--
-- Basta alguém rodar com `SET TimeZone='America/Sao_Paulo'` (um psql local, um
-- job, um cliente que negocia fuso) para o corte andar 3 horas: jogo que já
-- começou passaria a ser lido como futuro, e a tela voltaria a servir o board
-- no lugar da foto do apito, exatamente durante as horas em que mais importa.
--
-- As migrations 102 e 103, escritas depois, já usam `now() at time zone 'UTC'`.
-- Esta alinha a 101 com as duas: as três passam a comparar UTC com UTC, sem
-- depender de configuração de sessão.
--
-- ⚠️ ORDEM: aplicar depois da 101. Se a marca da 101 não estiver no corpo, o
-- bloco aborta em vez de trocar pedaço errado em silêncio.
-- ============================================================================

do $do$
declare
  v_def text;
  v_novo text;
  v_ancora_futuro constant text := 'where fx.fixture_id = p_fixture_id and fx.kickoff_utc > now())';
  v_ancora_passado constant text := 'and fx.kickoff_utc <= now()';
  v_novo_futuro constant text := 'where fx.fixture_id = p_fixture_id and fx.kickoff_utc > (now() at time zone ''UTC''))';
  v_novo_passado constant text := 'and fx.kickoff_utc <= (now() at time zone ''UTC'')';
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_futebol_fixture_value'
    and pg_get_function_identity_arguments(p.oid) = 'p_fixture_id bigint';

  if v_def is null then
    raise exception '104: get_futebol_fixture_value(bigint) não existe.';
  end if;

  -- Idempotência.
  if position('kickoff_utc > (now() at time zone ''UTC'')' in v_def) > 0 then
    raise notice '104: o corte de kickoff já usa fuso explícito, nada a fazer.';
    return;
  end if;

  if position('v_src as (' in v_def) = 0 then
    raise exception '104: get_futebol_fixture_value ainda não tem a CTE v_src. Aplique a 101 antes.';
  end if;

  if array_length(string_to_array(v_def, v_ancora_futuro), 1) - 1 <> 1 then
    raise exception '104: a âncora do ramo FUTURO aparece % vez(es), esperava exatamente 1.',
      array_length(string_to_array(v_def, v_ancora_futuro), 1) - 1;
  end if;

  if array_length(string_to_array(v_def, v_ancora_passado), 1) - 1 <> 1 then
    raise exception '104: a âncora do ramo PASSADO aparece % vez(es), esperava exatamente 1.',
      array_length(string_to_array(v_def, v_ancora_passado), 1) - 1;
  end if;

  v_novo := replace(v_def, v_ancora_futuro, v_novo_futuro);
  v_novo := replace(v_novo, v_ancora_passado, v_novo_passado);

  execute v_novo;
  raise notice '104: get_futebol_fixture_value passou a comparar kickoff com UTC explícito.';
end
$do$;

grant execute on function public.get_futebol_fixture_value(bigint) to anon, authenticated, service_role;
