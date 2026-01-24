create table if not exists public.recipes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    description text,
    servings int not null default 1,
    cook_time_min int,
    tags text[] default '{}',
    category text,
    macros_kcal int not null default 0,
    macros_protein_g int not null default 0,
    macros_carbs_g int not null default 0,
    macros_fat_g int not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.recipe_ingredients (
    id uuid primary key default gen_random_uuid(),
    recipe_id uuid not null references public.recipes(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    quantity numeric,
    unit text,
    category text default 'other',
    optional boolean default false,
    created_at timestamptz default now()
);

create table if not exists public.recipe_steps (
    id uuid primary key default gen_random_uuid(),
    recipe_id uuid not null references public.recipes(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    step_number int not null,
    instruction text not null,
    timer_seconds int,
    created_at timestamptz default now()
);

create table if not exists public.meal_schedule (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,
    slot int not null,
    name text not null,
    recipe_id uuid references public.recipes(id) on delete set null,
    kcal int not null default 0,
    protein_g int not null default 0,
    carbs_g int not null default 0,
    fat_g int not null default 0,
    ingredients jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, date, slot)
);

create table if not exists public.meal_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,
    slot int not null,
    is_eaten boolean not null default false,
    eaten_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, date, slot)
);

create table if not exists public.grocery_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    quantity numeric,
    unit text,
    category text default 'other',
    is_bought boolean not null default false,
    source text default 'manual',
    recipe_id uuid references public.recipes(id) on delete set null,
    date_range_start date,
    date_range_end date,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.meal_prep_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    session_date date,
    duration_min int,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.meal_prep_items (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.meal_prep_sessions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    label text not null,
    linked_recipe_id uuid references public.recipes(id) on delete set null,
    linked_dates date[],
    is_done boolean default false,
    created_at timestamptz default now()
);

create index if not exists recipes_user_id_idx on public.recipes (user_id);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);
create index if not exists recipe_steps_recipe_idx on public.recipe_steps (recipe_id);
create index if not exists meal_schedule_user_date_idx on public.meal_schedule (user_id, date);
create index if not exists meal_log_user_date_idx on public.meal_log (user_id, date);
create index if not exists grocery_items_user_range_idx on public.grocery_items (user_id, date_range_start, date_range_end);
create index if not exists meal_prep_sessions_user_date_idx on public.meal_prep_sessions (user_id, session_date);

drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

drop trigger if exists set_meal_schedule_updated_at on public.meal_schedule;
create trigger set_meal_schedule_updated_at
before update on public.meal_schedule
for each row
execute function public.set_updated_at();

drop trigger if exists set_meal_log_updated_at on public.meal_log;
create trigger set_meal_log_updated_at
before update on public.meal_log
for each row
execute function public.set_updated_at();

drop trigger if exists set_grocery_items_updated_at on public.grocery_items;
create trigger set_grocery_items_updated_at
before update on public.grocery_items
for each row
execute function public.set_updated_at();

drop trigger if exists set_meal_prep_sessions_updated_at on public.meal_prep_sessions;
create trigger set_meal_prep_sessions_updated_at
before update on public.meal_prep_sessions
for each row
execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.meal_schedule enable row level security;
alter table public.meal_log enable row level security;
alter table public.grocery_items enable row level security;
alter table public.meal_prep_sessions enable row level security;
alter table public.meal_prep_items enable row level security;

create policy "recipes_select_own" on public.recipes for select
using (user_id = auth.uid());
create policy "recipes_insert_own" on public.recipes for insert
with check (user_id = auth.uid());
create policy "recipes_update_own" on public.recipes for update
using (user_id = auth.uid());
create policy "recipes_delete_own" on public.recipes for delete
using (user_id = auth.uid());

create policy "recipe_ingredients_select_own" on public.recipe_ingredients for select
using (user_id = auth.uid());
create policy "recipe_ingredients_insert_own" on public.recipe_ingredients for insert
with check (user_id = auth.uid());
create policy "recipe_ingredients_update_own" on public.recipe_ingredients for update
using (user_id = auth.uid());
create policy "recipe_ingredients_delete_own" on public.recipe_ingredients for delete
using (user_id = auth.uid());

create policy "recipe_steps_select_own" on public.recipe_steps for select
using (user_id = auth.uid());
create policy "recipe_steps_insert_own" on public.recipe_steps for insert
with check (user_id = auth.uid());
create policy "recipe_steps_update_own" on public.recipe_steps for update
using (user_id = auth.uid());
create policy "recipe_steps_delete_own" on public.recipe_steps for delete
using (user_id = auth.uid());

create policy "meal_schedule_select_own" on public.meal_schedule for select
using (user_id = auth.uid());
create policy "meal_schedule_insert_own" on public.meal_schedule for insert
with check (user_id = auth.uid());
create policy "meal_schedule_update_own" on public.meal_schedule for update
using (user_id = auth.uid());
create policy "meal_schedule_delete_own" on public.meal_schedule for delete
using (user_id = auth.uid());

create policy "meal_log_select_own" on public.meal_log for select
using (user_id = auth.uid());
create policy "meal_log_insert_own" on public.meal_log for insert
with check (user_id = auth.uid());
create policy "meal_log_update_own" on public.meal_log for update
using (user_id = auth.uid());
create policy "meal_log_delete_own" on public.meal_log for delete
using (user_id = auth.uid());

create policy "grocery_items_select_own" on public.grocery_items for select
using (user_id = auth.uid());
create policy "grocery_items_insert_own" on public.grocery_items for insert
with check (user_id = auth.uid());
create policy "grocery_items_update_own" on public.grocery_items for update
using (user_id = auth.uid());
create policy "grocery_items_delete_own" on public.grocery_items for delete
using (user_id = auth.uid());

create policy "meal_prep_sessions_select_own" on public.meal_prep_sessions for select
using (user_id = auth.uid());
create policy "meal_prep_sessions_insert_own" on public.meal_prep_sessions for insert
with check (user_id = auth.uid());
create policy "meal_prep_sessions_update_own" on public.meal_prep_sessions for update
using (user_id = auth.uid());
create policy "meal_prep_sessions_delete_own" on public.meal_prep_sessions for delete
using (user_id = auth.uid());

create policy "meal_prep_items_select_own" on public.meal_prep_items for select
using (user_id = auth.uid());
create policy "meal_prep_items_insert_own" on public.meal_prep_items for insert
with check (user_id = auth.uid());
create policy "meal_prep_items_update_own" on public.meal_prep_items for update
using (user_id = auth.uid());
create policy "meal_prep_items_delete_own" on public.meal_prep_items for delete
using (user_id = auth.uid());
