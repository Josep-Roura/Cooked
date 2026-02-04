-- 20260205190000_add_nutrition_plan_json_to_workout_nutrition.sql
-- ADD MISSING COLUMN TO workout_nutrition TABLE
-- The nutrition API tries to save nutrition_plan_json but the column doesn't exist

ALTER TABLE public.workout_nutrition 
ADD COLUMN IF NOT EXISTS nutrition_plan_json jsonb;
