-- 002_patch_existing_tables.sql
-- Safe patch to prepare existing tables for auth-based ownership
-- This migration is idempotent and only adds missing columns/constraints/indexes

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add user_id column to nutrition_plans if it does not exist yet.
ALTER TABLE IF EXISTS public.nutrition_plans
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add FK constraint on nutrition_plans.user_id if not already present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE c.relname='nutrition_plans' AND n.nspname='public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.nutrition_plans'::regclass
      AND contype = 'f'
      AND array_to_string(conkey, ',') LIKE '%user_id%'
    ) THEN
      BEGIN
        ALTER TABLE public.nutrition_plans
          ADD CONSTRAINT fk_nutrition_plans_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END IF;
END
$$;

-- Add user_id column to nutrition_plan_rows if it does not exist (kept for compatibility)
ALTER TABLE IF EXISTS public.nutrition_plan_rows
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Ensure plan_id FK and unique constraint exist on nutrition_plan_rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE c.relname='nutrition_plan_rows' AND n.nspname='public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.nutrition_plan_rows'::regclass
      AND contype = 'f'
      AND array_to_string(conkey, ',') LIKE '%plan_id%'
    ) THEN
      BEGIN
        ALTER TABLE public.nutrition_plan_rows
          ADD CONSTRAINT fk_nutrition_plan_rows_plan_id FOREIGN KEY (plan_id) REFERENCES public.nutrition_plans(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.nutrition_plan_rows'::regclass
      AND contype = 'u'
      AND conname = 'uniq_plan_date'
    ) THEN
      BEGIN
        ALTER TABLE public.nutrition_plan_rows
          ADD CONSTRAINT uniq_plan_date UNIQUE (plan_id, date);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END IF;
END
$$;

-- Create helpful indexes if missing
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_created_at ON public.nutrition_plans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_plan_rows_plan_date ON public.nutrition_plan_rows (plan_id, date);

-- NOTE: We keep `user_id` nullable in this patch for safety. Backfill must be performed
-- separately (map legacy `user_key`/device_id to `auth.users.id`) and then the column
-- can be set NOT NULL and tightened. This migration avoids changing existing data.
