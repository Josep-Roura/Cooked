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

    const [{ count, error: countError }, { data: lastRow, error: lastError }] = await Promise.all([
      supabase
        .from("tp_workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("tp_workouts")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (countError || lastError) {
      return jsonError(
        400,
        "db_error",
        "Failed to load import status",
        countError?.message ?? lastError?.message ?? null,
      )
    }

    return NextResponse.json(
      {
        last_import_at: lastRow?.created_at ?? null,
        total_workouts: count ?? 0,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("GET /api/v1/workouts/import-status error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}
