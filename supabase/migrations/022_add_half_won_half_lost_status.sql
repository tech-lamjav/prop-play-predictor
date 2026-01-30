-- Add support for half_won (Meio Green) and half_lost (Meio Red) bet status in weekly performance calculations.
-- half_won: return = (stake_amount + potential_return) / 2
-- half_lost: return = stake_amount / 2 (half stake back, half lost)

-- Update calculate_weekly_performance to include half_won and half_lost
CREATE OR REPLACE FUNCTION public.calculate_weekly_performance(
  p_week_start_date DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_week_start DATE;
  v_week_end DATE;
  v_user_record RECORD;
  v_user_info RECORD;
  v_sport_record RECORD;
  v_sport_breakdown JSONB;
  v_total_bets INTEGER;
  v_total_staked NUMERIC(10, 2);
  v_total_won NUMERIC(10, 2);
  v_total_lost NUMERIC(10, 2);
  v_total_cashout NUMERIC(10, 2);
  v_total_pending NUMERIC(10, 2);
  v_net_profit NUMERIC(10, 2);
  v_user_name VARCHAR(255);
  v_user_email VARCHAR(255);
  v_user_whatsapp_number VARCHAR(20);
BEGIN
  IF p_week_start_date IS NULL THEN
    v_week_start := DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')::DATE;
  ELSE
    v_week_start := DATE_TRUNC('week', p_week_start_date)::DATE;
  END IF;
  
  v_week_end := v_week_start + INTERVAL '6 days';
  
  FOR v_user_record IN 
    SELECT DISTINCT user_id 
    FROM public.bets 
    WHERE user_id IS NOT NULL
      AND bet_date >= v_week_start 
      AND bet_date < v_week_end + INTERVAL '1 day'
  LOOP
    SELECT name, email, whatsapp_number
    INTO v_user_name, v_user_email, v_user_whatsapp_number
    FROM public.users
    WHERE id = v_user_record.user_id;
    
    SELECT 
      COUNT(*)::INTEGER,
      COALESCE(SUM(stake_amount), 0),
      COALESCE(SUM(CASE 
        WHEN status = 'won' THEN potential_return 
        WHEN status = 'half_won' THEN (stake_amount + potential_return) / 2 
        ELSE 0 END), 0),
      COALESCE(SUM(CASE 
        WHEN status = 'lost' THEN stake_amount 
        WHEN status = 'half_lost' THEN stake_amount / 2 
        ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'cashout' THEN COALESCE(cashout_amount, 0) ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'pending' THEN stake_amount ELSE 0 END), 0)
    INTO 
      v_total_bets,
      v_total_staked,
      v_total_won,
      v_total_lost,
      v_total_cashout,
      v_total_pending
    FROM public.bets
    WHERE user_id = v_user_record.user_id
      AND bet_date >= v_week_start 
      AND bet_date < v_week_end + INTERVAL '1 day';
    
    v_net_profit := (v_total_won + v_total_cashout) - v_total_lost;
    v_sport_breakdown := '{}'::jsonb;
    
    FOR v_sport_record IN
      SELECT 
        sport,
        COUNT(*)::INTEGER as total_bets,
        COALESCE(SUM(stake_amount), 0) as total_staked,
        COALESCE(SUM(CASE 
          WHEN status = 'won' THEN potential_return 
          WHEN status = 'half_won' THEN (stake_amount + potential_return) / 2 
          ELSE 0 END), 0) as total_won,
        COALESCE(SUM(CASE 
          WHEN status = 'lost' THEN stake_amount 
          WHEN status = 'half_lost' THEN stake_amount / 2 
          ELSE 0 END), 0) as total_lost,
        COALESCE(SUM(CASE WHEN status = 'cashout' THEN COALESCE(cashout_amount, 0) ELSE 0 END), 0) as total_cashout,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN stake_amount ELSE 0 END), 0) as total_pending
      FROM public.bets
      WHERE user_id = v_user_record.user_id
        AND bet_date >= v_week_start 
        AND bet_date < v_week_end + INTERVAL '1 day'
      GROUP BY sport
    LOOP
      v_sport_breakdown := v_sport_breakdown || jsonb_build_object(
        v_sport_record.sport,
        jsonb_build_object(
          'total_bets', v_sport_record.total_bets,
          'total_staked', v_sport_record.total_staked,
          'total_won', v_sport_record.total_won,
          'total_lost', v_sport_record.total_lost,
          'total_cashout', v_sport_record.total_cashout,
          'total_pending', v_sport_record.total_pending,
          'net_profit', (v_sport_record.total_won + v_sport_record.total_cashout) - v_sport_record.total_lost
        )
      );
    END LOOP;
    
    INSERT INTO public.weekly_performance (
      user_id,
      user_name,
      user_email,
      user_whatsapp_number,
      week_start_date,
      week_end_date,
      total_bets,
      total_staked,
      total_won,
      total_lost,
      total_cashout,
      total_pending,
      net_profit,
      sport_breakdown
    ) VALUES (
      v_user_record.user_id,
      v_user_name,
      v_user_email,
      v_user_whatsapp_number,
      v_week_start,
      v_week_end,
      v_total_bets,
      v_total_staked,
      v_total_won,
      v_total_lost,
      v_total_cashout,
      v_total_pending,
      v_net_profit,
      v_sport_breakdown
    )
    ON CONFLICT (user_id, week_start_date)
    DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_email = EXCLUDED.user_email,
      user_whatsapp_number = EXCLUDED.user_whatsapp_number,
      total_bets = EXCLUDED.total_bets,
      total_staked = EXCLUDED.total_staked,
      total_won = EXCLUDED.total_won,
      total_lost = EXCLUDED.total_lost,
      total_cashout = EXCLUDED.total_cashout,
      total_pending = EXCLUDED.total_pending,
      net_profit = EXCLUDED.net_profit,
      sport_breakdown = EXCLUDED.sport_breakdown,
      updated_at = NOW();
    
  END LOOP;
END;
$$;

-- Update calcular_performance_semanal to include half_won and half_lost
CREATE OR REPLACE FUNCTION public.calcular_performance_semanal(
  p_semana_inicio DATE DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_semana_inicio DATE;
  v_semana_fim DATE;
  v_user_record RECORD;
  v_sport_record RECORD;
  v_breakdown_por_esporte JSONB;
  v_total_apostas INTEGER;
  v_valor_apostado NUMERIC(10, 2);
  v_ganhos NUMERIC(10, 2);
  v_perdas NUMERIC(10, 2);
  v_apostas_pendentes NUMERIC(10, 2);
  v_cashout NUMERIC(10, 2);
  v_lucro_liquido NUMERIC(10, 2);
  v_user_name VARCHAR(255);
  v_user_email VARCHAR(255);
  v_user_whatsapp_number VARCHAR(20);
  v_mensagem_whatsapp TEXT;
BEGIN
  IF p_semana_inicio IS NULL THEN
    v_semana_inicio := DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')::DATE;
  ELSE
    v_semana_inicio := DATE_TRUNC('week', p_semana_inicio)::DATE;
  END IF;
  
  v_semana_fim := v_semana_inicio + INTERVAL '6 days';
  
  FOR v_user_record IN 
    SELECT DISTINCT user_id 
    FROM public.bets 
    WHERE user_id IS NOT NULL
      AND bet_date >= v_semana_inicio 
      AND bet_date < v_semana_fim + INTERVAL '1 day'
  LOOP
    SELECT name, email, whatsapp_number
    INTO v_user_name, v_user_email, v_user_whatsapp_number
    FROM public.users
    WHERE id = v_user_record.user_id;
    
    SELECT 
      COUNT(*)::INTEGER,
      COALESCE(SUM(stake_amount), 0),
      COALESCE(SUM(CASE 
        WHEN status = 'won' THEN potential_return 
        WHEN status = 'half_won' THEN (stake_amount + potential_return) / 2 
        ELSE 0 END), 0),
      COALESCE(SUM(CASE 
        WHEN status = 'lost' THEN stake_amount 
        WHEN status = 'half_lost' THEN stake_amount / 2 
        ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'pending' THEN stake_amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'cashout' THEN COALESCE(cashout_amount, 0) ELSE 0 END), 0)
    INTO 
      v_total_apostas,
      v_valor_apostado,
      v_ganhos,
      v_perdas,
      v_apostas_pendentes,
      v_cashout
    FROM public.bets
    WHERE user_id = v_user_record.user_id
      AND bet_date >= v_semana_inicio 
      AND bet_date < v_semana_fim + INTERVAL '1 day';
    
    v_lucro_liquido := (v_ganhos + v_cashout) - v_perdas;
    v_breakdown_por_esporte := '{}'::jsonb;
    
    FOR v_sport_record IN
      SELECT 
        sport,
        COUNT(*)::INTEGER as total_apostas,
        COALESCE(SUM(stake_amount), 0) as valor_apostado,
        COALESCE(SUM(CASE 
          WHEN status = 'won' THEN potential_return 
          WHEN status = 'half_won' THEN (stake_amount + potential_return) / 2 
          ELSE 0 END), 0) as ganhos,
        COALESCE(SUM(CASE 
          WHEN status = 'lost' THEN stake_amount 
          WHEN status = 'half_lost' THEN stake_amount / 2 
          ELSE 0 END), 0) as perdas,
        COALESCE(SUM(CASE WHEN status = 'cashout' THEN COALESCE(cashout_amount, 0) ELSE 0 END), 0) as cashout,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN stake_amount ELSE 0 END), 0) as pendentes
      FROM public.bets
      WHERE user_id = v_user_record.user_id
        AND bet_date >= v_semana_inicio 
        AND bet_date < v_semana_fim + INTERVAL '1 day'
      GROUP BY sport
    LOOP
      v_breakdown_por_esporte := v_breakdown_por_esporte || jsonb_build_object(
        v_sport_record.sport,
        jsonb_build_object(
          'total_apostas', v_sport_record.total_apostas,
          'valor_apostado', v_sport_record.valor_apostado,
          'ganhos', v_sport_record.ganhos,
          'perdas', v_sport_record.perdas,
          'cashout', v_sport_record.cashout,
          'pendentes', v_sport_record.pendentes,
          'lucro_liquido', (v_sport_record.ganhos + v_sport_record.cashout) - v_sport_record.perdas
        )
      );
    END LOOP;
    
    v_mensagem_whatsapp := generate_whatsapp_message(
      v_user_name,
      v_semana_inicio,
      v_semana_fim,
      v_total_apostas,
      v_valor_apostado,
      v_ganhos,
      v_perdas,
      v_apostas_pendentes,
      v_cashout,
      v_lucro_liquido
    );
    
    INSERT INTO public.performance_semanal (
      user_id,
      user_name,
      user_email,
      user_whatsapp_number,
      semana_inicio,
      semana_fim,
      total_apostas,
      valor_apostado,
      ganhos,
      perdas,
      apostas_pendentes,
      cashout,
      lucro_liquido,
      breakdown_por_esporte,
      mensagem_whatsapp
    ) VALUES (
      v_user_record.user_id,
      v_user_name,
      v_user_email,
      v_user_whatsapp_number,
      v_semana_inicio,
      v_semana_fim,
      v_total_apostas,
      v_valor_apostado,
      v_ganhos,
      v_perdas,
      v_apostas_pendentes,
      v_cashout,
      v_lucro_liquido,
      v_breakdown_por_esporte,
      v_mensagem_whatsapp
    )
    ON CONFLICT (user_id, semana_inicio)
    DO UPDATE SET
      user_name = EXCLUDED.user_name,
      user_email = EXCLUDED.user_email,
      user_whatsapp_number = EXCLUDED.user_whatsapp_number,
      total_apostas = EXCLUDED.total_apostas,
      valor_apostado = EXCLUDED.valor_apostado,
      ganhos = EXCLUDED.ganhos,
      perdas = EXCLUDED.perdas,
      apostas_pendentes = EXCLUDED.apostas_pendentes,
      cashout = EXCLUDED.cashout,
      lucro_liquido = EXCLUDED.lucro_liquido,
      breakdown_por_esporte = EXCLUDED.breakdown_por_esporte,
      mensagem_whatsapp = EXCLUDED.mensagem_whatsapp,
      updated_at = NOW();
    
  END LOOP;
END;
$$;
