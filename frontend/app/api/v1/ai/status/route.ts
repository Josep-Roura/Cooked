import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

type ErrorPayload = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

function jsonError(status: number, code: string, message: string, details?: unknown) {
  const payload: ErrorPayload = { ok: false, error: { code, message, details } }
  return NextResponse.json(payload, { status })
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
    }

    const { data, error } = await supabase
      .from("ai_requests")
      .select("id, created_at, model, provider, latency_ms, tokens, error_code, prompt_hash, prompt_preview, response_preview")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return jsonError(400, "db_error", "Failed to load AI status", error.message)
    }

    const isDev = process.env.NODE_ENV !== "production"
    const last_run = data
      ? {
          id: data.id,
          created_at: data.created_at,
          model: data.model,
          provider: data.provider,
          latency_ms: data.latency_ms,
          tokens: data.tokens,
          error_code: data.error_code,
          prompt_hash: isDev ? data.prompt_hash : null,
          prompt_preview: isDev ? data.prompt_preview : null,
          response_preview: isDev ? data.response_preview : null,
        }
      : null

    return NextResponse.json({ last_run }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/ai/status error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}
