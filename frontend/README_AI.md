# AI Environment Setup

The AI meal planning flows require the following environment variables:

## Required
- `OPENAI_API_KEY` (server-only)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Optional / Server-only (if used)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_MODEL` (defaults to `gpt-4o-mini` if unset)

> **Note:** Do **not** set `NEXT_PUBLIC_OPENAI_API_KEY`. The OpenAI key must never be exposed to the browser.
