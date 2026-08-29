-- 20260829180000_113_futebol_alerta_score_versao
--
-- O instantâneo do alerta guarda a escala em que a nota foi calculada
-- (spec #301, entrega #308).
--
-- A tabela já preserva Score e faixa do momento do envio, que é o que faz o
-- alerta continuar verdadeiro depois de o board ser reescrito. Sem a escala,
-- porém, um alerta de agosto e um de setembro trazem "Score 46" significando
-- coisas diferentes, e nada na base permite distinguir — que é o mesmo motivo
-- pelo qual o histórico do painel ganhou a coluna na migration 112.
--
-- Técnico: acompanha auditoria e diagnóstico, nunca aparece na mensagem.

ALTER TABLE public.futebol_publication_alerts
  ADD COLUMN IF NOT EXISTS score_versao text NOT NULL DEFAULT 'legacy';

COMMENT ON COLUMN public.futebol_publication_alerts.score_versao IS
  'Escala do Score no instante do alerta: legacy ou contexto_v1. Técnico, nunca exibido ao assinante.';

-- O detector passa a mandar a escala junto do resto do instantâneo. O retorno
-- tabular não muda, então basta recriar o corpo.
CREATE OR REPLACE FUNCTION public.claim_futebol_publication_alert_batch(
  p_sync_at timestamptz,
  p_opportunities jsonb
)
RETURNS TABLE(batch_id uuid, alert_id uuid, opportunity_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.claim_futebol_publication_alert_batch(timestamptz, jsonb) TO service_role;
