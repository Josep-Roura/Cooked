# CookedFlow Nutrition Planning Audit Report

## A) Executive Summary (5 bullets)
- The repo has a single Supabase migration directory, but the migrations include multiple, overlapping definitions of the same nutrition tables, which is the source of schema drift risk (e.g., `nutrition_plans`, `nutrition_plan_rows`, `nutrition_meals`, `ai_requests`).【F:supabase/README.md†L1-L14】【F:supabase/migrations/002_create_nutrition_plans.sql†L1-L30】【F:supabase/migrations/003_auth_and_plans.sql†L10-L41】【F:supabase/migrations/20260204110000_clean_database_remove_unused_tables.sql†L74-L128】【F:supabase/migrations/20260205180000_complete_database_fix.sql†L1-L103】
- The AI nutrition plan generator is feature-complete (schema validation, chunking, logging, rate limiting, DB writes), but chunking + post-validation can remove meals instead of replacing them, which creates gaps and drives repetition issues across chunks.【F:frontend/app/api/ai/plan/generate/route.ts†L13-L74】【F:frontend/app/api/ai/plan/generate/route.ts†L1120-L1258】【F:frontend/app/api/ai/plan/generate/route.ts†L634-L771】【F:frontend/app/api/ai/plan/generate/route.ts†L1313-L1531】
- The Plans UI renders the weekly calendar and modal from `nutrition_meals` data, preferring JSONB recipe data; missing or partial recipe payloads explain “Breakfast/Snack” titles and empty ingredients/steps in the modal.【F:frontend/app/api/v1/plans/week/route.ts†L29-L64】【F:frontend/components/dashboard/plans/meal-row.tsx†L11-L33】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L114-L190】
- Deterministic nutrition logic exists for both daily targets and workout fueling (carbs/fluids/sodium/caffeine), but only the workout fueling path uses those deterministic rules end-to-end; the daily plan generator still derives macros locally and relies on AI for recipes/timing fidelity.【F:frontend/lib/nutrition/engine.ts†L1-L219】【F:frontend/lib/nutrition/workoutFuelingEngine.ts†L1-L222】【F:frontend/app/api/ai/plan/generate/route.ts†L182-L196】
- At least one clear schema mismatch exists in production code: workout deletion references a non-existent `nutrition_during_workouts` table and the workout nutrition AI write path uses a `used_ai_enhancement` column that is not defined in migrations (only `nutrition_plan_json` is added).【F:frontend/app/api/v1/workouts/delete/route.ts†L40-L74】【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L271-L295】【F:supabase/migrations/20260203150000_workout_nutrition.sql†L1-L77】【F:supabase/migrations/20260205190000_add_nutrition_plan_json_to_workout_nutrition.sql†L1-L6】

---

## B) DB Schema: Canonical Proposal + Divergences

### Migration inventory
- **Migration root:** `supabase/migrations` (the repo’s Supabase SQL migrations live here).【F:supabase/README.md†L1-L14】

### Canonical schema proposal (nutrition + AI + recipes)
> Based on the latest/most complete migrations and the columns referenced in API routes.

**`nutrition_plans`**
- `id uuid PK`, `user_id uuid FK auth.users`, `user_key text` (legacy), `source_filename text`, `weight_kg numeric`, `start_date date`, `end_date date`, `created_at timestamptz`, `goal text` (optional).【F:supabase/migrations/003_auth_and_plans.sql†L10-L23】【F:supabase/migrations/20260204110000_clean_database_remove_unused_tables.sql†L74-L86】

**`nutrition_plan_rows`**
- `id uuid PK`, `plan_id uuid FK nutrition_plans`, `user_id uuid FK auth.users`, `date date`, `day_type text`, `kcal int`, `protein_g int`, `carbs_g int`, `fat_g int`, `intra_cho_g_per_h int`, `created_at timestamptz`, `locked boolean`, `rationale text`.
- Uniqueness: `(user_id, date)` and/or `(plan_id, date)` depending on migration order.【F:supabase/migrations/003_auth_and_plans.sql†L27-L41】【F:supabase/migrations/20260125131500_add_nutrition_plan_rows_user_id.sql†L1-L11】【F:supabase/migrations/20260204110000_clean_database_remove_unused_tables.sql†L88-L102】【F:supabase/migrations/20260301120000_add_ai_meal_fields.sql†L6-L7】【F:supabase/migrations/20260205200000_add_performance_indexes.sql†L30-L33】

**`nutrition_meals`**
- `id uuid PK`, `user_id uuid FK auth.users`, `date date`, `slot int`, `name text`, `time text`, `kcal int`, `protein_g int`, `carbs_g int`, `fat_g int`, `ingredients jsonb`, `recipe jsonb`, `eaten boolean`, `eaten_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz`, `locked boolean`, `meal_type text`, `emoji text`, `notes text`.
- Uniqueness: `(user_id, date, slot)` and/or unique index on `(user_id, date, slot)` for upserts.【F:supabase/migrations/20260201120000_ai_nutrition_meals.sql†L1-L19】【F:supabase/migrations/20260204120000_add_nutrition_meals_missing_fields.sql†L4-L17】【F:supabase/migrations/20260204110000_clean_database_remove_unused_tables.sql†L104-L128】【F:supabase/migrations/20260205200000_add_performance_indexes.sql†L34-L36】

**`plan_revisions`**
- `id uuid PK`, `user_id uuid FK auth.users`, `week_start date`, `week_end date`, `diff jsonb`, `created_at timestamptz`.【F:supabase/migrations/20260201120000_ai_nutrition_meals.sql†L38-L45】【F:supabase/migrations/20260205180000_complete_database_fix.sql†L52-L60】

**`ai_requests`**
- `id uuid PK`, `user_id uuid FK auth.users`, `provider text`, `model text`, `prompt_hash text`, `prompt_preview text`, `response_json jsonb`, `response_preview text`, `status text`, `error_code text`, `error_message text`, `tokens int`, `latency_ms int`, `created_at timestamptz`, `updated_at timestamptz`.
- Indexes for `user_id`, `created_at`, `(user_id, created_at)`, `status`, `provider`, `model`.
- Note: there are multiple conflicting definitions in migrations; canonical is the superset used by API code.【F:supabase/migrations/20260125124755_ai_meal_plan_schema.sql†L16-L29】【F:supabase/migrations/20260205130000_create_ai_requests_table.sql†L8-L56】【F:supabase/migrations/20260205180000_complete_database_fix.sql†L13-L39】

**Recipes / Ingredients / Steps**
- `recipes`, `recipe_ingredients`, `recipe_steps` tables exist and match the food module schema (not directly used by the weekly plan UI but still in schema).【F:supabase/migrations/007_food_module.sql†L1-L38】

**Workout Nutrition**
- `workout_nutrition` and `workout_nutrition_items` exist; `nutrition_plan_json` was added later to support storing structured plans. The API attempts to write `used_ai_enhancement`, which has no migration-defined column (schema gap).【F:supabase/migrations/20260203150000_workout_nutrition.sql†L1-L77】【F:supabase/migrations/20260205190000_add_nutrition_plan_json_to_workout_nutrition.sql†L1-L6】【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L271-L295】

### Divergences & drift hotspots (diff list)
1. **`nutrition_plans`**
   - Old schema uses `user_key` only; newer schema uses `user_id` (auth) and later migration includes both `user_id` + `user_key`.【F:supabase/migrations/002_create_nutrition_plans.sql†L3-L11】【F:supabase/migrations/003_auth_and_plans.sql†L10-L23】【F:supabase/migrations/20260204110000_clean_database_remove_unused_tables.sql†L74-L86】
2. **`nutrition_plan_rows`**
   - Created without `user_id` and `locked`/`rationale`; later migrations add `user_id`, `locked`, `rationale`, and uniqueness on `(user_id, date)` in multiple ways.【F:supabase/migrations/002_create_nutrition_plans.sql†L13-L24】【F:supabase/migrations/20260125131500_add_nutrition_plan_rows_user_id.sql†L1-L11】【F:supabase/migrations/009_plan_locking_ai_observability.sql†L1-L13】【F:supabase/migrations/20260301120000_add_ai_meal_fields.sql†L6-L7】【F:supabase/migrations/20260205200000_add_performance_indexes.sql†L30-L33】
3. **`nutrition_meals`**
   - Base schema omits `meal_type`, `emoji`, `notes`, `locked`; later migrations add these fields twice (idempotently), so the canonical shape is a superset.【F:supabase/migrations/20260201120000_ai_nutrition_meals.sql†L1-L19】【F:supabase/migrations/20260204120000_add_nutrition_meals_missing_fields.sql†L4-L17】【F:supabase/migrations/20260301120000_add_ai_meal_fields.sql†L1-L4】
4. **`ai_requests`**
   - Three distinct definitions: initial minimal table (`prompt_hash` required, no status), fuller schema with status and previews, then a **DROP/RECREATE** that removes some constraints but keeps the superset of fields. This is a high-risk drift point if migrations are applied in different orders/environments.【F:supabase/migrations/20260125124755_ai_meal_plan_schema.sql†L16-L29】【F:supabase/migrations/20260205130000_create_ai_requests_table.sql†L8-L56】【F:supabase/migrations/20260205180000_complete_database_fix.sql†L11-L39】
5. **Workout nutrition columns**
   - The API expects `nutrition_plan_json` (added) and `used_ai_enhancement` (not migrated). This will fail silently or be dropped depending on DB strictness.【F:supabase/migrations/20260203150000_workout_nutrition.sql†L1-L77】【F:supabase/migrations/20260205190000_add_nutrition_plan_json_to_workout_nutrition.sql†L1-L6】【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L271-L295】

### Which schema is actually applied in dev?
- **Ambiguous in repo**: the migrations include overlapping definitions and even a DROP/RECREATE for `ai_requests`. To confirm the active schema, inspect Supabase’s migration history table (e.g., `select * from supabase_migrations.schema_migrations order by version;`) and compare with current `information_schema.columns`.

---

## C) Endpoint Map: AI/Non-AI Flows + Broken References

| Endpoint | Input payload | Output schema | DB reads | DB writes | Dedupe/Rate-limit | Notes |
|---|---|---|---|---|---|---|
| **POST `/api/ai/plan/generate`** | `{start, end, force?, resetLocks?}` with date regex validation.【F:frontend/app/api/ai/plan/generate/route.ts†L18-L74】 | AI response validated with Zod `aiResponseSchema` and logged as diff-only response.【F:frontend/app/api/ai/plan/generate/route.ts†L63-L74】【F:frontend/app/api/ai/plan/generate/route.ts†L1313-L1547】 | `profiles`, `tp_workouts`, `nutrition_plan_rows`, `nutrition_meals`, `ai_requests` (dedupe check).【F:frontend/app/api/ai/plan/generate/route.ts†L1039-L1110】 | `ai_requests` log, `nutrition_plan_rows` upsert, `nutrition_meals` upsert, `plan_revisions` insert.【F:frontend/app/api/ai/plan/generate/route.ts†L1282-L1531】 | Rate limit via `ai_requests` in last 60s; dedupe if all days already exist.【F:frontend/app/api/ai/plan/generate/route.ts†L947-L1073】 | Chunked requests (3 days per chunk) and post-merge rule validation/removal may drop meals when repetition detected.【F:frontend/app/api/ai/plan/generate/route.ts†L1120-L1258】【F:frontend/app/api/ai/plan/generate/route.ts†L634-L771】 |
| **POST `/api/ai/nutrition/during-workout`** | Zod payload with workout metadata (duration, intensity, temps, etc.).【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L10-L28】 | Returns `{plan, targets, used_fallback, saved, recordId, ...}` with deterministic targets and AI enhancement if possible.【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L321-L340】 | `profiles` for athlete data.【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L93-L112】 | Writes `ai_requests` (optional) and `workout_nutrition` including `nutrition_plan_json` + `used_ai_enhancement`.【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L229-L305】 | None | **Schema gap:** `used_ai_enhancement` has no migration column, and `nutrition_plan_json` requires the add-column migration.【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L271-L295】【F:supabase/migrations/20260205190000_add_nutrition_plan_json_to_workout_nutrition.sql†L1-L6】 |
| **GET `/api/v1/nutrition/week`** | `start`, `end` (max 7 days).【F:frontend/app/api/v1/nutrition/week/route.ts†L25-L35】 | `{days: [{date, target, consumed, meals, locked}]}`.【F:frontend/app/api/v1/nutrition/week/route.ts†L134-L160】 | `nutrition_plan_rows`, `nutrition_meals`.【F:frontend/app/api/v1/nutrition/week/route.ts†L46-L88】 | None | None | Week-level view for calendar/summary usage. |
| **GET `/api/v1/nutrition/day`** | `date` query param (YYYY-MM-DD).【F:frontend/app/api/v1/nutrition/day/route.ts†L75-L108】 | `NutritionDayPlan` with macros + meals; meals normalize ingredients to **names only** (no quantities/steps).【F:frontend/app/api/v1/nutrition/day/route.ts†L29-L41】【F:frontend/app/api/v1/nutrition/day/route.ts†L147-L167】 | `nutrition_plan_rows`, `nutrition_meals`, `profiles`.【F:frontend/app/api/v1/nutrition/day/route.ts†L94-L129】 | None | None | Day view does not expose recipe steps; ingredient quantities are stripped. |
| **PATCH `/api/v1/nutrition/day`** | `{date, macros?, meals?, removedSlots?, day_locked?}` (Zod).【F:frontend/app/api/v1/nutrition/day/route.ts†L44-L73】 | `{ok: true}` | `nutrition_plan_rows` for existing day.【F:frontend/app/api/v1/nutrition/day/route.ts†L199-L207】 | Upserts `nutrition_plan_rows`, deletes + upserts `nutrition_meals`, deletes `meal_log`.【F:frontend/app/api/v1/nutrition/day/route.ts†L209-L260】 | None | Meal updates do not include recipe/ingredients/steps, so manually edited meals can lose those fields. |
| **GET `/api/v1/plans/week`** | `start`, `end`.【F:frontend/app/api/v1/plans/week/route.ts†L6-L37】 | `{meals: PlanWeekMeal[]}` built from `nutrition_meals` (JSONB recipe + ingredients).【F:frontend/app/api/v1/plans/week/route.ts†L29-L64】 | `nutrition_meals`.【F:frontend/app/api/v1/plans/week/route.ts†L29-L38】 | None | None | Primary data source for Plans calendar + modal. |
| **GET `/api/v1/nutrition/range`** | `start`, `end` (max 90 days).【F:frontend/app/api/v1/nutrition/range/route.ts†L21-L38】 | `{meals: ...}` with `recipe`, `ingredients`, `notes` for each meal.【F:frontend/app/api/v1/nutrition/range/route.ts†L50-L88】 | `nutrition_meals`.【F:frontend/app/api/v1/nutrition/range/route.ts†L50-L59】 | None | None | Used for range fetches and calendar aggregation. |
| **POST `/api/v1/nutrition/meal/toggle`** | `{date, slot, eaten}`.| `{ok: true, meal}` | `nutrition_meals` and `meal_log` (upsert).【F:frontend/app/api/v1/nutrition/meal/toggle/route.ts†L32-L57】 | Updates `nutrition_meals` + `meal_log`.【F:frontend/app/api/v1/nutrition/meal/toggle/route.ts†L35-L57】 | None | None | Meal completion toggle. |
| **POST `/api/v1/nutrition/meal/delete`** | `{date, slot}` (date can be ISO; normalized).【F:frontend/app/api/v1/nutrition/meal/delete/route.ts†L14-L61】 | `{ok: true}` | None | `nutrition_meals` delete by `(user_id, date, slot)`.【F:frontend/app/api/v1/nutrition/meal/delete/route.ts†L47-L54】 | None | Used by Plans modal deletion. |
| **GET `/api/v1/nutrition/during-workout`** | `startDate`, `endDate`, `limit`, `offset`.【F:frontend/app/api/v1/nutrition/during-workout/route.ts†L5-L44】 | `{records, total, limit, offset}` | `workout_nutrition`.【F:frontend/app/api/v1/nutrition/during-workout/route.ts†L28-L46】 | None | None | Read-only listing of workout nutrition. |
| **POST `/api/v1/workouts/delete`** | `{workoutId, date}` | `{ok: true}` | `tp_workouts`, then deletes `nutrition_during_workouts`.【F:frontend/app/api/v1/workouts/delete/route.ts†L43-L66】 | Deletes `tp_workouts` and a **non-existent** table reference (mismatch with `workout_nutrition`).【F:frontend/app/api/v1/workouts/delete/route.ts†L45-L66】【F:supabase/migrations/20260203150000_workout_nutrition.sql†L1-L77】 | None | **Broken reference:** table `nutrition_during_workouts` is not defined in migrations. |

---

## D) UI Contract + Why Fields Are Wrong/Missing

### Plans calendar (weekly grid)
- The Plans page builds calendar items from `PlanWeekMeal` data returned by `usePlanWeek`, then renders them in a weekly time grid (meals + workouts).【F:frontend/app/dashboard/plans/page.tsx†L61-L215】
- Meal rendering uses `meal.recipe?.title ?? meal.name` for the label, plus time + macros; emoji falls back to defaults when recipe is missing.【F:frontend/components/dashboard/plans/meal-row.tsx†L11-L33】

**Fields rendered (calendar rows)**
- **Title**: `meal.recipe?.title ?? meal.name`.
- **Time**: `meal.time` (fallback if missing).
- **Macros**: kcal, protein, carbs, fat.
- **Emoji**: `meal.emoji` or fallback. 

### Meal details modal
- Modal title uses `meal.name` directly; it uses `meal.time` for the description and renders macros from `meal.kcal/protein_g/carbs_g/fat_g`.【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L114-L147】
- Ingredients come from `meal.recipe` JSONB **or** `meal.recipe_ingredients` (populated from `nutrition_meals.ingredients`). Steps come only from `meal.recipe.steps`.【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L114-L190】

### Data contract (DB → API → UI)
- `GET /api/v1/plans/week` hydrates `PlanWeekMeal` from `nutrition_meals`, including `recipe` JSONB and `ingredients` JSONB arrays (mapped to `recipe_ingredients`).【F:frontend/app/api/v1/plans/week/route.ts†L29-L64】
- The PlanWeekMeal type defines the fields the UI expects, including `recipe`, `recipe_ingredients`, and macros/time/emoji/name.【F:frontend/lib/db/types.ts†L378-L399】

### Why “Breakfast/Snack” titles and empty ingredients/steps happen
1. **Generic titles**: The fallback meal templates explicitly name meals “Breakfast/Snack/Lunch/Dinner,” so if `recipe.title` is missing or if older data was saved with `name` only, the UI shows those generic labels (calendar row uses `meal.recipe?.title ?? meal.name`, modal title uses `meal.name`).【F:frontend/app/api/ai/plan/generate/route.ts†L198-L231】【F:frontend/components/dashboard/plans/meal-row.tsx†L11-L25】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L114-L121】
2. **Empty ingredients or steps**: The day endpoint strips ingredients to names only (no quantities/units), and does not return recipe steps at all—so if the UI is fed by this endpoint or manual edits, the modal will show empty steps and minimal ingredients.【F:frontend/app/api/v1/nutrition/day/route.ts†L29-L41】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L119-L190】
3. **Recipe JSONB missing**: If `nutrition_meals.recipe` is null (manual edits or legacy rows), the modal has no steps and only uses `recipe_ingredients` fallback, which may be empty.【F:frontend/app/api/v1/plans/week/route.ts†L29-L64】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L119-L190】

---

## E) AI Prompt / Calling Issues (Repetition, Generic Names, Empty Modal)

### Prompt rules (desired behavior)
- The system prompt explicitly forbids generic meal names, enforces max 2x recipe repetition/week, and mandates full recipe detail output with steps/ingredients/notes.【F:frontend/lib/ai/prompt.ts†L28-L175】

### Why repetition happens & constraints fail
1. **Chunking breaks global repetition constraints**: The generator splits a date range into 3-day chunks and sends each chunk independently. There is no “shared used titles” memory across chunks, so the AI can repeat recipes across chunk boundaries even if the prompt forbids it.【F:frontend/app/api/ai/plan/generate/route.ts†L13-L74】【F:frontend/app/api/ai/plan/generate/route.ts†L1120-L1258】
2. **Post-validation removes meals instead of replacing**: `validateAndFixAiResponseRules` removes meals beyond the second occurrence, which can reduce daily meal count and create macro deficits rather than fixing repetition with substitutions.【F:frontend/app/api/ai/plan/generate/route.ts†L634-L771】

### Why generic names & empty modal details persist
- **Generic names**: fallback templates use “Breakfast/Snack” names; if `recipe.title` is missing, UI falls back to `meal.name`. The modal title is always `meal.name`, so any legacy or manual rows surface the generic label directly.【F:frontend/app/api/ai/plan/generate/route.ts†L198-L231】【F:frontend/components/dashboard/plans/meal-row.tsx†L11-L25】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L114-L121】
- **Empty ingredients/steps**: Plan details depend on JSONB recipe payload; if recipe JSONB is absent, there are no steps. The day API also strips ingredient quantities/units and never sends steps, further contributing to empty modal data when those pathways are used.【F:frontend/app/api/v1/nutrition/day/route.ts†L29-L41】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L119-L190】

---

## F) What’s Already Done / Partially Done / Broken / Not Implemented

### ✅ Already done
- AI plan generation endpoint with structured schema validation, chunking, AI request logging, and persistence to `nutrition_plan_rows` + `nutrition_meals` + `plan_revisions`.【F:frontend/app/api/ai/plan/generate/route.ts†L18-L1547】
- Workout fueling deterministic engine (carbs/fluids/sodium/caffeine) and optional AI enhancement path that saves to `workout_nutrition`.【F:frontend/lib/nutrition/workoutFuelingEngine.ts†L1-L222】【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L128-L305】
- UI week plan endpoint and modal wiring for detailed meal view and deletion flow.【F:frontend/app/api/v1/plans/week/route.ts†L29-L66】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L33-L218】

### ⚠️ Partially done (or fragile)
- `ai_requests` schema is defined three different ways; recent migration drops/recreates it, which can cause environment-specific differences if migrations were applied out of order.【F:supabase/migrations/20260125124755_ai_meal_plan_schema.sql†L16-L29】【F:supabase/migrations/20260205130000_create_ai_requests_table.sql†L8-L56】【F:supabase/migrations/20260205180000_complete_database_fix.sql†L11-L47】
- `nutrition_meals` and `nutrition_plan_rows` fields are accreted across several migrations (locked, meal_type, emoji, notes, rationale), meaning dev/staging differences are likely without a single canonical schema lock-in migration.【F:supabase/migrations/20260201120000_ai_nutrition_meals.sql†L1-L19】【F:supabase/migrations/20260204120000_add_nutrition_meals_missing_fields.sql†L4-L17】【F:supabase/migrations/20260301120000_add_ai_meal_fields.sql†L1-L7】

### ❌ Broken
- `/api/v1/workouts/delete` deletes from `nutrition_during_workouts`, a table that does not exist in migrations (actual table is `workout_nutrition`).【F:frontend/app/api/v1/workouts/delete/route.ts†L60-L66】【F:supabase/migrations/20260203150000_workout_nutrition.sql†L1-L77】
- Workout fueling save path writes `used_ai_enhancement` but no migration creates this column (only `nutrition_plan_json` is added).【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L271-L295】【F:supabase/migrations/20260205190000_add_nutrition_plan_json_to_workout_nutrition.sql†L1-L6】

### ❓ Not implemented / gaps
- There is no cross-chunk “used titles” coordination mechanism for AI plan generation; chunking creates recipe repetition across the full range even though the prompt forbids it.【F:frontend/app/api/ai/plan/generate/route.ts†L1120-L1258】
- The day editing endpoint does not support recipe/ingredients/steps updates; therefore any manual adjustments will leave recipes incomplete in the modal unless other endpoints backfill them.【F:frontend/app/api/v1/nutrition/day/route.ts†L44-L73】【F:frontend/app/api/v1/nutrition/day/route.ts†L253-L260】

---

## G) Next Steps (Strict Priority Order)
1. **Verify active schema in dev**: check `supabase_migrations.schema_migrations` and reconcile `information_schema.columns` against the canonical schema above to identify which migration set “won.”
2. **Standardize the nutrition table schemas**: consolidate `nutrition_plans`, `nutrition_plan_rows`, `nutrition_meals`, `ai_requests`, and `plan_revisions` into a single canonical migration (or squash), so all environments share the same columns/indexes.【F:supabase/migrations/002_create_nutrition_plans.sql†L1-L30】【F:supabase/migrations/20260204110000_clean_database_remove_unused_tables.sql†L74-L128】【F:supabase/migrations/20260205180000_complete_database_fix.sql†L11-L60】
3. **Fix known schema/code mismatches**: update workout deletion to use `workout_nutrition`, and add/align missing columns (`used_ai_enhancement`) for workout nutrition saves.【F:frontend/app/api/v1/workouts/delete/route.ts†L60-L66】【F:frontend/app/api/ai/nutrition/during-workout/route.ts†L271-L295】
4. **Address repetition & chunking**: introduce shared `usedTitles` across chunks or move to weekly generation to keep global constraints, and replace removal logic with substitution to preserve meal count and macros.【F:frontend/app/api/ai/plan/generate/route.ts†L1120-L1258】【F:frontend/app/api/ai/plan/generate/route.ts†L634-L771】
5. **Harden UI data completeness**: ensure all update paths preserve `recipe`, `ingredients`, and `steps` (or make them required in UI/DB), so PlanDetailsModal can always render full details.【F:frontend/app/api/v1/nutrition/day/route.ts†L44-L73】【F:frontend/components/dashboard/plans/plan-details-modal.tsx†L114-L190】

