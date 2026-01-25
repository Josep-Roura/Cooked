create table if not exists public.plan_chat_threads (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    week_start date not null,
    title text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique (user_id, week_start)
);

create table if not exists public.plan_chat_messages (
    id uuid primary key default gen_random_uuid(),
    thread_id uuid not null references public.plan_chat_threads(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('user','assistant','system')),
    content text not null,
    meta jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create index if not exists plan_chat_threads_user_week_idx on public.plan_chat_threads (user_id, week_start);
create index if not exists plan_chat_messages_thread_created_idx on public.plan_chat_messages (thread_id, created_at);

alter table public.plan_chat_threads enable row level security;
alter table public.plan_chat_messages enable row level security;

create policy "plan_chat_threads_select_own" on public.plan_chat_threads for select
using (user_id = auth.uid());
create policy "plan_chat_threads_insert_own" on public.plan_chat_threads for insert
with check (user_id = auth.uid());
create policy "plan_chat_threads_update_own" on public.plan_chat_threads for update
using (user_id = auth.uid());
create policy "plan_chat_threads_delete_own" on public.plan_chat_threads for delete
using (user_id = auth.uid());

create policy "plan_chat_messages_select_own" on public.plan_chat_messages for select
using (
    user_id = auth.uid()
    or thread_id in (
        select id from public.plan_chat_threads where user_id = auth.uid()
    )
);
create policy "plan_chat_messages_insert_own" on public.plan_chat_messages for insert
with check (
    user_id = auth.uid()
    and thread_id in (
        select id from public.plan_chat_threads where user_id = auth.uid()
    )
);
create policy "plan_chat_messages_update_own" on public.plan_chat_messages for update
using (
    thread_id in (
        select id from public.plan_chat_threads where user_id = auth.uid()
    )
);
create policy "plan_chat_messages_delete_own" on public.plan_chat_messages for delete
using (
    thread_id in (
        select id from public.plan_chat_threads where user_id = auth.uid()
    )
);

create trigger set_plan_chat_threads_updated_at
before update on public.plan_chat_threads
for each row
execute function public.set_updated_at();
