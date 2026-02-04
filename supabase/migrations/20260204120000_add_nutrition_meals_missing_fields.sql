-- Add missing fields to nutrition_meals table for recipe display
alter table public.nutrition_meals
  add column if not exists emoji text,
  add column if not exists meal_type text check (meal_type in ('breakfast', 'snack', 'lunch', 'dinner', 'intra')),
  add column if not exists notes text;

-- Create index for meal_type queries
create index if not exists nutrition_meals_meal_type_idx on public.nutrition_meals (meal_type);
