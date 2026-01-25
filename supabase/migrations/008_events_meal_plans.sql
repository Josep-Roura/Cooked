create table if not exists public.user_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    date date not null,
    time text,
    category text,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.meal_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,
    plan_row_id uuid references public.nutrition_plan_rows(id) on delete set null,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, date)
);

create table if not exists public.meal_plan_items (
    id uuid primary key default gen_random_uuid(),
    meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
    slot int not null,
    name text not null,
    time text,
    emoji text,
    kcal int not null,
    protein_g int not null,
    carbs_g int not null,
    fat_g int not null,
    eaten boolean not null default false,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (meal_plan_id, slot)
);

create table if not exists public.meal_plan_ingredients (
    id uuid primary key default gen_random_uuid(),
    meal_item_id uuid not null references public.meal_plan_items(id) on delete cascade,
    name text not null,
    quantity text,
    checked boolean not null default false,
    created_at timestamptz default now(),
    unique (meal_item_id, name)
);

create index if not exists user_events_user_date_idx on public.user_events (user_id, date);
create index if not exists meal_plans_user_date_idx on public.meal_plans (user_id, date);
create index if not exists meal_plan_items_plan_idx on public.meal_plan_items (meal_plan_id);
create index if not exists meal_plan_ingredients_item_idx on public.meal_plan_ingredients (meal_item_id);

drop trigger if exists set_user_events_updated_at on public.user_events;
create trigger set_user_events_updated_at
before update on public.user_events
for each row
execute function public.set_updated_at();

drop trigger if exists set_meal_plans_updated_at on public.meal_plans;
create trigger set_meal_plans_updated_at
before update on public.meal_plans
for each row
execute function public.set_updated_at();

drop trigger if exists set_meal_plan_items_updated_at on public.meal_plan_items;
create trigger set_meal_plan_items_updated_at
before update on public.meal_plan_items
for each row
execute function public.set_updated_at();

alter table public.user_events enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.meal_plan_ingredients enable row level security;

create policy "user_events_select_own" on public.user_events for select
using (user_id = auth.uid());
create policy "user_events_insert_own" on public.user_events for insert
with check (user_id = auth.uid());
create policy "user_events_update_own" on public.user_events for update
using (user_id = auth.uid());
create policy "user_events_delete_own" on public.user_events for delete
using (user_id = auth.uid());

create policy "meal_plans_select_own" on public.meal_plans for select
using (user_id = auth.uid());
create policy "meal_plans_insert_own" on public.meal_plans for insert
with check (user_id = auth.uid());
create policy "meal_plans_update_own" on public.meal_plans for update
using (user_id = auth.uid());
create policy "meal_plans_delete_own" on public.meal_plans for delete
using (user_id = auth.uid());

create policy "meal_plan_items_select_own" on public.meal_plan_items for select
using (
    meal_plan_id in (
        select id from public.meal_plans where user_id = auth.uid()
    )
);
create policy "meal_plan_items_insert_own" on public.meal_plan_items for insert
with check (
    meal_plan_id in (
        select id from public.meal_plans where user_id = auth.uid()
    )
);
create policy "meal_plan_items_update_own" on public.meal_plan_items for update
using (
    meal_plan_id in (
        select id from public.meal_plans where user_id = auth.uid()
    )
);
create policy "meal_plan_items_delete_own" on public.meal_plan_items for delete
using (
    meal_plan_id in (
        select id from public.meal_plans where user_id = auth.uid()
    )
);

create policy "meal_plan_ingredients_select_own" on public.meal_plan_ingredients for select
using (
    meal_item_id in (
        select i.id
        from public.meal_plan_items i
        join public.meal_plans p on p.id = i.meal_plan_id
        where p.user_id = auth.uid()
    )
);
create policy "meal_plan_ingredients_insert_own" on public.meal_plan_ingredients for insert
with check (
    meal_item_id in (
        select i.id
        from public.meal_plan_items i
        join public.meal_plans p on p.id = i.meal_plan_id
        where p.user_id = auth.uid()
    )
);
create policy "meal_plan_ingredients_update_own" on public.meal_plan_ingredients for update
using (
    meal_item_id in (
        select i.id
        from public.meal_plan_items i
        join public.meal_plans p on p.id = i.meal_plan_id
        where p.user_id = auth.uid()
    )
);
create policy "meal_plan_ingredients_delete_own" on public.meal_plan_ingredients for delete
using (
    meal_item_id in (
        select i.id
        from public.meal_plan_items i
        join public.meal_plans p on p.id = i.meal_plan_id
        where p.user_id = auth.uid()
    )
);
