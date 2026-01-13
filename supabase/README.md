# Supabase migrations for Cooked

This folder contains SQL migrations for the Supabase/Postgres database used by the project.

Summary

- `002_5_patch_existing_tables.sql` — idempotent patch to add `user_id`, defaults, constraints and indexes to existing tables if missing. Safe: keeps `user_id` nullable to avoid breaking legacy rows.
- `003_auth_and_plans.sql` — creates `nutrition_plans` and `nutrition_plan_rows` with `auth.users` ownership and enables RLS policies (one policy per action).

How to apply

1. Open the Supabase SQL editor for your project (Dashboard → SQL → New query).
2. Run `002_5_patch_existing_tables.sql` first. This will add `user_id` column if missing and create safe defaults/indexes. Paste the file contents and run.
3. Run `003_auth_and_plans.sql` next. This creates the tables (for fresh installs) and the RLS policies. Paste and run.

Notes about existing/legacy data

- We intentionally leave `user_id` nullable in the patch migration to avoid breaking legacy rows that predate `auth.users` adoption.
- Backfill strategy (recommended):
  - Map legacy `user_key` or `device_id` to `auth.users.id` (external process).
  - Run an update to set `user_id` where mapping exists.
  - Once all rows have `user_id` set, re-run or let the migration's safety block set `user_id` NOT NULL automatically (the migration will only set NOT NULL if there are zero rows with `user_id IS NULL`).

Verification steps (SQL)

- Check columns:
  SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='nutrition_plans';
  SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='nutrition_plan_rows';
- Check RLS enabled:
  SELECT relrowsecurity FROM pg_class WHERE relname='nutrition_plans';
  SELECT relrowsecurity FROM pg_class WHERE relname='nutrition_plan_rows';
- Check policies:
  SELECT \* FROM pg_policies WHERE tablename IN ('nutrition_plans','nutrition_plan_rows');

Quick test (requires authenticated session)

- Use the Supabase client authenticated as a test user. Example (JS):
  const { data, error } = await supabase.from('nutrition_plans').insert([{ user_id: '<USER_ID>', weight_kg: 80, start_date: '2025-01-01', end_date: '2025-01-07' }]);

If you need help with the backfill mapping or a one-off script to set `user_id` based on your legacy `user_key`, ask and I can provide a safe backfill script.
