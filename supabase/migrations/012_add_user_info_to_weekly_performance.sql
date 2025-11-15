-- Add user information columns to weekly_performance table
ALTER TABLE public.weekly_performance
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_whatsapp_number VARCHAR(20);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_weekly_performance_user_email ON public.weekly_performance(user_email);
CREATE INDEX IF NOT EXISTS idx_weekly_performance_user_whatsapp ON public.weekly_performance(user_whatsapp_number);

-- Add comments
COMMENT ON COLUMN public.weekly_performance.user_name IS 'Nome do usuário (snapshot no momento do cálculo)';
COMMENT ON COLUMN public.weekly_performance.user_email IS 'Email do usuário (snapshot no momento do cálculo)';
COMMENT ON COLUMN public.weekly_performance.user_whatsapp_number IS 'Número do WhatsApp do usuário (snapshot no momento do cálculo)';

-- Update the function to include user information
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
  -- Se não foi passada uma data, usa a semana anterior (domingo a sábado)
  IF p_week_start_date IS NULL THEN
    -- Encontra o último domingo
    v_week_start := DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')::DATE;
  ELSE
    v_week_start := DATE_TRUNC('week', p_week_start_date)::DATE;
  END IF;
  
  -- Sábado da semana
  v_week_end := v_week_start + INTERVAL '6 days';
  
  -- Loop através de todos os usuários que têm apostas na semana
  FOR v_user_record IN 
    SELECT DISTINCT user_id 
    FROM public.bets 
    WHERE user_id IS NOT NULL
      AND bet_date >= v_week_start 
      AND bet_date < v_week_end + INTERVAL '1 day'
  LOOP
    -- Buscar informações do usuário
    SELECT name, email, whatsapp_number
    INTO v_user_name, v_user_email, v_user_whatsapp_number
    FROM public.users
    WHERE id = v_user_record.user_id;
    
    -- Calcular métricas gerais do usuário para a semana
    SELECT 
      COUNT(*)::INTEGER,
      COALESCE(SUM(stake_amount), 0),
      COALESCE(SUM(CASE WHEN status = 'won' THEN potential_return ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status = 'lost' THEN stake_amount ELSE 0 END), 0),
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
    
    -- Calcular lucro líquido
    v_net_profit := (v_total_won + v_total_cashout) - v_total_lost;
    
    -- Calcular breakdown por esporte
    v_sport_breakdown := '{}'::jsonb;
    
    FOR v_sport_record IN
      SELECT 
        sport,
        COUNT(*)::INTEGER as total_bets,
        COALESCE(SUM(stake_amount), 0) as total_staked,
        COALESCE(SUM(CASE WHEN status = 'won' THEN potential_return ELSE 0 END), 0) as total_won,
        COALESCE(SUM(CASE WHEN status = 'lost' THEN stake_amount ELSE 0 END), 0) as total_lost,
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
    
    -- Inserir ou atualizar registro
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

