-- Database Cleanup & Fix for Cooked App
-- THIS SCRIPT WILL:
-- 1. Disable RLS temporarily to allow modifications
-- 2. Fix constraints in existing tables
-- 3. Create missing tables/constraints properly
-- 4. DOES NOT delete any data - only orphaned tables

-- ============================================================
-- STEP 1: Fix the nutrition_products constraint if it exists
-- ============================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'nutrition_products') THEN
    ALTER TABLE public.nutrition_products DROP CONSTRAINT IF EXISTS nutrition_products_serving_unit_check;
    ALTER TABLE public.nutrition_products ADD CONSTRAINT nutrition_products_serving_unit_check 
      CHECK (serving_unit in ('g', 'ml', 'pieces', 'packet', 'capsule', 'tablet', 'mg'));
  END IF;
END $$;

-- ============================================================
-- STEP 2: Ensure nutrition_products table exists with correct schema
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nutrition_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Basic info
  name text NOT NULL,
  brand text,
  category text NOT NULL CHECK (category in ('drink', 'food', 'supplement', 'bar', 'gel', 'salt_capsule', 'other')),
  description text,
  
  -- Serving info
  serving_size numeric NOT NULL,
  serving_unit text NOT NULL CHECK (serving_unit in ('g', 'ml', 'pieces', 'packet', 'capsule', 'tablet', 'mg')),
  
  -- Nutritional data per serving
  calories numeric,
  carbs_g numeric,
  protein_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sodium_mg numeric,
  potassium_mg numeric,
  magnesium_mg numeric,
  caffeine_mg numeric,
  
  -- Product details
  price_usd numeric,
  availability text,
  is_vegan boolean DEFAULT false,
  is_gluten_free boolean DEFAULT false,
  is_dairy_free boolean DEFAULT false,
  allergens text,
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_default boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.user_nutrition_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.nutrition_products(id) ON DELETE SET NULL,
  
  custom_name text,
  custom_serving_size numeric,
  custom_serving_unit text,
  custom_carbs_g numeric,
  custom_protein_g numeric,
  custom_sodium_mg numeric,
  
  rating numeric CHECK (rating >= 0 AND rating <= 5),
  notes text,
  last_used_at timestamptz,
  usage_count int DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS nutrition_products_category_idx ON public.nutrition_products (category);
CREATE INDEX IF NOT EXISTS nutrition_products_brand_idx ON public.nutrition_products (brand);
CREATE INDEX IF NOT EXISTS nutrition_products_is_default_idx ON public.nutrition_products (is_default);
CREATE INDEX IF NOT EXISTS user_nutrition_products_user_id_idx ON public.user_nutrition_products (user_id);
CREATE INDEX IF NOT EXISTS user_nutrition_products_product_id_idx ON public.user_nutrition_products (product_id);

-- Enable RLS
ALTER TABLE public.nutrition_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_nutrition_products ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "nutrition_products_public_read" ON public.nutrition_products;
DROP POLICY IF EXISTS "nutrition_products_user_read_own" ON public.nutrition_products;
DROP POLICY IF EXISTS "nutrition_products_user_create" ON public.nutrition_products;
DROP POLICY IF EXISTS "nutrition_products_user_update" ON public.nutrition_products;
DROP POLICY IF EXISTS "nutrition_products_admin_delete" ON public.nutrition_products;
DROP POLICY IF EXISTS "user_nutrition_products_select_own" ON public.user_nutrition_products;
DROP POLICY IF EXISTS "user_nutrition_products_insert_own" ON public.user_nutrition_products;
DROP POLICY IF EXISTS "user_nutrition_products_update_own" ON public.user_nutrition_products;
DROP POLICY IF EXISTS "user_nutrition_products_delete_own" ON public.user_nutrition_products;

-- Create new RLS Policies
CREATE POLICY "nutrition_products_public_read" ON public.nutrition_products
  FOR SELECT USING (is_default = true);

CREATE POLICY "nutrition_products_user_read_own" ON public.nutrition_products
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "nutrition_products_user_create" ON public.nutrition_products
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "nutrition_products_user_update" ON public.nutrition_products
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "nutrition_products_admin_delete" ON public.nutrition_products
  FOR DELETE USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "user_nutrition_products_select_own" ON public.user_nutrition_products
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_nutrition_products_insert_own" ON public.user_nutrition_products
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_nutrition_products_update_own" ON public.user_nutrition_products
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_nutrition_products_delete_own" ON public.user_nutrition_products
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- STEP 3: Insert default products (only if they don't exist)
-- ============================================================
INSERT INTO public.nutrition_products (
  name, brand, category, serving_size, serving_unit,
  calories, carbs_g, protein_g, sodium_mg, is_default, description
) VALUES
  ('Sports Drink - Orange', 'Gatorade', 'drink', 250, 'ml', 60, 15, 0, 200, true, 'Isotonic sports drink with carbs and electrolytes'),
  ('Sports Drink - Tropical', 'Pocari Sweat', 'drink', 250, 'ml', 50, 12, 0, 180, true, 'Ion supply drink'),
  ('Energy Bar', 'Clif Bar', 'bar', 68, 'g', 240, 43, 9, 160, true, 'Whole grain energy bar'),
  ('Sports Gel', 'GU', 'gel', 32, 'g', 100, 25, 0, 40, true, 'Quick carbs energy gel'),
  ('Electrolyte Drink', 'Nuun', 'drink', 500, 'ml', 10, 2, 0, 500, true, 'Low calorie electrolyte drink'),
  ('Protein Drink', 'Chocolate Milk', 'drink', 240, 'ml', 200, 26, 8, 150, true, 'Chocolate milk with protein'),
  ('Banana', 'Fresh', 'food', 100, 'g', 89, 23, 1, 1, true, 'Natural carbs and potassium'),
  ('Oatmeal', 'Generic', 'food', 50, 'g', 190, 27, 5, 2, true, 'Slow-release carbs'),
  ('Salt Capsules', 'Hammer Nutrition', 'salt_capsule', 1, 'capsule', 0, 0, 0, 300, true, 'Electrolyte replacement (300mg sodium per capsule)'),
  ('Caffeine Tablet', 'GU', 'supplement', 1, 'tablet', 0, 0, 0, 0, true, 'Caffeine for endurance (100mg per tablet)')
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 4: Summary - Identify unused tables (for manual review)
-- ============================================================
-- List all tables and their row counts (for analysis)
-- SELECT 
--   schemaname,
--   tablename,
--   (SELECT COUNT(*) FROM information_schema.schemata) as row_estimate
-- FROM pg_tables 
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- Tables that are likely UNUSED (review and consider for deletion):
-- - ai_messages, ai_threads, ai_requests (AI chat history - unused?)
-- - plan_chat_messages, plan_chat_threads (chat - unused?)
-- - plan_revisions (plan tracking - unused?)
-- - meal_log (old meal tracking?)
-- - meal_schedule (old schedule?)
-- - meal_prep_sessions, meal_prep_items (legacy?)
-- - recipe_cook_log (logging - might be useful)
-- - user_events (events - unused?)
-- - pantry_items, grocery_items (pantry - might not be used)

-- Tables that ARE ESSENTIAL (keep):
-- - profiles (users)
-- - nutrition_plans, nutrition_plan_rows (core planning)
-- - nutrition_meals (daily meals)
-- - recipes, recipe_* (recipes)
-- - meal_plans, meal_plan_items, meal_plan_ingredients (meal planning)
-- - tp_workouts (workouts)
-- - workout_nutrition, workout_nutrition_items (NEW - nutrition during workouts)
-- - user_food_rules (dietary restrictions)
-- - nutrition_products, user_nutrition_products (NEW - product library)
-- - analytics_events (might be useful)

-- ============================================================
-- MANUAL CLEANUP (run these IF you confirm tables are unused)
-- ============================================================
-- Note: Uncomment and run ONLY if you confirm these tables are NOT used

-- DROP TABLE IF EXISTS public.plan_chat_messages CASCADE;
-- DROP TABLE IF EXISTS public.plan_chat_threads CASCADE;
-- DROP TABLE IF EXISTS public.plan_revisions CASCADE;
-- DROP TABLE IF EXISTS public.ai_messages CASCADE;
-- DROP TABLE IF EXISTS public.ai_threads CASCADE;
-- DROP TABLE IF EXISTS public.ai_requests CASCADE;
-- DROP TABLE IF EXISTS public.meal_log CASCADE;
-- DROP TABLE IF EXISTS public.meal_schedule CASCADE;
-- DROP TABLE IF EXISTS public.meal_prep_items CASCADE;
-- DROP TABLE IF EXISTS public.meal_prep_sessions CASCADE;
-- DROP TABLE IF EXISTS public.user_events CASCADE;

-- ============================================================
-- SUCCESS MESSAGE
-- ============================================================
-- If you see this message, the nutrition_products table is now properly configured
-- and the default products have been inserted.
