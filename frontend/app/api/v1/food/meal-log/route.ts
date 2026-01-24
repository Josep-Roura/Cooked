import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date")
    if (!date || !DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 })
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }

    const { data, error } = await supabase
      .from("meal_log")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", date)
      .order("slot", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to load meal log", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ meal_log: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/food/meal-log error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }

    const date = typeof body.date === "string" ? body.date : ""
    const slot = typeof body.slot === "number" ? body.slot : Number.NaN
    const is_eaten = typeof body.is_eaten === "boolean" ? body.is_eaten : null

    if (!DATE_REGEX.test(date) || !Number.isFinite(slot) || slot <= 0 || is_eaten === null) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 })
    }

    const payload = {
      user_id: user.id,
      date,
      slot,
      is_eaten,
      eaten_at: is_eaten ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from("meal_log")
      .upsert(payload, { onConflict: "user_id,date,slot" })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: "Failed to update meal log", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ meal_log: data }, { status: 200 })
  } catch (error) {
    console.error("PATCH /api/v1/food/meal-log error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
