-- Create performance_semanal table to store weekly user performance metrics with WhatsApp message
CREATE TABLE IF NOT EXISTS public.performance_semanal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  user_whatsapp_number VARCHAR(20),
  
  -- Datas da semana
  semana_inicio DATE NOT NULL, -- Domingo da semana
  semana_fim DATE NOT NULL, -- Sábado da semana
  
  -- Métricas gerais
  total_apostas INTEGER NOT NULL DEFAULT 0,
  valor_apostado NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ganhos NUMERIC(10, 2) NOT NULL DEFAULT 0,
  perdas NUMERIC(10, 2) NOT NULL DEFAULT 0,
  apostas_pendentes NUMERIC(10, 2) NOT NULL DEFAULT 0,
  cashout NUMERIC(10, 2) NOT NULL DEFAULT 0,
  lucro_liquido NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Breakdown por esporte (JSONB)
  breakdown_por_esporte JSONB DEFAULT '{}'::jsonb,
  
  -- Mensagem formatada para WhatsApp
  mensagem_whatsapp TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Garantir uma única entrada por usuário por semana
  CONSTRAINT performance_semanal_user_semana_unique UNIQUE (user_id, semana_inicio)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_performance_semanal_user_id ON public.performance_semanal(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_semanal_semana_inicio ON public.performance_semanal(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_performance_semanal_user_semana ON public.performance_semanal(user_id, semana_inicio);
CREATE INDEX IF NOT EXISTS idx_performance_semanal_user_email ON public.performance_semanal(user_email);
CREATE INDEX IF NOT EXISTS idx_performance_semanal_user_whatsapp ON public.performance_semanal(user_whatsapp_number);

-- Add comments
COMMENT ON TABLE public.performance_semanal IS 'Armazena métricas de performance semanal dos usuários com mensagem formatada para WhatsApp';
COMMENT ON COLUMN public.performance_semanal.semana_inicio IS 'Data de início da semana (domingo)';
COMMENT ON COLUMN public.performance_semanal.semana_fim IS 'Data de fim da semana (sábado)';
COMMENT ON COLUMN public.performance_semanal.mensagem_whatsapp IS 'Mensagem formatada pronta para enviar via WhatsApp';
COMMENT ON COLUMN public.performance_semanal.breakdown_por_esporte IS 'Breakdown por esporte em formato JSON';

-- Function to format currency value
CREATE OR REPLACE FUNCTION format_currency(value NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN 'R$ ' || TO_CHAR(value, 'FM999,999,990.00');
END;
$$;

-- Function to format date (DD/MM/YYYY)
CREATE OR REPLACE FUNCTION format_date_br(date_value DATE)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN TO_CHAR(date_value, 'DD/MM/YYYY');
END;
$$;

-- Function to generate WhatsApp message
CREATE OR REPLACE FUNCTION generate_whatsapp_message(
  p_user_name VARCHAR,
  p_semana_inicio DATE,
  p_semana_fim DATE,
  p_total_apostas INTEGER,
  p_valor_apostado NUMERIC,
  p_ganhos NUMERIC,
  p_perdas NUMERIC,
  p_apostas_pendentes NUMERIC,
  p_cashout NUMERIC,
  p_lucro_liquido NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_mensagem TEXT;
BEGIN
  v_mensagem := '🎯 *Relatório Semanal de Apostas*' || E'\n\n';
  v_mensagem := v_mensagem || '📅 Período: ' || format_date_br(p_semana_inicio) || ' - ' || format_date_br(p_semana_fim) || E'\n\n';
  v_mensagem := v_mensagem || E'\n';
  v_mensagem := v_mensagem || '👤 *' || COALESCE(p_user_name, 'Usuário') || '*' || E'\n\n';
  v_mensagem := v_mensagem || E'\n';
  v_mensagem := v_mensagem || '📊 *Resumo da Semana:*' || E'\n\n';
  v_mensagem := v_mensagem || '• Total de Apostas: *' || p_total_apostas::TEXT || '*' || E'\n';
  v_mensagem := v_mensagem || '• Valor Apostado: *' || format_currency(p_valor_apostado) || '*' || E'\n';
  v_mensagem := v_mensagem || '• Ganhos: *' || format_currency(p_ganhos) || '*' || E'\n';
  v_mensagem := v_mensagem || '• Perdas: *' || format_currency(p_perdas) || '*' || E'\n';
  v_mensagem := v_mensagem || '• Apostas Pendentes: *' || format_currency(p_apostas_pendentes) || '*' || E'\n';
  
  -- Adicionar cashout se houver
  IF p_cashout > 0 THEN
    v_mensagem := v_mensagem || '• Cashout: *' || format_currency(p_cashout) || '*' || E'\n';
  END IF;
  
  v_mensagem := v_mensagem || E'\n';
  v_mensagem := v_mensagem || '💰 *Lucro Líquido: ' || format_currency(p_lucro_liquido) || '*' || E'\n';
  
  RETURN v_mensagem;
END;
$$;

-- Function to calculate and update weekly performance
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
  -- Se não foi passada uma data, usa a semana anterior (domingo a sábado)
  IF p_semana_inicio IS NULL THEN
    -- Encontra o último domingo
    v_semana_inicio := DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days')::DATE;
  ELSE
    v_semana_inicio := DATE_TRUNC('week', p_semana_inicio)::DATE;
  END IF;
  
  -- Sábado da semana
  v_semana_fim := v_semana_inicio + INTERVAL '6 days';
  
  -- Loop através de todos os usuários que têm apostas na semana
  FOR v_user_record IN 
    SELECT DISTINCT user_id 
    FROM public.bets 
    WHERE user_id IS NOT NULL
      AND bet_date >= v_semana_inicio 
      AND bet_date < v_semana_fim + INTERVAL '1 day'
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
    
    -- Calcular lucro líquido
    v_lucro_liquido := (v_ganhos + v_cashout) - v_perdas;
    
    -- Calcular breakdown por esporte
    v_breakdown_por_esporte := '{}'::jsonb;
    
    FOR v_sport_record IN
      SELECT 
        sport,
        COUNT(*)::INTEGER as total_apostas,
        COALESCE(SUM(stake_amount), 0) as valor_apostado,
        COALESCE(SUM(CASE WHEN status = 'won' THEN potential_return ELSE 0 END), 0) as ganhos,
        COALESCE(SUM(CASE WHEN status = 'lost' THEN stake_amount ELSE 0 END), 0) as perdas,
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
    
    -- Gerar mensagem WhatsApp
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
    
    -- Inserir ou atualizar registro
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

-- Trigger para atualizar updated_at
CREATE TRIGGER update_performance_semanal_updated_at
  BEFORE UPDATE ON public.performance_semanal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.performance_semanal ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own performance data
CREATE POLICY "Users can only see their own performance semanal" ON public.performance_semanal
  FOR ALL USING (auth.uid() = user_id);



