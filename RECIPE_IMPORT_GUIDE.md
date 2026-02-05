# Recipe CSV Import Setup Guide

## Overview

This guide explains how to set up and run the recipe CSV import process for the Cooked application. The system consists of:

1. **Supabase Migration**: Creates `recipe_ingredients` and `recipe_steps` tables
2. **Upload Script**: Parses the CSV file and imports recipes to Supabase
3. **Test Script**: Validates CSV parsing without requiring Supabase connection

## Files Created

### Migration File
- **Location**: `supabase/migrations/20260205210000_create_recipe_ingredients_and_steps.sql`
- **Purpose**: Creates the `recipe_ingredients` and `recipe_steps` tables with proper indexes and RLS policies

### Upload Script
- **Location**: `frontend/scripts/uploadRecipes.ts`
- **Purpose**: Main script that parses the CSV and uploads recipes to Supabase
- **Language**: TypeScript (runs with `tsx`)

### Test Script
- **Location**: `frontend/scripts/testRecipeUpload.ts`
- **Purpose**: Tests CSV parsing without Supabase connection (good for validation)
- **Language**: TypeScript (runs with `tsx`)

## Step 1: Apply Supabase Migration

The migration creates two new tables needed by the recipe system:

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the sidebar
3. Click **New query**
4. Copy the entire contents of `supabase/migrations/20260205210000_create_recipe_ingredients_and_steps.sql`
5. Paste it into the SQL editor
6. Click **Run**
7. Wait for success confirmation

### Option B: Using Supabase CLI (if configured)

```bash
cd /Users/joseproura/Cooked
supabase db push
```

## Step 2: Set Environment Variables

You need to provide Supabase credentials for the upload script:

```bash
export SUPABASE_URL="https://your-project-id.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export RECIPES_OWNER_USER_ID="system"  # Optional, defaults to "system"
```

Get these from:
- **SUPABASE_URL**: Supabase Dashboard → Settings → API → URL
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase Dashboard → Settings → API → Service Role key (click "Reveal")

## Step 3: Test CSV Parsing (Optional but Recommended)

Before uploading 1200 recipes, test the parsing logic:

```bash
cd /Users/joseproura/Cooked/frontend
npx tsx scripts/testRecipeUpload.ts
```

Expected output:
```
📖 Testing CSV parsing from: ../data/cookedflow_recetas_mejoradas_1200.csv

✅ Headers: 38 columns
   Columns: recipe_title, description, category, tags, emoji, servings, cook_time_min ...

✅ Row 2: "Pineapple Yogurt Crunch"
   📝 Fast bowl with carbs and protein for training days...
   🏷️  Category: breakfast, Tags: high_carb, quick, training_day
   🍜 Ingredients: 5, Steps: 5
...
✅ CSV parsing is working correctly!
```

## Step 4: Run the Recipe Upload

Once migration is applied and environment variables are set:

```bash
cd /Users/joseproura/Cooked/frontend
npx tsx scripts/uploadRecipes.ts
```

Optional: specify custom CSV path:
```bash
npx tsx scripts/uploadRecipes.ts ../data/cookedflow_recetas_mejoradas_1200.csv
```

Expected output:
```
📖 Reading recipes from: ../data/cookedflow_recetas_mejoradas_1200.csv
✅ Headers parsed: 38 columns
  📝 50 recipes uploaded...
  📝 100 recipes uploaded...
  ...

✅ Upload complete!
  📊 Total rows: 1200
  ✅ Successful: 1200
  ⏭️  Skipped: 0
  💾 Location: recipes, recipe_ingredients, recipe_steps tables
```

## CSV Format

The CSV file (`data/cookedflow_recetas_mejoradas_1200.csv`) has this structure:

### Main Fields
- `recipe_title`: Recipe name (required)
- `description`: Short description
- `category`: breakfast, lunch, dinner, snack, etc.
- `tags`: Pipe-separated tags (e.g., "high_carb|quick|training_day")
- `emoji`: Recipe emoji icon
- `servings`: Number of servings (default 1)
- `cook_time_min`: Cooking time in minutes

### Ingredients (up to 5)
Numbered columns for each ingredient:
- `ingredient_1_name`, `ingredient_2_name`, etc.
- `ingredient_1_qty`, `ingredient_2_qty`, etc.
- `ingredient_1_unit`, `ingredient_2_unit`, etc. (g, ml, pieces, etc.)
- `ingredient_1_category`, `ingredient_2_category`, etc. (dairy, carb, fat, etc.)
- `ingredient_1_optional`, `ingredient_2_optional`, etc. (0 or 1)

### Steps (up to 5)
- `step_1`, `step_2`, `step_3`, `step_4`, `step_5`: Preparation instructions

### Additional
- `notes`: Extra notes about the recipe

## What Gets Imported

### recipes table
- Title, description, category, emoji
- Servings and cook time
- Macro placeholders (0 - to be calculated later)
- User ID and timestamps

### recipe_ingredients table
- Recipe reference
- Ingredient name, quantity, unit
- Category and optional flag
- Sort order

### recipe_steps table
- Recipe reference
- Step number and instruction text
- Timestamps

## Verification

To verify the import worked:

### Check in Supabase Dashboard

1. Go to **Table Editor**
2. Click on `recipes` table
3. Should see 1200 rows

2. Click on `recipe_ingredients` table
3. Should see ~6000 ingredients (average ~5 per recipe)

4. Click on `recipe_steps` table
5. Should see ~6000 steps

### Check via SQL

```sql
-- Count recipes
SELECT COUNT(*) FROM recipes WHERE user_id = 'system';
-- Expected: 1200

-- Check ingredients
SELECT COUNT(*) FROM recipe_ingredients WHERE user_id = 'system';
-- Expected: ~6000

-- Check steps
SELECT COUNT(*) FROM recipe_steps WHERE user_id = 'system';
-- Expected: ~6000

-- Sample recipe with ingredients and steps
SELECT r.*, 
  (SELECT COUNT(*) FROM recipe_ingredients WHERE recipe_id = r.id) as ingredient_count,
  (SELECT COUNT(*) FROM recipe_steps WHERE recipe_id = r.id) as step_count
FROM recipes r 
WHERE r.user_id = 'system'
LIMIT 5;
```

## Troubleshooting

### "CSV file not found"
Make sure you're running from the correct directory or provide full path:
```bash
npx tsx scripts/uploadRecipes.ts /Users/joseproura/Cooked/data/cookedflow_recetas_mejoradas_1200.csv
```

### "Missing environment variables"
Set them before running:
```bash
export SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
npx tsx scripts/uploadRecipes.ts
```

### "Error inserting ingredients/steps"
This usually means the recipe was created but child inserts failed. The script will still count it as successful. Check Supabase table for any data inconsistencies.

### Slow upload
The script uploads recipes sequentially. For 1200 recipes, expect 10-30 minutes depending on connection. Run in background if needed:
```bash
nohup npx tsx scripts/uploadRecipes.ts > recipe_upload.log 2>&1 &
```

## API Integration

Once recipes are imported, the existing API endpoints will work:

- **GET /api/v1/food/recipes** - List all recipes for user
- **POST /api/v1/food/recipes** - Create new recipe
- **GET /api/v1/food/recipes/[id]** - Get recipe with ingredients and steps
- **PUT /api/v1/food/recipes/[id]** - Update recipe
- **DELETE /api/v1/food/recipes/[id]** - Delete recipe (cascades to ingredients and steps)

## Notes

- The migration creates RLS (Row-Level Security) policies so users can only see their own recipes
- Ingredients and steps cascade delete when a recipe is deleted
- The upload script sets all recipes to user_id "system" - you can change this with the `RECIPES_OWNER_USER_ID` environment variable
- Macros are imported as 0 - they should be calculated or imported separately
- The script handles duplicate recipe titles by updating existing ones instead of creating duplicates
