-- 006_tp_workouts_user_id.sql

ALTER TABLE public.tp_workouts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS start_time text;

DROP INDEX IF EXISTS tp_workouts_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS tp_workouts_unique_idx
  ON public.tp_workouts (
    user_id,
    workout_day,
    title,
    workout_type
  );

ALTER TABLE public.tp_workouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tp_workouts' AND policyname='tp_workouts_select_own'
  ) THEN
    CREATE POLICY tp_workouts_select_own ON public.tp_workouts FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tp_workouts' AND policyname='tp_workouts_insert_own'
  ) THEN
    CREATE POLICY tp_workouts_insert_own ON public.tp_workouts FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tp_workouts' AND policyname='tp_workouts_update_own'
  ) THEN
    CREATE POLICY tp_workouts_update_own ON public.tp_workouts FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tp_workouts' AND policyname='tp_workouts_delete_own'
  ) THEN
    CREATE POLICY tp_workouts_delete_own ON public.tp_workouts FOR DELETE USING (user_id = auth.uid());
  END IF;
END
$$;
