-- 20260205120000_add_nutrition_profile_fields.sql
-- Add nutrition-related fields to profiles table for sports nutrition calculator
-- These fields are used by the personalized nutrition system based on ACSM, ISSN, IOC guidelines

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS weight_kg decimal(5,2) DEFAULT 70.0,
  ADD COLUMN IF NOT EXISTS age smallint DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sex text DEFAULT 'male' CHECK (sex IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'intermediate' CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS sweat_rate text DEFAULT 'medium' CHECK (sweat_rate IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS gi_sensitivity text DEFAULT 'low' CHECK (gi_sensitivity IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS caffeine_use text DEFAULT 'some' CHECK (caffeine_use IN ('none', 'some', 'high')),
  ADD COLUMN IF NOT EXISTS primary_goal text DEFAULT 'maintenance' CHECK (primary_goal IN ('endurance', 'strength', 'weight_loss', 'maintenance', 'hypertrophy'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_nutrition_metrics ON public.profiles (weight_kg, experience_level, primary_goal);

-- Verification queries:
-- SELECT id, weight_kg, age, experience_level, sweat_rate, gi_sensitivity, primary_goal FROM public.profiles LIMIT 5;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='profiles' AND column_name LIKE '%_level' OR column_name = 'weight_kg';
