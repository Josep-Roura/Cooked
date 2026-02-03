-- 20260205130000_create_ai_requests_table.sql
-- Create ai_requests table to log AI API calls for rate limiting and debugging

CREATE TABLE IF NOT EXISTS public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'openai', 'anthropic', etc
  model text NOT NULL, -- 'gpt-4o-mini', 'gpt-4', etc
  prompt_hash text, -- Hash of the prompt for deduplication
  response_json jsonb NOT NULL, -- Full response from AI provider
  error_code text, -- Error code if request failed
  error_message text, -- Error message if request failed
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  tokens_used integer, -- Tokens consumed if available
  duration_ms integer, -- How long the request took
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_id ON public.ai_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON public.ai_requests (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created ON public.ai_requests (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON public.ai_requests (status);

-- RLS policies
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_requests' AND policyname='ai_requests_select_own'
  ) THEN
    CREATE POLICY ai_requests_select_own ON public.ai_requests FOR SELECT USING (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_requests' AND policyname='ai_requests_insert_own'
  ) THEN
    CREATE POLICY ai_requests_insert_own ON public.ai_requests FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='ai_requests' AND policyname='ai_requests_update_own'
  ) THEN
    CREATE POLICY ai_requests_update_own ON public.ai_requests FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- Verification:
-- SELECT * FROM public.ai_requests LIMIT 5;
-- SELECT COUNT(*) FROM public.ai_requests WHERE DATE(created_at) = CURRENT_DATE;
