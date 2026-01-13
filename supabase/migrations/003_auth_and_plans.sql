-- 003_auth_and_plans.sql

-- Migration to create nutrition plans tables owned by `auth.users` + RLS
-- Safe for fresh installs and compatible with the prior patch migration that
-- adds `user_id` to existing tables when needed.

-- Ensure pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create nutrition_plans table (fresh install)
CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- For fresh installs we require user_id NOT NULL; for existing installs the
  -- patch migration will add a nullable column if needed. We attempt to set
  -- NOT NULL later only when it's safe.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_filename text,
  weight_kg numeric NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  goal text
);

CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_created_at ON public.nutrition_plans (user_id, created_at DESC);

-- Create nutrition_plan_rows table
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

-- Enable Row Level Security (idempotent)
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_plan_rows ENABLE ROW LEVEL SECURITY;

-- Policies for `nutrition_plans` (one action per policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_select_own'
  ) THEN
    CREATE POLICY plans_select_own ON public.nutrition_plans FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_insert_own'
  ) THEN
    CREATE POLICY plans_insert_own ON public.nutrition_plans FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_update_own'
  ) THEN
    CREATE POLICY plans_update_own ON public.nutrition_plans FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plans' AND policyname='plans_delete_own'
  ) THEN
    CREATE POLICY plans_delete_own ON public.nutrition_plans FOR DELETE USING (user_id = auth.uid());
  END IF;
END
$$;

-- Policies for `nutrition_plan_rows` (parent ownership checks)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_select_owner'
  ) THEN
    CREATE POLICY plan_rows_select_owner ON public.nutrition_plan_rows FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_insert_owner'
  ) THEN
    CREATE POLICY plan_rows_insert_owner ON public.nutrition_plan_rows FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_update_owner'
  ) THEN
    CREATE POLICY plan_rows_update_owner ON public.nutrition_plan_rows FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='nutrition_plan_rows' AND policyname='plan_rows_delete_owner'
  ) THEN
    CREATE POLICY plan_rows_delete_owner ON public.nutrition_plan_rows FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.nutrition_plans p WHERE p.id = plan_id AND p.user_id = auth.uid())
    );
  END IF;
END
$$;

-- If the table previously had nullable user_id rows, only set NOT NULL when safe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relname='nutrition_plans') THEN
    PERFORM 1;
    IF (SELECT count(*) FROM public.nutrition_plans WHERE user_id IS NULL) = 0 THEN
      -- safe to enforce NOT NULL
      ALTER TABLE public.nutrition_plans ALTER COLUMN user_id SET NOT NULL;
    END IF;
  END IF;
END
$$;

-- Verification queries (run manually in SQL editor)
-- 1) Check columns exist:
-- SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='nutrition_plans';
-- SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='nutrition_plan_rows';

-- 2) Check RLS enabled:
-- SELECT relrowsecurity FROM pg_class WHERE relname='nutrition_plans';
-- SELECT relrowsecurity FROM pg_class WHERE relname='nutrition_plan_rows';

-- 3) Check policies:
-- SELECT * FROM pg_policies WHERE tablename IN ('nutrition_plans','nutrition_plan_rows');

-- 4) Quick manual insert (requires authenticated session with Supabase JWT):
-- INSERT INTO public.nutrition_plans (user_id, weight_kg, start_date, end_date) VALUES ('<auth.user.id>', 80, now()::date, (now()+integer '7')::date);

*** End Patch
