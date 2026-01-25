create table if not exists public.nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  slot int not null,
  name text not null,
  time text,
  kcal int not null default 0,
  protein_g int not null default 0,
  carbs_g int not null default 0,
  fat_g int not null default 0,
  ingredients jsonb not null default '[]'::jsonb,
  recipe jsonb,
  eaten boolean not null default false,
  eaten_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, slot)
);

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nutrition_meals_user_date_idx on public.nutrition_meals (user_id, date);
create index if not exists ai_messages_thread_created_idx on public.ai_messages (thread_id, created_at);
create index if not exists plan_revisions_user_week_start_idx on public.plan_revisions (user_id, week_start);

alter table public.nutrition_meals enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.plan_revisions enable row level security;

create policy "nutrition_meals_select_own" on public.nutrition_meals
  for select using (user_id = auth.uid());
create policy "nutrition_meals_insert_own" on public.nutrition_meals
  for insert with check (user_id = auth.uid());
create policy "nutrition_meals_update_own" on public.nutrition_meals
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "nutrition_meals_delete_own" on public.nutrition_meals
  for delete using (user_id = auth.uid());

create policy "ai_threads_select_own" on public.ai_threads
  for select using (user_id = auth.uid());
create policy "ai_threads_insert_own" on public.ai_threads
  for insert with check (user_id = auth.uid());
create policy "ai_threads_update_own" on public.ai_threads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_threads_delete_own" on public.ai_threads
  for delete using (user_id = auth.uid());

create policy "ai_messages_select_own" on public.ai_messages
  for select using (
    user_id = auth.uid()
    or thread_id in (select id from public.ai_threads where user_id = auth.uid())
  );
create policy "ai_messages_insert_own" on public.ai_messages
  for insert with check (
    user_id = auth.uid()
    and thread_id in (select id from public.ai_threads where user_id = auth.uid())
  );
create policy "ai_messages_update_own" on public.ai_messages
  for update using (
    thread_id in (select id from public.ai_threads where user_id = auth.uid())
  );
create policy "ai_messages_delete_own" on public.ai_messages
  for delete using (
    thread_id in (select id from public.ai_threads where user_id = auth.uid())
  );

create policy "plan_revisions_select_own" on public.plan_revisions
  for select using (user_id = auth.uid());
create policy "plan_revisions_insert_own" on public.plan_revisions
  for insert with check (user_id = auth.uid());
create policy "plan_revisions_update_own" on public.plan_revisions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plan_revisions_delete_own" on public.plan_revisions
  for delete using (user_id = auth.uid());

create trigger set_nutrition_meals_updated_at
  before update on public.nutrition_meals
  for each row
  execute function public.set_updated_at();

create trigger set_ai_threads_updated_at
  before update on public.ai_threads
  for each row
  execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'nutrition_plan_rows_user_date_unique'
  ) then
    create unique index if not exists nutrition_plan_rows_user_date_unique_idx
      on public.nutrition_plan_rows (user_id, date);
    alter table public.nutrition_plan_rows
      add constraint nutrition_plan_rows_user_date_unique
      unique using index nutrition_plan_rows_user_date_unique_idx;
  end if;
end $$;
