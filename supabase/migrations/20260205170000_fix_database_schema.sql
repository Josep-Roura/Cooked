-- 20260205170000_fix_database_schema.sql
-- FIX CURRENT DATABASE TO MATCH COMPLETE SCHEMA
-- This migration fixes the ai_requests table by:
--   1. Removing duplicate columns (tokens_used)
--   2. Adding missing columns (prompt_preview, response_preview)
--   3. Ensuring all columns have correct types and constraints
--   4. Adding proper indexes and RLS policies

-- Drop existing ai_requests table and recreate with correct schema
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

-- Create all necessary indexes for performance
CREATE INDEX idx_ai_requests_user_id ON public.ai_requests (user_id);
CREATE INDEX idx_ai_requests_created_at ON public.ai_requests (created_at);
CREATE INDEX idx_ai_requests_user_created ON public.ai_requests (user_id, created_at);
CREATE INDEX idx_ai_requests_status ON public.ai_requests (status);
CREATE INDEX idx_ai_requests_provider ON public.ai_requests (provider);
CREATE INDEX idx_ai_requests_model ON public.ai_requests (model);

-- Enable Row-Level Security
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own requests
CREATE POLICY ai_requests_select_own ON public.ai_requests FOR SELECT USING (user_id = auth.uid());

-- RLS Policy: Users can only insert their own requests
CREATE POLICY ai_requests_insert_own ON public.ai_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policy: Users can only update their own requests
CREATE POLICY ai_requests_update_own ON public.ai_requests FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
