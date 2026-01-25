DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plan_chat_threads'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plan_chat_threads'
        AND column_name = 'week_start'
    ) THEN
      ALTER TABLE public.plan_chat_threads RENAME COLUMN week_start TO week_start_date;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plan_chat_threads'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plan_chat_threads'
        AND column_name = 'week_start_date'
    ) THEN
      ALTER TABLE public.plan_chat_threads ADD COLUMN week_start_date date;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plan_chat_threads'
  ) THEN
    UPDATE public.plan_chat_threads
    SET week_start_date = COALESCE(week_start_date, current_date)
    WHERE week_start_date IS NULL;

    ALTER TABLE public.plan_chat_threads ALTER COLUMN week_start_date SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_chat_threads_user_week_idx'
  ) THEN
    -- no-op for index
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plan_chat_threads'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'plan_chat_threads_user_week_key'
    ) THEN
      ALTER TABLE public.plan_chat_threads DROP CONSTRAINT plan_chat_threads_user_week_key;
    END IF;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'plan_chat_threads'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'plan_chat_threads_user_week_start_key'
    ) THEN
      ALTER TABLE public.plan_chat_threads ADD CONSTRAINT plan_chat_threads_user_week_start_key UNIQUE (user_id, week_start_date);
    END IF;

    CREATE INDEX IF NOT EXISTS plan_chat_threads_user_week_start_idx ON public.plan_chat_threads (user_id, week_start_date);
  END IF;
END $$;
