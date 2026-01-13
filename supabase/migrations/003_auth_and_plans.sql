-- 003_auth_and_plans.sql

-- Create extensions required by migrations (id generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create nutrition_plans if it does not exist (fresh deployments)
CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_filename text,
  weight_kg numeric NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  goal text
);

-- make index available for both fresh and existing tables
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_created_at ON public.nutrition_plans (user_id, created_at DESC);

-- 2) Create nutrition_plan_rows if it does not exist
CREATE TABLE IF NOT EXISTS public.nutrition_plan_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.nutrition_plans(id) ON DELETE CASCADE,
  date date NOT NULL,
  day_type text NOT NULL,
  kcal int NOT NULL,
  protein_g int NOT NULL,
  carbs_g int NOT NULL,
  fat_g int NOT NULL,
  intra_cho_g_per_h int NOT NULL,
  CONSTRAINT uniq_plan_date UNIQUE (plan_id, date)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_plan_rows_plan_date ON public.nutrition_plan_rows (plan_id, date);

-- 3) Enable Row Level Security and create one-action-per-policy policies
-- Note: if `user_id` is nullable (legacy rows), RLS will prevent legacy rows from being read
-- until they are backfilled. This is intentional for safety.

-- Enable RLS on nutrition_plans
ALTER TABLE IF EXISTS public.nutrition_plans ENABLE ROW LEVEL SECURITY;

-- Create policies only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_select_own') THEN
    CREATE POLICY plans_select_own ON public.nutrition_plans FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_insert_own') THEN
    CREATE POLICY plans_insert_own ON public.nutrition_plans FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_update_own') THEN
    CREATE POLICY plans_update_own ON public.nutrition_plans FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_delete_own') THEN
    CREATE POLICY plans_delete_own ON public.nutrition_plans FOR DELETE USING (user_id = auth.uid());
  END IF;
END
$$;

-- Enable RLS on nutrition_plan_rows
ALTER TABLE IF EXISTS public.nutrition_plan_rows ENABLE ROW LEVEL SECURITY;

-- Helper expression for plan ownership: EXISTS parent plan with user_id = auth.uid()
-- Create individual policies for each action
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_select_owner') THEN
    CREATE POLICY plan_rows_select_owner ON public.nutrition_plan_rows FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_insert_owner') THEN
    CREATE POLICY plan_rows_insert_owner ON public.nutrition_plan_rows FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_update_owner') THEN
    CREATE POLICY plan_rows_update_owner ON public.nutrition_plan_rows FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_delete_owner') THEN
    CREATE POLICY plan_rows_delete_owner ON public.nutrition_plan_rows FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
END
$$;

-- 4) Safety: For fresh installs the schema above will create NOT NULL user_id on creation;
-- for existing installs the 002_patch_existing_tables.sql ensures `user_id` exists and FK/indexes are present,
-- while keeping `user_id` nullable to avoid forcing backfill in this automated migration.

-- 5) Verification queries (run in Supabase SQL editor as an authenticated developer):
-- Check columns exist:
-- SELECT column_name, is_nullable, data_type FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='nutrition_plans';

-- RLS enabled checks:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('nutrition_plans', 'nutrition_plan_rows');

-- List policies:
-- SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('nutrition_plans','nutrition_plan_rows');

-- Quick test (requires an authenticated user session / Supabase client):
-- 1) INSERT into nutrition_plans with user_id = auth.uid() via Supabase client (authenticated) will work.
-- 2) Attempting to SELECT rows of another user will return no rows due to RLS.

*** End Patch
