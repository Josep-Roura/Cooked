alter table public.nutrition_plan_rows
  add column if not exists locked boolean not null default false;

alter table public.nutrition_meals
  add column if not exists locked boolean not null default false;

alter table public.ai_requests
  add column if not exists error_code text,
  add column if not exists prompt_preview text,
  add column if not exists response_preview text;

create index if not exists nutrition_plan_rows_user_date_idx
  on public.nutrition_plan_rows (user_id, date);

create index if not exists nutrition_meals_user_date_idx
  on public.nutrition_meals (user_id, date);

create index if not exists tp_workouts_user_day_idx
  on public.tp_workouts (user_id, workout_day);
