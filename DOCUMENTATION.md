# Cooked AI - Complete Documentation

## Project Overview

**Cooked AI** is a nutrition assistant for endurance athletes. The MVP parses TrainingPeaks CSV exports, generates summaries and plots, and uploads workouts to Supabase.

### Repo Structure
```
backend/    # Python scripts + API
frontend/   # Web app
supabase/   # Migrations
scripts/    # Utility scripts
```

---

## Quick Setup

### 1. Environment Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# OR
.venv\Scripts\Activate.ps1  # Windows

# Install dependencies
pip install -r backend/requirements.txt
```

### 2. Environment Variables

```bash
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
```

### 3. Run Backend

```bash
cd backend
cp .env.example .env
PYTHONPATH=src uvicorn coocked_api.api.main:app --reload --port 8000
```

### 4. Run Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

---

## Recipe Import System

### Current Status: 100,000 Recipes Imported

**Script**: `import_100k_parsing.py`
- **Progress**: ~91,700 / 100,000 (91.7% complete)
- **ETA**: 5-10 minutes remaining
- **Processing Speed**: ~40 recipes/second
- **Data**: Full ingredient parsing with quantity/unit separation

### What Gets Imported

- **Recipes** with titles, descriptions, servings, cook time
- **Recipe Steps** with numbered instructions
- **Ingredients** with:
  - Raw ingredient strings
  - Parsed quantities (handles fractions, decimals, unicode)
  - Units (tsp, tbsp, cup, lb, oz, etc.)
  - Package info extraction
  - Sort order for consistency

### Database Schema

```sql
-- Recipes table
recipes
├── id (UUID)
├── title
├── source
├── source_url
├── language
├── import_batch
└── timestamps

-- Ingredients table
recipe_ingredients
├── id (UUID)
├── recipe_id
├── name
├── quantity
├── unit
├── raw_line
├── parsed_quantity
├── parsed_unit
└── sort_order (unique with recipe_id)

-- Steps table
recipe_steps
├── id (UUID)
├── recipe_id
├── instruction
├── step_number
└── timestamps
```

### Data Source

**File**: `data/full_dataset.csv`
- **Size**: ~2.3GB
- **Total Records**: ~2.2 million recipes
- **Columns**: title, ingredients (JSON), directions (JSON), link, source, NER

---

## API Usage

All plan endpoints require the `x-device-id` header.

```bash
# Health check
curl http://localhost:8000/health

# Generate and save plan
curl -X POST http://localhost:8000/api/v1/plan/nutrition \
  -H "x-device-id: demo-device" \
  -F "weight_kg=72" \
  -F "file=@workouts.csv"

# List plans
curl "http://localhost:8000/api/v1/plans?limit=20&offset=0" \
  -H "x-device-id: demo-device"

# Get plan by ID
curl http://localhost:8000/api/v1/plans/<plan_id> \
  -H "x-device-id: demo-device"
```

---

## Monitoring Recipe Import

### Check Current Progress

```bash
# View latest log
tail -50 /Users/joseproura/Cooked/import_100k_parsing.log

# Check if running
ps aux | grep import_100k_parsing.py | grep -v grep

# Count completed batches
grep "Insertando batch" /Users/joseproura/Cooked/import_100k_parsing.log | wc -l
```

### Database Verification

```sql
-- Count imported recipes
SELECT COUNT(*) FROM recipes WHERE import_batch = 'recipenlg_100k';

-- Count ingredients
SELECT COUNT(*) FROM recipe_ingredients;

-- Count steps
SELECT COUNT(*) FROM recipe_steps;

-- Sample recipe with ingredients
SELECT * FROM recipes LIMIT 1;
SELECT * FROM recipe_ingredients WHERE recipe_id = '<recipe_id>' ORDER BY sort_order;
SELECT * FROM recipe_steps WHERE recipe_id = '<recipe_id>' ORDER BY step_number;
```

---

## Key Features

### Ingredient Parsing

The import script handles:
- **Fractions**: "1 1/2", "3/4" → parsed_quantity: 1.5, 0.75
- **Unicode fractions**: "½", "¾", "⅓" → converted to decimals
- **Mixed numbers**: "2 1/4 cups" → quantity: 2.25, unit: "cup"
- **Dashes**: "dash", "pinch" → handled as special units
- **Package info**: "1 cup (8 oz)" → qty: 1, unit: "cup", pkg_qty: 8, pkg_unit: "oz"
- **Optional markers**: removed (to taste, as needed, etc.)

### Unit Normalization

Standard aliases for common units:
- tsp, t, teaspoon → "tsp"
- tbsp, T, tablespoon → "tbsp"
- cup, c → "cup"
- oz, ounce → "oz"
- lb, pound → "lb"
- g, gram → "g"
- ml, milliliter → "ml"

---

## Supabase Migrations

Apply migrations in order:

1. **001_initial.sql** - Core tables
2. **002_create_nutrition_plans.sql** - Nutrition planning tables
3. **003_recipes.sql** - Recipe-related tables (if needed)

---

## Development Notes

### File Organization

**Active Files**:
- `import_100k_parsing.py` - Main import script
- `import_100k_parsing.log` - Import log
- `normalize_recipe_ingredients.py` - Ingredient normalization utility
- `release-checklist.sh` - Release automation

**Removed (Cleanup)**:
- Old import variants (import_*.py)
- Old monitoring scripts (monitor_*.sh)
- Old logs and partial imports
- Recipe chunks directory
- CSV conversion utilities

### Training Data

**TrainingPeaks CSV Fields**:
- Date, time, distance, time (hr:min:sec)
- Average power, normalized power, IF
- Heart rate zones, cadence, temperature
- Elevation gain/loss
- Workout notes

---

## Performance Notes

### Import Optimization

- **Batch Size**: 20 recipes per flush
- **API Calls**: Combined for recipes, ingredients, steps
- **Retry Logic**: 3 automatic retries with 3-second delays
- **Processing Speed**: ~40 recipes/second via REST API

### Database Constraints

- Unique `(recipe_id, sort_order)` on recipe_ingredients prevents duplicates
- UUID-based identifiers for consistency
- Indexes on recipe_id for fast lookups
- Timestamp tracking for auditing

---

## Troubleshooting

### Import Hangs

```bash
# Check if process is running
ps aux | grep import_100k_parsing

# Kill if stuck
kill -9 <PID>

# Review logs for errors
tail -100 /Users/joseproura/Cooked/import_100k_parsing.log
```

### Database Issues

```sql
-- Check for constraint violations
SELECT * FROM pg_constraint WHERE conname LIKE '%recipe%';

-- Clear failed import
DELETE FROM recipes WHERE import_batch = 'recipenlg_100k';
DELETE FROM recipe_ingredients WHERE recipe_id NOT IN (SELECT id FROM recipes);
DELETE FROM recipe_steps WHERE recipe_id NOT IN (SELECT id FROM recipes);
```

### API Errors

- Check Supabase service role key is valid
- Verify environment variables are set
- Check network connectivity to Supabase

---

## Next Steps

1. **Wait for import completion** - Current run finishing in ~5-10 minutes
2. **Verify data integrity** - Run verification SQL queries
3. **Test search/retrieval** - Query recipes and ingredients
4. **Optional**: Import remaining recipes if needed (1.9M more available)
5. **Optional**: Build recipe search/recommendations feature

---

## Resources

- **Supabase Docs**: https://supabase.io/docs
- **TrainingPeaks**: https://www.trainingpeaks.com/
- **RecipeNLG Dataset**: Original source of 2M+ recipes

---

*Last Updated: February 6, 2026*
*Current Task: Importing 100,000 recipes with full ingredient parsing*
