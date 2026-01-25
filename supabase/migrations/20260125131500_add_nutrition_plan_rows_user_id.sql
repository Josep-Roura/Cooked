alter table public.nutrition_plan_rows
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists nutrition_plan_rows_user_date_idx
  on public.nutrition_plan_rows (user_id, date);

update public.nutrition_plan_rows r
set user_id = p.user_id
from public.nutrition_plans p
where r.plan_id = p.id
  and r.user_id is null;
