-- Add missing fields to nutrition_meals table
-- These fields are needed for AI-generated nutrition plans

alter table public.nutrition_meals 
add column if not exists emoji text default '🍽️',
add column if not exists meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'intra')),
add column if not exists notes text;

-- Create index for meal_type queries
create index if not exists nutrition_meals_meal_type_idx on public.nutrition_meals (meal_type);

-- Add locked column if it doesn't exist (for plan locking feature)
alter table public.nutrition_meals
add column if not exists locked boolean not null default false;

-- Create index for locked queries
create index if not exists nutrition_meals_locked_idx on public.nutrition_meals (locked);
