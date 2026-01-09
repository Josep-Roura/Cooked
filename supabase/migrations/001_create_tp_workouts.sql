create table if not exists public.tp_workouts (
    id bigserial primary key,
    athlete_id text not null default 'default',
    workout_day date not null,
    workout_type text,
    title text,
    description text,
    coach_comments text,
    athlete_comments text,
    planned_hours float8,
    planned_km float8,
    actual_hours float8,
    actual_km float8,
    if float8,
    tss float8,
    power_avg float8,
    hr_avg float8,
    rpe float8,
    feeling float8,
    has_actual boolean default false,
    week text,
    dow text,
    source text default 'trainingpeaks_export',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create unique index if not exists tp_workouts_unique_idx
    on public.tp_workouts (
        athlete_id,
        workout_day,
        coalesce(title, ''),
        coalesce(workout_type, '')
    );

create or replace function public.set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_tp_workouts_updated_at on public.tp_workouts;
create trigger set_tp_workouts_updated_at
before update on public.tp_workouts
for each row
execute function public.set_updated_at();
