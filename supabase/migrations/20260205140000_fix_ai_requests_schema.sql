-- 20260205140000_fix_ai_requests_schema.sql
-- Fix ai_requests table schema to include all required columns
-- This migration adds any missing columns to ensure compatibility

ALTER TABLE IF EXISTS public.ai_requests
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS tokens_used integer,
  ADD COLUMN IF NOT EXISTS prompt_hash text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Update any existing rows to have a default updated_at if NULL
UPDATE public.ai_requests SET updated_at = created_at WHERE updated_at IS NULL;

-- Verify the columns exist
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='ai_requests' ORDER BY ordinal_position;
