-- 20260205180000_complete_database_fix.sql
-- COMPLETE DATABASE FIX - RECREATE ALL MISSING/BROKEN TABLES
-- This migration fixes:
--   1. ai_requests table (schema issues, duplicate columns)
--   2. plan_revisions table (was dropped but still used by code)

-- ============================================================================
-- FIX 1: ai_requests table
-- ============================================================================
-- Drop and recreate with correct schema
DROP TABLE IF EXISTS public.ai_requests CASCADE;

CREATE TABLE public.ai_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_hash text,
  response_json jsonb NOT NULL,
  error_code text,
  error_message text,
  status text NOT NULL DEFAULT 'pending'::text,
  latency_ms integer,
  prompt_preview text,
  response_preview text,
  tokens integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_requests_pkey PRIMARY KEY (id),
  CONSTRAINT ai_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_ai_requests_user_id ON public.ai_requests (user_id);
CREATE INDEX idx_ai_requests_created_at ON public.ai_requests (created_at);
CREATE INDEX idx_ai_requests_user_created ON public.ai_requests (user_id, created_at);
CREATE INDEX idx_ai_requests_status ON public.ai_requests (status);
CREATE INDEX idx_ai_requests_provider ON public.ai_requests (provider);
CREATE INDEX idx_ai_requests_model ON public.ai_requests (model);

-- Enable Row-Level Security
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_requests
CREATE POLICY ai_requests_select_own ON public.ai_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY ai_requests_insert_own ON public.ai_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_requests_update_own ON public.ai_requests FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 2: plan_revisions table (recreate if missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plan_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT plan_revisions_pkey PRIMARY KEY (id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS plan_revisions_user_week_start_idx ON public.plan_revisions (user_id, week_start);

-- Enable Row-Level Security
ALTER TABLE public.plan_revisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_revisions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plan_revisions' AND policyname='plan_revisions_select_own'
  ) THEN
    CREATE POLICY plan_revisions_select_own ON public.plan_revisions FOR SELECT USING (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plan_revisions' AND policyname='plan_revisions_insert_own'
  ) THEN
    CREATE POLICY plan_revisions_insert_own ON public.plan_revisions FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plan_revisions' AND policyname='plan_revisions_update_own'
  ) THEN
    CREATE POLICY plan_revisions_update_own ON public.plan_revisions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plan_revisions' AND policyname='plan_revisions_delete_own'
  ) THEN
    CREATE POLICY plan_revisions_delete_own ON public.plan_revisions FOR DELETE USING (user_id = auth.uid());
  END IF;
END$$;
