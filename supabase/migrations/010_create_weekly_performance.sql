-- Create weekly_performance table to store weekly user performance metrics
CREATE TABLE IF NOT EXISTS public.weekly_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL, -- Domingo da semana (primeiro dia da semana)
  week_end_date DATE NOT NULL, -- Sábado da semana (último dia da semana)
  
  -- Métricas gerais
  total_bets INTEGER NOT NULL DEFAULT 0,
  total_staked NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_won NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Soma dos potential_return das apostas ganhas
  total_lost NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Soma dos stake_amount das apostas perdidas
  total_cashout NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Soma dos cashout_amount
  total_pending NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Soma dos stake_amount das apostas pendentes
  net_profit NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Lucro líquido: (total_won + total_cashout) - total_lost
  
  -- Métricas por esporte (JSONB para flexibilidade)
  sport_breakdown JSONB DEFAULT '{}'::jsonb, -- { "sport_name": { "total_bets": X, "total_staked": Y, "total_won": Z, "total_lost": W, "total_cashout": V, "net_profit": N } }
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir uma única entrada por usuário por semana
  CONSTRAINT weekly_performance_user_week_unique UNIQUE (user_id, week_start_date)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_weekly_performance_user_id ON public.weekly_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_performance_week_start ON public.weekly_performance(week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_performance_user_week ON public.weekly_performance(user_id, week_start_date);

-- Add comments
COMMENT ON TABLE public.weekly_performance IS 'Armazena métricas de performance semanal dos usuários, calculadas automaticamente todo domingo';
COMMENT ON COLUMN public.weekly_performance.week_start_date IS 'Data de início da semana (domingo)';
COMMENT ON COLUMN public.weekly_performance.week_end_date IS 'Data de fim da semana (sábado)';
COMMENT ON COLUMN public.weekly_performance.net_profit IS 'Lucro líquido: (total_won + total_cashout) - total_lost';
COMMENT ON COLUMN public.weekly_performance.sport_breakdown IS 'Breakdown por esporte em formato JSON';

-- Function to calculate and update weekly performance
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
  v_sport_record RECORD;
  v_sport_breakdown JSONB;
  v_total_bets INTEGER;
  v_total_staked NUMERIC(10, 2);
  v_total_won NUMERIC(10, 2);
  v_total_lost NUMERIC(10, 2);
  v_total_cashout NUMERIC(10, 2);
  v_total_pending NUMERIC(10, 2);
  v_net_profit NUMERIC(10, 2);
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

-- Trigger para atualizar updated_at
CREATE TRIGGER update_weekly_performance_updated_at
  BEFORE UPDATE ON public.weekly_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.weekly_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own performance data
CREATE POLICY "Users can only see their own weekly performance" ON public.weekly_performance
  FOR ALL USING (auth.uid() = user_id);

