-- 20260205200000_add_performance_indexes.sql
-- Add composite indexes for nutrition operations
-- These significantly improve week/range queries for meal retrieval

-- Performance index for nutrition_meals queries by (user_id, date, locked)
-- Used by: GET /api/v1/nutrition/week, regeneration flows
CREATE INDEX IF NOT EXISTS idx_nutrition_meals_user_date_locked 
  ON public.nutrition_meals(user_id, date, locked);

-- Performance index for nutrition_plan_rows queries by (user_id, date, locked)
-- Used by: GET /api/v1/nutrition/week, AI generation
CREATE INDEX IF NOT EXISTS idx_nutrition_plan_rows_user_date_locked 
  ON public.nutrition_plan_rows(user_id, date, locked);

-- Performance index for tp_workouts by (user_id, workout_day)
-- Used by: AI generation to fetch workouts for date range
CREATE INDEX IF NOT EXISTS idx_tp_workouts_user_workout_day 
  ON public.tp_workouts(user_id, workout_day);

-- Performance index for ai_requests by (user_id, status, created_at)
-- Used by: Rate limiting checks, AI history
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_status_created 
  ON public.ai_requests(user_id, status, created_at DESC);

-- Performance index for plan_revisions by (user_id, week_start)
-- Used by: Revision history queries
CREATE INDEX IF NOT EXISTS idx_plan_revisions_user_week 
  ON public.plan_revisions(user_id, week_start DESC);

-- Unique constraint for nutrition_plan_rows (one row per user+date)
CREATE UNIQUE INDEX IF NOT EXISTS unique_nutrition_plan_rows_user_date 
  ON public.nutrition_plan_rows(user_id, date);

-- Unique constraint for nutrition_meals (one meal per user+date+slot)
CREATE UNIQUE INDEX IF NOT EXISTS unique_nutrition_meals_user_date_slot 
  ON public.nutrition_meals(user_id, date, slot);
