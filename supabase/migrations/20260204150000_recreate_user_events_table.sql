-- ============================================================
-- RECREATE user_events TABLE
-- ============================================================
-- This table was accidentally dropped in the cleanup migration
-- but it's still being used by the dashboard for displaying events

-- Create the user_events table
CREATE TABLE IF NOT EXISTS public.user_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    date date NOT NULL,
    time text,
    category text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS user_events_user_date_idx ON public.user_events (user_id, date);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS set_user_events_updated_at ON public.user_events;
CREATE TRIGGER set_user_events_updated_at
BEFORE UPDATE ON public.user_events
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "user_events_select_own" ON public.user_events;
CREATE POLICY "user_events_select_own" ON public.user_events FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_events_insert_own" ON public.user_events;
CREATE POLICY "user_events_insert_own" ON public.user_events FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_events_update_own" ON public.user_events;
CREATE POLICY "user_events_update_own" ON public.user_events FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_events_delete_own" ON public.user_events;
CREATE POLICY "user_events_delete_own" ON public.user_events FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================
-- VERIFICATION
-- ============================================================
-- The table is now available for the dashboard to use
