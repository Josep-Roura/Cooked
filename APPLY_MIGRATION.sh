#!/bin/bash

# Cooked App - Database Migration Helper Script
# This script displays the migration SQL that needs to be run manually

set -e

PROJECT_ROOT="/Users/joseproura/Cooked"
MIGRATION_FILE="$PROJECT_ROOT/supabase/migrations/20260204150000_recreate_user_events_table.sql"

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                     🚀 COOKED APP - MIGRATION HELPER"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found: $MIGRATION_FILE"
echo ""
echo "───────────────────────────────────────────────────────────────────────────────"
echo "📝 MIGRATION SQL (Ready to copy/paste into Supabase)"
echo "───────────────────────────────────────────────────────────────────────────────"
echo ""

cat "$MIGRATION_FILE"

echo ""
echo "───────────────────────────────────────────────────────────────────────────────"
echo "📋 HOW TO APPLY THIS MIGRATION"
echo "───────────────────────────────────────────────────────────────────────────────"
echo ""
echo "1. Open Supabase Dashboard:"
echo "   👉 https://app.supabase.com/project/bupuvtgagyimqimloakt"
echo ""
echo "2. Click 'SQL Editor' in the left sidebar"
echo ""
echo "3. Click '+ New Query'"
echo ""
echo "4. Copy the SQL above and paste it into the editor"
echo ""
echo "5. Click 'RUN' button"
echo ""
echo "6. You should see 'Success' message"
echo ""
echo "───────────────────────────────────────────────────────────────────────────────"
echo "✅ AFTER RUNNING THE MIGRATION"
echo "───────────────────────────────────────────────────────────────────────────────"
echo ""
echo "1. Restart your dev server (or it will auto-reload)"
echo ""
echo "2. Open the dashboard: http://localhost:3000/dashboard"
echo ""
echo "3. Check browser console (F12) for [fetchUserEvents] logs"
echo ""
echo "4. Test the features:"
echo "   - Events should load without errors"
echo "   - Meal deletion should work"
echo "   - Workout deletion should work"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
