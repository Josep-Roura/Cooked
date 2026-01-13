-- 002_5_patch_existing_tables.sql
-- Safe patch to add missing columns/constraints for migration to auth-based ownership.
-- This migration is idempotent and can be run multiple times.

-- Ensure UUID generator is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add user_id column to nutrition_plans if missing (keep nullable for safety)
ALTER TABLE IF EXISTS public.nutrition_plans
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Add FK constraint on nutrition_plans.user_id -> auth.users(id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_nutrition_plans_user_id'
  ) THEN
    ALTER TABLE public.nutrition_plans
      ADD CONSTRAINT fk_nutrition_plans_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Ensure nutrition_plan_rows exists before operating on it
ALTER TABLE IF EXISTS public.nutrition_plan_rows
  ADD COLUMN IF NOT EXISTS id uuid;

-- If the table exists and 'id' was added, set default if missing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='nutrition_plan_rows' AND column_name='id') THEN
    -- set default for id if no default exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      JOIN pg_class c ON c.oid = d.adrelid
      WHERE c.relname = 'nutrition_plan_rows' AND a.attname = 'id'
    ) THEN
      ALTER TABLE public.nutrition_plan_rows ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;
  END IF;
END
$$;

-- Add unique constraint on (plan_id, date) if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_plan_date') THEN
    ALTER TABLE IF EXISTS public.nutrition_plan_rows
      ADD CONSTRAINT uniq_plan_date UNIQUE (plan_id, date);
  END IF;
END
$$;

-- Add indexes if missing
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_user_created_at ON public.nutrition_plans (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_plan_rows_plan_date ON public.nutrition_plan_rows (plan_id, date);

-- NOTE: We keep `user_id` nullable to avoid breaking legacy rows. Perform an explicit
-- backfill in a separate operation once you can map legacy `user_key` values to `auth.users(id)`.
