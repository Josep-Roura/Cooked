alter table public.meal_plans
  add column if not exists target_kcal int,
  add column if not exists target_protein_g int,
  add column if not exists target_carbs_g int,
  add column if not exists target_fat_g int,
  add column if not exists training_day_type text,
  add column if not exists status text default 'draft',
  add column if not exists locked boolean default false,
  add column if not exists rationale text;

alter table public.meal_plan_items
  add column if not exists meal_type text,
  add column if not exists sort_order int default 1,
  add column if not exists recipe_id uuid references public.recipes(id) on delete set null;

create table if not exists public.ai_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    provider text not null,
    model text not null,
    prompt_hash text not null,
    response_json jsonb not null,
    tokens int,
    latency_ms int,
    created_at timestamptz default now()
);

create index if not exists ai_requests_user_created_idx on public.ai_requests (user_id, created_at);
create index if not exists meal_plans_user_date_idx on public.meal_plans (user_id, date);

alter table public.ai_requests enable row level security;

create policy "ai_requests_select_own" on public.ai_requests for select
using (user_id = auth.uid());
create policy "ai_requests_insert_own" on public.ai_requests for insert
with check (user_id = auth.uid());
create policy "ai_requests_update_own" on public.ai_requests for update
using (user_id = auth.uid());
create policy "ai_requests_delete_own" on public.ai_requests for delete
using (user_id = auth.uid());
