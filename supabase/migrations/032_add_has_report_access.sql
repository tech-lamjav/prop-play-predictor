-- Add manual flag for report access
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_report_access boolean DEFAULT false;

-- Allow RLS reads (users already have SELECT on their own row)
COMMENT ON COLUMN public.users.has_report_access IS 'Manual flag to grant report access — set via Supabase dashboard';
