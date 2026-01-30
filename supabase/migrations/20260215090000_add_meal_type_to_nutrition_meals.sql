alter table public.nutrition_meals
  add column if not exists meal_type text;
