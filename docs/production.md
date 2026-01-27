# Production Runbook

## Required environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `OPENAI_API_KEY` (server-only)
- `OPENAI_MODEL` (optional, defaults to `gpt-4o-mini`)

## Deployment checklist
1. Run the release checklist script (see below).
2. Ensure Supabase migrations are applied (including lock + observability columns).
3. Verify `ai_requests` and `plan_revisions` are writable by RLS.
4. Confirm `OPENAI_API_KEY` is present in the server environment.

## Release checklist script
From repo root:
```bash
./scripts/release-checklist.sh
```

## Debugging AI generation
- Check `/api/v1/ai/status` for the last run time, model, latency, and error code.
- Inspect `ai_requests` rows for `prompt_hash`, `error_code`, and previews.
- Verify `nutrition_plan_rows` and `nutrition_meals` are populated for the target range.

## Health checks
- `/api/v1/health` should return `{ ok: true, status: "ok" }`.
- A 401 response indicates missing auth cookies in the request.

## Common failures
- **Rate limit**: `429 rate_limited` from `/api/ai/plan/generate` — wait before regenerating.
- **Invalid range**: Ensure all dates are `YYYY-MM-DD` and within the allowed range.
- **Missing OpenAI key**: Confirm `OPENAI_API_KEY` is set on the server.
