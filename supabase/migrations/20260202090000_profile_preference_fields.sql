alter table profiles
  add column if not exists allergies_restrictions text[] null,
  add column if not exists preferred_cuisine text null,
  add column if not exists cooking_time_preference text null,
  add column if not exists budget_preference text null,
  add column if not exists daily_schedule text null;
