-- Add used_ai_enhancement flag to workout_nutrition for AI/deterministic tracking
alter table public.workout_nutrition
  add column if not exists used_ai_enhancement boolean not null default false;
