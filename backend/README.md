# Cooked AI Backend

Backend utilities for parsing TrainingPeaks exports, generating MVP datasets, and loading workouts into Supabase.

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

### 2) Install dependencies

```bash
pip install -r requirements.txt
```

### 3) Configure environment variables

Copy the example env file from the repo root:

```bash
cp ../.env.example ../.env
```

Fill in `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY`.

### 4) Run scripts

From `backend/`:

macOS/Linux:

```bash
PYTHONPATH=src python scripts/tp_extract_and_viz.py --input "../data/tp.csv" --outdir "out"
PYTHONPATH=src python scripts/tp_to_supabase.py --input "../data/tp.csv" --user_id "<SUPABASE_USER_UUID>" --athlete_id "josep"
```

Windows PowerShell:

```powershell
$env:PYTHONPATH="src"
python scripts\tp_extract_and_viz.py --input "..\data\tp.csv" --outdir "out"
python scripts\tp_to_supabase.py --input "..\data\tp.csv" --user_id "<SUPABASE_USER_UUID>" --athlete_id "josep"
```
