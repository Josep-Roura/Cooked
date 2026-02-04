create table if not exists public.workout_nutrition (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id text,
  workout_date date not null,
  workout_start_time text,
  workout_duration_min int,
  workout_type text,
  
  -- Nutrition information
  pre_workout_recommendation text,
  during_workout_recommendation text,
  post_workout_recommendation text,
  
  -- Structured during-workout data
  during_carbs_g_per_hour numeric,
  during_carbs_total_g numeric,
  during_hydration_ml_per_hour numeric,
  during_hydration_total_ml numeric,
  during_electrolytes_mg numeric,
  during_food_type text,
  during_timing text,
  
  -- Raw AI response (full text)
  ai_response text,
  
  -- Metadata
  locked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_nutrition_items (
  id uuid primary key default gen_random_uuid(),
  workout_nutrition_id uuid not null references public.workout_nutrition(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  
  -- Item information
  item_type text not null check (item_type in ('carbs', 'hydration', 'electrolytes', 'food')),
  timing text, -- e.g., "start", "every 30 min", "at 15 min"
  quantity numeric,
  unit text, -- g, ml, mg, etc.
  description text,
  
  created_at timestamptz not null default now()
);

create index if not exists workout_nutrition_user_date_idx on public.workout_nutrition (user_id, workout_date);
create index if not exists workout_nutrition_workout_id_idx on public.workout_nutrition (user_id, workout_id);
create index if not exists workout_nutrition_items_workout_nutrition_idx on public.workout_nutrition_items (workout_nutrition_id);

alter table public.workout_nutrition enable row level security;
alter table public.workout_nutrition_items enable row level security;

create policy "workout_nutrition_select_own" on public.workout_nutrition
  for select using (user_id = auth.uid());
create policy "workout_nutrition_insert_own" on public.workout_nutrition
  for insert with check (user_id = auth.uid());
create policy "workout_nutrition_update_own" on public.workout_nutrition
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workout_nutrition_delete_own" on public.workout_nutrition
  for delete using (user_id = auth.uid());

create policy "workout_nutrition_items_select_own" on public.workout_nutrition_items
  for select using (user_id = auth.uid());
create policy "workout_nutrition_items_insert_own" on public.workout_nutrition_items
  for insert with check (user_id = auth.uid());
create policy "workout_nutrition_items_update_own" on public.workout_nutrition_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workout_nutrition_items_delete_own" on public.workout_nutrition_items
  for delete using (user_id = auth.uid());

create trigger set_workout_nutrition_updated_at
  before update on public.workout_nutrition
  for each row
  execute function public.set_updated_at();
