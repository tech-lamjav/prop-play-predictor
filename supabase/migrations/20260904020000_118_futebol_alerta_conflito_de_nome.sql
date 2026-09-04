-- ============================================================
-- 118_futebol_alerta_conflito_de_nome — o alerta de publicação volta a rodar
-- ============================================================
-- `claim_futebol_publication_alert_batch` NUNCA executou com sucesso. O defeito
-- ficou escondido atrás de outro: faltava o segredo `notify_published_opportunities_url`
-- no vault, então o cron morria antes de chamar a função — 183 falhas seguidas
-- em produção e 184 em staging, sempre no `net.http_post` com url nula.
--
-- Criado o segredo em staging (03/09), o cron passou a chamar e a função passou
-- a falhar sozinha, com:
--
--     column reference "opportunity_key" is ambiguous
--
-- A causa é a colisão entre o parâmetro de SAÍDA `opportunity_key`, declarado no
-- RETURNS TABLE, e a coluna de mesmo nome da tabela. Dentro do corpo plpgsql o
-- nome sem qualificação é ambíguo em dois lugares — `ON CONFLICT (opportunity_key)`,
-- onde o alvo do conflito não aceita alias, e `RETURNING id, opportunity_key`.
--
-- A correção é `#variable_conflict use_column`: onde o nome puder ser coluna, é
-- coluna. Preferido a renomear as saídas porque o CONTRATO da RPC não muda —
-- a edge function lê `batch_id`, `alert_id` e `opportunity_key` do JSON, e
-- renomear ali obrigaria a mexer no código que consome, sem ganho nenhum.
--
-- O corpo é o mesmo da migration 113, com a diretiva no topo. Nada de lógica
-- mudou: nem o advisory lock, nem o `ON CONFLICT DO NOTHING`, nem o `legacy` de
-- quem chega sem escala.
--
-- ⚠️ Para o alerta funcionar de verdade faltam DUAS coisas, e esta migration é
-- só uma delas. A outra não é versionável aqui: o segredo do vault, que é por
-- ambiente. Ver docs/futebol-alerta-de-publicacao.md.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_futebol_publication_alert_batch(
  p_sync_at timestamptz,
  p_opportunities jsonb
)
RETURNS TABLE(batch_id uuid, alert_id uuid, opportunity_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_batch_id uuid;
BEGIN
  -- O advisory lock torna o polling idempotente mesmo se dois crons
  -- coincidirem: sem ele, duas execuções sobrepostas não enxergam as linhas
  -- ainda não commitadas uma da outra, criam dois lotes e mandam duas mensagens
  -- para o mesmo destinatário no mesmo minuto.
  PERFORM pg_advisory_xact_lock(hashtext('futebol-publication-alerts'));

  WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset(p_opportunities) AS x(
      opportunity_key text,
      fixture_id bigint,
      home_team_name text,
      away_team_name text,
      competition text,
      kickoff_utc timestamptz,
      market text,
      outcome text,
      line_value double precision,
      best_odd numeric,
      score integer,
      faixa text,
      score_versao text,
      janela_usada text,
      edge double precision,
      prob_justa_fechamento double precision,
      evidencias text[]
    )
  )
  INSERT INTO public.futebol_publication_alert_batches (sync_at)
  SELECT p_sync_at
  WHERE EXISTS (
    SELECT 1 FROM incoming i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.futebol_publication_alerts a
      WHERE a.opportunity_key = i.opportunity_key
    )
  )
  RETURNING id INTO v_batch_id;

  IF v_batch_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset(p_opportunities) AS x(
      opportunity_key text,
      fixture_id bigint,
      home_team_name text,
      away_team_name text,
      competition text,
      kickoff_utc timestamptz,
      market text,
      outcome text,
      line_value double precision,
      best_odd numeric,
      score integer,
      faixa text,
      score_versao text,
      janela_usada text,
      edge double precision,
      prob_justa_fechamento double precision,
      evidencias text[]
    )
  ), inserted AS (
    INSERT INTO public.futebol_publication_alerts (
      batch_id, opportunity_key, fixture_id, home_team_name, away_team_name,
      competition, kickoff_utc, market, outcome, line_value, best_odd, score,
      faixa, score_versao, janela_usada, edge, prob_justa_fechamento, evidencias
    )
    SELECT v_batch_id, i.opportunity_key, i.fixture_id, i.home_team_name,
           i.away_team_name, i.competition, i.kickoff_utc, i.market,
           i.outcome, i.line_value, i.best_odd, i.score, i.faixa,
           -- Alerta antigo permanece legacy; o detector novo manda a escala.
           coalesce(i.score_versao, 'legacy'),
           i.janela_usada, i.edge, i.prob_justa_fechamento, i.evidencias
    FROM incoming i
    ON CONFLICT (opportunity_key) DO NOTHING
    RETURNING id, opportunity_key
  )
  SELECT v_batch_id, i.id, i.opportunity_key FROM inserted i;
END;
$$;

COMMENT ON FUNCTION public.claim_futebol_publication_alert_batch(timestamptz, jsonb) IS
  'Reserva o lote de oportunidades ainda não alertadas, sob advisory lock, e devolve o que entrou. Ver 118: o corpo carrega #variable_conflict use_column porque a saída e a coluna têm o mesmo nome.';

grant execute on function public.claim_futebol_publication_alert_batch(timestamptz, jsonb) to service_role;
