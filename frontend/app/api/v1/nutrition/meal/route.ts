import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const date = typeof body.date === "string" ? body.date : ""
    const slot = typeof body.slot === "number" ? body.slot : Number.NaN
    const completed = typeof body.completed === "boolean" ? body.completed : null

    if (!DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Invalid or missing date (YYYY-MM-DD required)." }, { status: 400 })
    }
    if (!Number.isFinite(slot) || slot <= 0) {
      return NextResponse.json({ error: "Invalid meal slot." }, { status: 400 })
    }
    if (completed === null) {
      return NextResponse.json({ error: "Invalid completed value." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated", details: authError?.message ?? null }, { status: 401 })
    }

    const eatenAt = completed ? new Date().toISOString() : null

    const { data, error } = await supabase
      .from("nutrition_meals")
      .update({ eaten: completed, eaten_at: eatenAt })
      .eq("user_id", user.id)
      .eq("date", date)
      .eq("slot", slot)
      .select("id, date, slot, eaten")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update meal", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, date, meal: data }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/nutrition/meal error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
