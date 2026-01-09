create extension if not exists pgcrypto;

create table if not exists nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  source_filename text,
  weight_kg numeric not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists nutrition_plan_rows (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references nutrition_plans(id) on delete cascade,
  date date not null,
  day_type text not null,
  kcal int not null,
  protein_g int not null,
  carbs_g int not null,
  fat_g int not null,
  intra_cho_g_per_h int not null,
  created_at timestamptz not null default now()
);

create index if not exists nutrition_plans_user_key_created_at_idx
  on nutrition_plans (user_key, created_at desc);

create index if not exists nutrition_plan_rows_plan_id_date_idx
  on nutrition_plan_rows (plan_id, date);
