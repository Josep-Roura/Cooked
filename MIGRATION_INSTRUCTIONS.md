# 🚀 Critical Next Step: Apply Database Migration

## Problem
The `user_events` table is missing from the Supabase database. This is blocking the dashboard events feature.

## Status
- Migration file created: ✅ `/Users/joseproura/Cooked/supabase/migrations/20260204150000_recreate_user_events_table.sql`
- SQL ready to run: ✅ Contains 31 SQL statements
- Cannot apply programmatically: ❌ (Supabase doesn't provide SQL execution API)

## Solution: Manual Application via Supabase Dashboard

### Step 1: Open Supabase SQL Editor
1. Go to: https://app.supabase.com/
2. Select your project: `Cooked AI` (Project ID: `bupuvtgagyimqimloakt`)
3. Click on "SQL Editor" in the left sidebar
4. Click "+ New query"

### Step 2: Copy the Migration SQL
Copy the entire contents of this file:
```
/Users/joseproura/Cooked/supabase/migrations/20260204150000_recreate_user_events_table.sql
```

Or here's the SQL to paste (all 55 lines):

```sql
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
```

### Step 3: Run the SQL
1. Paste the SQL into the Supabase SQL Editor
2. Click the "RUN" button (top right)
3. Wait for confirmation: "Success" message should appear

### Step 4: Verify the Table Was Created
Run this verification query in the SQL Editor:

```sql
-- Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'user_events'
) as table_exists;

-- Check table structure
\d public.user_events;

-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'user_events';
```

## What This Migration Does

1. **Creates `user_events` table** with columns:
   - `id` - unique identifier
   - `user_id` - foreign key to auth.users
   - `title` - event title (required)
   - `date` - event date (required)
   - `time` - optional event time (HH:MM format)
   - `category` - optional event category
   - `notes` - optional event notes
   - `created_at` - auto-set timestamp
   - `updated_at` - auto-set timestamp

2. **Creates index** for performance on user_id + date lookups

3. **Creates trigger** to automatically update `updated_at` timestamp

4. **Enables Row Level Security (RLS)** to ensure users can only see/edit their own events

## Why This Was Needed

- The table was accidentally dropped in migration `20260204110000_clean_database_remove_unused_tables.sql`
- But the frontend code still queries this table (in `app/api/v1/events/route.ts`)
- Without it, the "Upcoming Events" widget shows errors
- Without it, events cannot be created or loaded

## After Running the Migration

1. The events API will start working
2. The dashboard "Upcoming Events" card will display properly
3. Users will be able to view/create events
4. Tests that depend on this table will pass

## Alternative: Using Supabase CLI

If you have Supabase CLI installed:

```bash
cd /Users/joseproura/Cooked
supabase migration up
```

This will automatically apply all pending migrations in order.

## Troubleshooting

### If you get an error about `set_updated_at()` function not existing
1. Run this query first to create the helper function:

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

2. Then run the user_events migration again

### If you get "table already exists" error
1. This means the table already exists (good!)
2. You can safely ignore or drop the existing table first

### If the table exists but still getting errors in the app
1. Check that RLS is enabled: `ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;`
2. Check that RLS policies are created (see verification query above)

## Timeline
- Migration file created: February 4, 2026
- Status: Awaiting manual application to Supabase
- Next steps: Tests and meal/workout deletion verification
