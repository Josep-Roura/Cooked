# Dev Notes (Nutrition + TrainingPeaks)

## Canonical endpoints
- **AI plan generation (server-only)**: `POST /api/ai/plan/generate`
  - Generates nutrition plans, persists to DB, logs to `ai_requests`, and records `plan_revisions`.
- **AI status**: `GET /api/v1/ai/status`
  - Returns the most recent AI run, including error codes and debug previews (dev-only).
- **Daily nutrition (targets + meals)**: `GET /api/v1/nutrition/day?date=YYYY-MM-DD`
  - Returns macro targets and meals from `nutrition_plan_rows` + `nutrition_meals`.
- **Daily nutrition update**: `PATCH /api/v1/nutrition/day`
  - Updates macro targets, meals, and lock state in `nutrition_plan_rows` + `nutrition_meals`.
- **Daily meals (UI list source)**: `GET /api/v1/meals/day?date=YYYY-MM-DD`
  - Returns meal cards derived from `nutrition_meals`.
- **Daily macros (consumed vs target)**: `GET /api/v1/macros/day?date=YYYY-MM-DD`
  - Computes targets from `nutrition_plan_rows` and consumed macros from `nutrition_meals`.
- **Weekly nutrition**: `GET /api/v1/nutrition/week?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Consolidated targets + meals for the week.
- **Meals range**: `GET /api/v1/nutrition/range?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Range query for `nutrition_meals` (calendar views).
- **Plans week**: `GET /api/v1/plans/week?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Meals for the Plans page from `nutrition_meals`.
- **Workout import status**: `GET /api/v1/workouts/import-status`
  - Last CSV import time + total workouts.

## Payload contracts
- **`POST /api/ai/plan/generate`**
  - Body: `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "force"?: boolean, "resetLocks"?: boolean }`
  - Response: `{ ok: true, start, end, usedFallback?: boolean, diff?: {...} }` or `{ ok: false, error: { code, message, details? } }`
  - Notes:
    - `force: true` regenerates even if data exists.
    - Generation is logged to `ai_requests`, revisions to `plan_revisions`.
    - `resetLocks: true` clears day/meal locks before regeneration.

## Tables used by UI widgets
- **Overview**
  - Macros card: `nutrition_plan_rows` + `nutrition_meals` via `/api/v1/macros/day`.
  - Daily meal plan: `nutrition_meals` via `/api/v1/meals/day`.
- **Nutrition page**
  - Weekly chart + daily macros: `nutrition_plan_rows` + `nutrition_meals` via `/api/v1/nutrition/week`.
  - Meals list: `nutrition_meals` via `/api/v1/meals/day`.
- **Plans page**
  - Weekly plan cards: `nutrition_meals` via `/api/v1/plans/week`.
- **Training**
  - Training sessions: `tp_workouts` filtered by `user_id`.
  - Manual workouts: `POST /api/v1/workouts` (writes to `tp_workouts`).

## TrainingPeaks CSV import
- CSV import writes `tp_workouts.user_id = auth.uid()` and can optionally store `athlete_id` as legacy metadata.
- Unique key: `(user_id, workout_day, title, workout_type)` (per migration).

## Debugging AI + logs
- **AI request logging**: `ai_requests`
  - Contains `prompt_hash`, `model`, `provider`, `tokens`, `latency_ms`, and `response_json`.
- **Plan revisions**: `plan_revisions`
  - Stores `{ week_start, week_end, diff }` per update.
- **Common checks**
  - If plans are missing: verify `nutrition_plan_rows` + `nutrition_meals` for the date range.
  - If AI is not invoked: confirm `OPENAI_API_KEY` is set and `ai_requests` rows are written.
