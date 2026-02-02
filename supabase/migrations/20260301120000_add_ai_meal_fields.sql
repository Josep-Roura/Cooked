alter table public.nutrition_meals
  add column if not exists meal_type text,
  add column if not exists emoji text,
  add column if not exists notes text;

alter table public.nutrition_plan_rows
  add column if not exists rationale text;
