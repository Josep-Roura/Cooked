-- 005_profiles_meta.sql

-- Add a `meta jsonb` column to `public.profiles` to store onboarding payload
-- Idempotent: safe to run on existing databases.

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS meta jsonb;

-- GIN index to support queries on jsonb if needed
CREATE INDEX IF NOT EXISTS idx_profiles_meta_gin ON public.profiles USING gin (meta);

-- Verification:
-- SELECT id, email, full_name, meta FROM public.profiles LIMIT 5;
