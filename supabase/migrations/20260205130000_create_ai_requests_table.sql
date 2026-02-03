-- 20260205130000_create_ai_requests_table.sql
-- COMPLETE ai_requests TABLE FOR AI REQUEST LOGGING
-- Includes all columns needed by:
--   - /api/ai/plan/generate (tokens, prompt_preview, response_preview)
--   - /api/ai/nutrition/during-workout (tokens, latency_ms, status)
--   - /api/v1/ai/status (read all columns)

CREATE TABLE IF NOT EXISTS public.ai_requests (
  -- Identifiers
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- API Provider Info
  provider text NOT NULL DEFAULT 'openai' CHECK (provider IN ('openai', 'anthropic', 'other')),
  model text NOT NULL,
  
  -- Request Content & Hashing
  prompt_hash text,
  prompt_preview text,
  
  -- Response Content
  response_json jsonb NOT NULL,
  response_preview text,
  
  -- Status & Error Tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_code text,
  error_message text,
  
  -- Performance Metrics
  tokens integer,
  latency_ms integer,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure all necessary indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_id 
  ON public.ai_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at 
  ON public.ai_requests (created_at);

CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created 
  ON public.ai_requests (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_requests_status 
  ON public.ai_requests (status);

CREATE INDEX IF NOT EXISTS idx_ai_requests_provider 
  ON public.ai_requests (provider);

CREATE INDEX IF NOT EXISTS idx_ai_requests_model 
  ON public.ai_requests (model);

-- Enable Row-Level Security
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_requests' AND policyname='ai_requests_select_own'
  ) THEN
    CREATE POLICY ai_requests_select_own ON public.ai_requests FOR SELECT USING (user_id = auth.uid());
  END IF;
END$$;

-- RLS Policy: Users can only insert their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_requests' AND policyname='ai_requests_insert_own'
  ) THEN
    CREATE POLICY ai_requests_insert_own ON public.ai_requests FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- RLS Policy: Users can only update their own requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_requests' AND policyname='ai_requests_update_own'
  ) THEN
    CREATE POLICY ai_requests_update_own ON public.ai_requests FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- Verification queries:
-- SELECT * FROM public.ai_requests LIMIT 5;
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='ai_requests' ORDER BY ordinal_position;
-- SELECT COUNT(*) as indexes FROM pg_indexes WHERE tablename='ai_requests';
-- SELECT policyname, permissive FROM pg_policies WHERE tablename='ai_requests';
