# Cooked AI

Cooked AI is a nutrition assistant for endurance athletes. The MVP parses TrainingPeaks CSV exports, generates summaries and plots, and uploads workouts to Supabase.

## Repo Structure

```
backend/   # Python scripts + future API
frontend/  # Web app
supabase/  # Migrations
```

## Quickstart

### 1) Create and activate a virtual environment

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2) Install backend dependencies

```bash
pip install -r backend/requirements.txt
```

### 3) Configure environment variables

```bash
cp .env.example .env
```

Fill in `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY`.

### 4) Run the API + frontend

Backend:

```bash
cd backend
cp .env.example .env
PYTHONPATH=src uvicorn coocked_api.api.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### 5) Run scripts

macOS/Linux:

```bash
cd backend
PYTHONPATH=src python scripts/tp_extract_and_viz.py --input "../data/tp.csv" --outdir "out"
PYTHONPATH=src python scripts/tp_to_supabase.py --input "../data/tp.csv" --athlete_id "josep"
```

Windows PowerShell:

```powershell
cd backend
$env:PYTHONPATH="src"
python scripts\tp_extract_and_viz.py --input "..\data\tp.csv" --outdir "out"
python scripts\tp_to_supabase.py --input "..\data\tp.csv" --athlete_id "josep"
```

## Supabase schema (nutrition plans)

Apply `supabase/migrations/002_create_nutrition_plans.sql` in your Supabase SQL editor to create the tables.

## API usage

All plan endpoints require the `x-device-id` header. Use any stable string (the frontend stores a UUID in localStorage).

```bash
# health check
curl http://localhost:8000/health

# generate + save plan
curl -X POST http://localhost:8000/api/v1/plan/nutrition \
  -H "x-device-id: demo-device" \
  -F "weight_kg=72" \
  -F "file=@workouts_mvp.csv"

# list plans
curl "http://localhost:8000/api/v1/plans?limit=20&offset=0" \
  -H "x-device-id: demo-device"

# get plan by id
curl http://localhost:8000/api/v1/plans/<plan_id> \
  -H "x-device-id: demo-device"
```
