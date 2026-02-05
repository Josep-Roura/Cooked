# Recipe Import Scripts

Two complete import pipelines for loading recipe data into the Cooked database:

## 1. **Cooked Flow Recipes** (CSV - 503 unique recipes)

TypeScript-based importer for small, curated recipe datasets.

### Quick Start
```bash
cd frontend
npx tsx scripts/uploadRecipesClean.ts ../data/cookedflow_recetas_mejoradas_1200.csv
```

### Files
- **`frontend/scripts/uploadRecipesClean.ts`** - Main import (368 lines)
  - CSV parsing with quoted field support
  - Duplicate detection
  - Batch ingredient/step insertion
  - Real-time progress tracking

- **`frontend/scripts/cleanRecipeData.ts`** - Database cleanup utility
  - Safely deletes all recipe data for current user
  - Maintains referential integrity

- **`frontend/scripts/diagnoseRecipeUpload.ts`** - Data verification tool
  - Counts recipes, ingredients, steps
  - Checks for duplicates and integrity

### Features
- ✅ Handles commas in quoted fields
- ✅ Skips duplicate titles gracefully
- ✅ ~1-2 minutes for 503 recipes
- ✅ 4-5 ingredients per recipe (average)
- ✅ 4-5 steps per recipe (average)

### Result
**503 unique recipes** imported (from 1200 CSV rows with 697 duplicates)

---

## 2. **RecipeNLG Full Dataset** (Python - 2M recipes)

Python-based importer for the large RecipeNLG dataset.

### Quick Start
```bash
# 1. Install dependencies
pip install -r requirements_recipenlg.txt

# 2. Get the data
# Download from: https://github.com/Glorf/recipenlg
# Extract: mv full_dataset.csv data/full_dataset.csv

# 3. Run import
python scripts/import_recipenlg.py
```

### Files
- **`scripts/import_recipenlg.py`** - Main import (600+ lines)
  - RecipeNLG CSV parsing (title, ingredients JSON, directions JSON, NER)
  - Deduplication via SHA1 fingerprinting
  - Supabase batch operations
  - Configurable batch size and max rows
  - Performance monitoring

- **`scripts/test_recipenlg_import.py`** - Pre-flight checks
  - Validates environment variables
  - Tests CSV file access and parsing
  - Verifies Supabase connectivity
  - Safe to run before import

- **`scripts/diagnose_recipenlg_import.py`** - Import verification
  - Counts imported data
  - Shows statistics (avg ingredients/steps per recipe)
  - Samples imported recipes
  - Verifies data integrity

### Configuration
Environment variables (set in `.env` or command line):
```bash
SUPABASE_URL=https://...              # Required
SUPABASE_SERVICE_ROLE_KEY=sb_secret_... # Required
RECIPES_OWNER_USER_ID=<uuid>          # Required
CSV_PATH=data/full_dataset.csv        # Optional (default shown)
BATCH_SIZE=2000                       # Optional (tune for memory)
MAX_ROWS=0                            # Optional (0 = all, 1000 = test)
IMPORT_BATCH=recipenlg_full_dataset   # Optional (for tracking)
```

### Examples
```bash
# Full import
python scripts/import_recipenlg.py

# Test with 1000 recipes
MAX_ROWS=1000 python scripts/import_recipenlg.py

# Larger batches (faster but more memory)
BATCH_SIZE=5000 python scripts/import_recipenlg.py

# Custom dataset path
CSV_PATH=/tmp/full_dataset.csv python scripts/import_recipenlg.py
```

### Features
- ✅ Handles 2M recipes from RecipeNLG
- ✅ JSON parsing (ingredients, directions arrays)
- ✅ Named Entity Recognition (NER) extraction
- ✅ SHA1 fingerprint deduplication
- ✅ Batch processing (configurable, default 2000)
- ✅ Progress reporting every batch
- ✅ ~2-4 hours for full dataset
- ✅ Graceful keyboard interrupt
- ✅ Post-import diagnostic tool

### Performance
- **Full dataset (2M)**: ~2-4 hours (depends on network/batch size)
- **100K recipes**: ~10-20 minutes
- **10K recipes**: ~1-2 minutes
- **Typical rate**: 100-200 recipes/sec with BATCH_SIZE=2000

---

## Comparison

| Feature | Cooked Flow | RecipeNLG |
|---------|-------------|-----------|
| Language | TypeScript | Python |
| Size | 503 recipes | 2M recipes |
| Format | Simple CSV | JSON fields |
| Time | ~1 minute | ~2-4 hours |
| Deduplication | By title | By fingerprint |
| Batch size | Fixed (sequential) | Configurable |
| Status tracking | Progress per 50 | Progress per batch |

---

## Database Schema

Both importers use the same tables:

### `recipes`
- title, canonical_title
- description, category, emoji
- servings, cook_time_min
- tags, diet_tags, meal_tags
- macros_*, is_public, language
- source, source_id, source_url
- fingerprint (for deduplication)

### `recipe_ingredients`
- recipe_id, user_id
- name, quantity, unit, category, optional
- normalized_name, quantity_text, unit_standard
- raw_line, parsed_quantity, parsed_unit
- (fields like usda_fdc_id left for later stages)

### `recipe_steps`
- recipe_id, user_id
- step_number, instruction
- timer_seconds (optional)

---

## Next Steps

After importing recipes, you might want to:

1. **Compute nutritional macros**
   - Use USDA FoodData Central API
   - Parse ingredient quantities
   - Calculate calories, protein, carbs, fat

2. **Parse ingredient quantities**
   - Convert "2 cups flour" → quantity=2, unit="cup"
   - Standardize units (cups → ml, etc.)
   - Extract item names

3. **Extract recipe metadata**
   - Detect meal types (breakfast, lunch, dinner)
   - Identify cuisines
   - Categorize by diet (vegan, gluten-free, etc.)

4. **Generate embeddings**
   - Use titles + descriptions for semantic search
   - Enable recipe recommendations

5. **Build recipe transformations**
   - Scale recipes up/down
   - Substitute ingredients
   - Adapt for dietary restrictions

---

## Troubleshooting

### TypeScript Import (Cooked Flow)

```bash
# Missing .env
cat .env  # Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Build error
cd frontend && npm install

# No data imported
npm exec tsx scripts/diagnoseRecipeUpload.ts
```

### Python Import (RecipeNLG)

```bash
# Test before full import
python scripts/test_recipenlg_import.py

# No SUPABASE_URL error
echo $SUPABASE_URL  # Check it's set

# CSV not found
ls -lh data/full_dataset.csv

# Slow import
BATCH_SIZE=5000 python scripts/import_recipenlg.py

# Check results
python scripts/diagnose_recipenlg_import.py
```

---

## Documentation

- **TypeScript**: See `RECIPE_IMPORT_GUIDE.md`
- **Python**: See `RECIPENLG_IMPORT_GUIDE.md`
