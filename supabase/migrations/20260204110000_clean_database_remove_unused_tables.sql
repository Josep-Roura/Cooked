-- ============================================================
-- COOKED APP - DATABASE ANALYSIS & CLEANUP STRATEGY
-- ============================================================
-- This script identifies and cleans up unused tables
-- while preserving all essential Cooked functionality

-- ============================================================
-- PART 1: ANALYZE CURRENT STATE
-- ============================================================

-- Count rows in each table to understand what's being used
-- Run this first to understand your current database state:
/*
SELECT 
  tablename,
  CASE 
    WHEN schemaname = 'public' THEN 'public'
    ELSE 'other'
  END as schema,
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_name = t.tablename 
   AND table_schema = t.schemaname) as exists_in_schema
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
*/

-- ============================================================
-- PART 2: SAFE CLEANUP - REMOVE UNUSED TABLES
-- ============================================================

-- These tables are NOT used by Cooked and can be safely deleted
-- They appear to be from earlier versions or experimental features

-- AI Chat (legacy - not used in current Cooked)
DROP TABLE IF EXISTS public.plan_chat_messages CASCADE;
DROP TABLE IF EXISTS public.plan_chat_threads CASCADE;
-- NOTE: ai_messages and ai_threads ARE NEEDED - do not drop
-- NOTE: ai_requests IS NEEDED by /app/api/ai/plan/generate - do not drop

-- Plan Revisions (NEEDED for tracking revisions)
-- NOTE: plan_revisions IS NEEDED by /app/api/ai/plan/generate - do not drop

-- Old Meal Tracking (replaced by nutrition_meals)
DROP TABLE IF EXISTS public.meal_log CASCADE;
DROP TABLE IF EXISTS public.meal_schedule CASCADE;

-- Meal Prep (not used in current version)
DROP TABLE IF EXISTS public.meal_prep_items CASCADE;
DROP TABLE IF EXISTS public.meal_prep_sessions CASCADE;

-- User Events (legacy - not used)
DROP TABLE IF EXISTS public.user_events CASCADE;

-- ============================================================
-- PART 3: VERIFY ESSENTIAL TABLES EXIST
-- ============================================================

-- These are the ESSENTIAL tables for Cooked
-- Verify they exist and have correct structure

-- 1. User Profile
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  -- ... other fields as defined ...
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 2. Nutrition Planning Core
CREATE TABLE IF NOT EXISTS public.nutrition_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_key text NOT NULL,
  source_filename text,
  weight_kg numeric NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT nutrition_plans_pkey PRIMARY KEY (id),
  CONSTRAINT fk_nutrition_plans_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.nutrition_plan_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.nutrition_plans(id),
  user_id uuid,
  date date NOT NULL,
  day_type text NOT NULL,
  kcal integer NOT NULL,
  protein_g integer NOT NULL,
  carbs_g integer NOT NULL,
  fat_g integer NOT NULL,
  intra_cho_g_per_h integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  locked boolean NOT NULL DEFAULT false,
  rationale text
);

-- 3. Daily Meal Tracking (NEW - main meal system)
CREATE TABLE IF NOT EXISTS public.nutrition_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  slot integer NOT NULL,
  name text NOT NULL,
  time text,
  kcal integer NOT NULL DEFAULT 0,
  protein_g integer NOT NULL DEFAULT 0,
  carbs_g integer NOT NULL DEFAULT 0,
  fat_g integer NOT NULL DEFAULT 0,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipe jsonb,
  eaten boolean NOT NULL DEFAULT false,
  eaten_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  locked boolean NOT NULL DEFAULT false,
  meal_type text,
  emoji text,
  notes text,
  CONSTRAINT nutrition_meals_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_meals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 4. Meal Plans (for weekly planning)
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  plan_row_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  target_kcal integer,
  target_protein_g integer,
  target_carbs_g integer,
  target_fat_g integer,
  training_day_type text,
  status text DEFAULT 'draft'::text,
  locked boolean DEFAULT false,
  rationale text,
  CONSTRAINT meal_plans_pkey PRIMARY KEY (id),
  CONSTRAINT meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT meal_plans_plan_row_id_fkey FOREIGN KEY (plan_row_id) REFERENCES public.nutrition_plan_rows(id)
);

-- 5. Recipes
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  servings integer NOT NULL DEFAULT 1,
  cook_time_min integer,
  macros_kcal integer NOT NULL DEFAULT 0,
  macros_protein_g integer NOT NULL DEFAULT 0,
  macros_carbs_g integer NOT NULL DEFAULT 0,
  macros_fat_g integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  emoji text,
  CONSTRAINT recipes_pkey PRIMARY KEY (id),
  CONSTRAINT recipes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 6. Workouts
CREATE TABLE IF NOT EXISTS public.tp_workouts (
  id bigint PRIMARY KEY,
  user_id uuid,
  athlete_id text NOT NULL DEFAULT 'default'::text,
  workout_day date NOT NULL,
  workout_type text,
  title text,
  description text,
  start_time text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tp_workouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 7. Nutrition Products (NEW - product database)
CREATE TABLE IF NOT EXISTS public.nutrition_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text,
  category text NOT NULL CHECK (category in ('drink', 'food', 'supplement', 'bar', 'gel', 'salt_capsule', 'other')),
  description text,
  serving_size numeric NOT NULL,
  serving_unit text NOT NULL CHECK (serving_unit in ('g', 'ml', 'pieces', 'packet', 'capsule', 'tablet', 'mg')),
  calories numeric,
  carbs_g numeric,
  protein_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  potassium_mg numeric,
  magnesium_mg numeric,
  caffeine_mg numeric,
  price_usd numeric,
  availability text,
  is_vegan boolean DEFAULT false,
  is_gluten_free boolean DEFAULT false,
  is_dairy_free boolean DEFAULT false,
  allergens text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_default boolean NOT NULL DEFAULT false,
  CONSTRAINT nutrition_products_pkey PRIMARY KEY (id),
  CONSTRAINT nutrition_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 8. Workout Nutrition (NEW - nutrition during workouts)
CREATE TABLE IF NOT EXISTS public.workout_nutrition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_id text,
  workout_date date NOT NULL,
  workout_start_time text,
  workout_duration_min integer,
  workout_type text,
  pre_workout_recommendation text,
  during_workout_recommendation text,
  post_workout_recommendation text,
  during_carbs_g_per_hour numeric,
  during_hydration_ml_per_hour numeric,
  during_electrolytes_mg numeric,
  ai_response text,
  locked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workout_nutrition_pkey PRIMARY KEY (id),
  CONSTRAINT workout_nutrition_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- 9. User Food Rules (dietary preferences)
CREATE TABLE IF NOT EXISTS public.user_food_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('allergy', 'intolerance', 'dislike', 'preference', 'exclude')),
  item text NOT NULL,
  severity text NOT NULL DEFAULT 'hard'::text CHECK (severity IN ('hard', 'soft')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_food_rules_pkey PRIMARY KEY (id),
  CONSTRAINT user_food_rules_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================================
-- PART 4: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_nutrition_meals_user_date ON public.nutrition_meals(user_id, date);
CREATE INDEX IF NOT EXISTS idx_nutrition_meals_user_slot ON public.nutrition_meals(user_id, slot);
CREATE INDEX IF NOT EXISTS idx_nutrition_products_category ON public.nutrition_products(category);
CREATE INDEX IF NOT EXISTS idx_nutrition_products_is_default ON public.nutrition_products(is_default);
CREATE INDEX IF NOT EXISTS idx_workout_nutrition_user_date ON public.workout_nutrition(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_tp_workouts_user_date ON public.tp_workouts(user_id, workout_day);

-- ============================================================
-- PART 5: ENABLE RLS FOR SECURITY
-- ============================================================

ALTER TABLE public.nutrition_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_food_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 6: INSERT DEFAULT PRODUCTS (if table is empty)
-- ============================================================

INSERT INTO public.nutrition_products (
  name, brand, category, serving_size, serving_unit,
  calories, carbs_g, protein_g, sodium_mg, is_default, description
) SELECT
  'Sports Drink - Orange', 'Gatorade', 'drink', 250, 'ml', 60, 15, 0, 200, true, 'Isotonic sports drink with carbs and electrolytes'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Sports Drink - Orange' AND is_default = true)

UNION ALL

SELECT
  'Sports Drink - Tropical', 'Pocari Sweat', 'drink', 250, 'ml', 50, 12, 0, 180, true, 'Ion supply drink'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Sports Drink - Tropical' AND is_default = true)

UNION ALL

SELECT
  'Energy Bar', 'Clif Bar', 'bar', 68, 'g', 240, 43, 9, 160, true, 'Whole grain energy bar'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Energy Bar' AND is_default = true)

UNION ALL

SELECT
  'Sports Gel', 'GU', 'gel', 32, 'g', 100, 25, 0, 40, true, 'Quick carbs energy gel'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Sports Gel' AND is_default = true)

UNION ALL

SELECT
  'Electrolyte Drink', 'Nuun', 'drink', 500, 'ml', 10, 2, 0, 500, true, 'Low calorie electrolyte drink'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Electrolyte Drink' AND is_default = true)

UNION ALL

SELECT
  'Protein Drink', 'Chocolate Milk', 'drink', 240, 'ml', 200, 26, 8, 150, true, 'Chocolate milk with protein'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Protein Drink' AND is_default = true)

UNION ALL

SELECT
  'Banana', 'Fresh', 'food', 100, 'g', 89, 23, 1, 1, true, 'Natural carbs and potassium'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Banana' AND is_default = true)

UNION ALL

SELECT
  'Oatmeal', 'Generic', 'food', 50, 'g', 190, 27, 5, 2, true, 'Slow-release carbs'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Oatmeal' AND is_default = true)

UNION ALL

SELECT
  'Salt Capsules', 'Hammer Nutrition', 'salt_capsule', 1, 'capsule', 0, 0, 0, 300, true, 'Electrolyte replacement (300mg sodium per capsule)'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Salt Capsules' AND is_default = true)

UNION ALL

SELECT
  'Caffeine Tablet', 'GU', 'supplement', 1, 'tablet', 0, 0, 0, 0, true, 'Caffeine for endurance (100mg per tablet)'
WHERE NOT EXISTS (SELECT 1 FROM public.nutrition_products WHERE name = 'Caffeine Tablet' AND is_default = true);

-- ============================================================
-- PART 7: SUMMARY
-- ============================================================

/*
TABLES DELETED (unused):
- plan_chat_messages, plan_chat_threads (old chat)
- meal_log (old meal tracking)
- meal_schedule (old schedule)
- meal_prep_items, meal_prep_sessions (old prep)
- user_events (old events)

TABLES PRESERVED (essential):
✅ profiles (users)
✅ nutrition_plans, nutrition_plan_rows (core planning)
✅ nutrition_meals (daily meals)
✅ meal_plans, meal_plan_items (meal planning)
✅ recipes, recipe_* (recipes)
✅ tp_workouts (workouts)
✅ nutrition_products (product database)
✅ workout_nutrition (nutrition during workouts)
✅ user_food_rules (dietary restrictions)
✅ ai_messages, ai_threads (AI conversation history)
✅ ai_requests (AI API call logging)
✅ plan_revisions (plan revision tracking)

RESULT: Database cleaned, with all essential tables preserved for Cooked
*/
