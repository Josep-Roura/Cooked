This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## MVP Run Instructions

### Backend (FastAPI)

From the repo root:

```bash
cd backend
cp .env.example .env
PYTHONPATH=src uvicorn coocked_api.api.main:app --reload --port 8000
```

Backend runs on [http://localhost:8000](http://localhost:8000).

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env` to enable plan persistence.

Apply `supabase/migrations/002_create_nutrition_plans.sql` in Supabase to create the nutrition plan tables.

### Frontend (Next.js)

From the repo root:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Frontend runs on [http://localhost:3000](http://localhost:3000).

The UI generates a device ID in localStorage and sends it to the backend as `x-device-id`.

Environment variables for Supabase (client)
- Create `frontend/.env.local` and set the following values for local dev:
  - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/public key (do NOT use service role key)
  - `NEXT_PUBLIC_API_BASE` — e.g. `http://localhost:8000`

If these are missing, the signup/login UI will show a friendly message instead of crashing.

## API examples

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
