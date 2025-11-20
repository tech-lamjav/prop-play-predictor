-- Create cron job to run every Sunday at 22:00 (10 PM)
-- Cron format: minute hour day-of-month month day-of-week
-- 0 22 * * 0 = Every Sunday at 22:00

-- Function to setup the cron job
CREATE OR REPLACE FUNCTION public.setup_performance_semanal_cron()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Check if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists (to allow re-running this migration)
    BEGIN
      PERFORM cron.unschedule('calcular-performance-semanal');
    EXCEPTION
      WHEN OTHERS THEN
        -- Job doesn't exist, which is fine - we'll create it
        NULL;
    END;
    
    -- Schedule the job to run every Sunday at 22:00 (10 PM)
    SELECT cron.schedule(
      'calcular-performance-semanal',
      '0 22 * * 0',
      'SELECT public.calcular_performance_semanal();'
    ) INTO v_job_id;
    
    RAISE NOTICE 'Cron job "calcular-performance-semanal" scheduled successfully with job_id: %', v_job_id;
  ELSE
    RAISE WARNING 'pg_cron extension is not available. Please enable it via Supabase dashboard or contact support.';
  END IF;
END;
$$;

-- Execute the function to setup the cron job
SELECT public.setup_performance_semanal_cron();

-- Verify that the cron job was created successfully
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job 
WHERE jobname = 'calcular-performance-semanal';



