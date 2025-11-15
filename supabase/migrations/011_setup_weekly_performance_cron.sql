-- Enable pg_cron extension (if not already enabled)
-- Note: This might require superuser privileges. In Supabase, this is usually already enabled.
-- If not, you may need to enable it via Supabase dashboard or contact support.

-- Create cron job to run every Sunday at 22:00 (10 PM)
-- Cron format: minute hour day-of-month month day-of-week
-- 0 22 * * 0 = Every Sunday at 22:00

-- Function to setup the cron job
CREATE OR REPLACE FUNCTION public.setup_weekly_performance_cron()
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
    -- Use exception handling to avoid error if job doesn't exist
    BEGIN
      PERFORM cron.unschedule('calculate-weekly-performance');
    EXCEPTION
      WHEN OTHERS THEN
        -- Job doesn't exist, which is fine - we'll create it
        NULL;
    END;
    
    -- Schedule the job to run every Sunday at 22:00 (10 PM)
    SELECT cron.schedule(
      'calculate-weekly-performance',
      '0 22 * * 0',
      'SELECT public.calculate_weekly_performance();'
    ) INTO v_job_id;
    
    RAISE NOTICE 'Cron job "calculate-weekly-performance" scheduled successfully with job_id: %', v_job_id;
  ELSE
    RAISE WARNING 'pg_cron extension is not available. Please enable it via Supabase dashboard or contact support.';
  END IF;
END;
$$;

-- Execute the function to setup the cron job
SELECT public.setup_weekly_performance_cron();

-- Verify that the cron job was created successfully (only if pg_cron is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM 1 FROM cron.job WHERE jobname = 'calculate-weekly-performance';
  END IF;
END $$;

-- Alternative: If pg_cron is not available, you can use Supabase Edge Functions with scheduled triggers
-- or use an external cron service to call the function via HTTP

-- For reference, here's how to manually create the cron job if pg_cron is enabled:
-- SELECT cron.schedule(
--   'calculate-weekly-performance',
--   '0 22 * * 0', -- Every Sunday at 22:00
--   $$SELECT public.calculate_weekly_performance();$$
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule a job:
-- SELECT cron.unschedule('calculate-weekly-performance');

