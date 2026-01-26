import { NextRequest, NextResponse } from "next/server"
import { format } from "date-fns"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get("year"))
    const month = Number(searchParams.get("month"))

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Invalid year or month." }, { status: 400 })
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

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0)
    const startKey = format(monthStart, "yyyy-MM-dd")
    const endKey = format(monthEnd, "yyyy-MM-dd")

    const { data, error } = await supabase
      .from("tp_workouts")
      .select(
        "id, workout_day, start_time, workout_type, title, description, planned_hours, actual_hours, planned_km, actual_km, tss, if, hr_avg, power_avg, rpe",
      )
      .eq("user_id", user.id)
      .gte("workout_day", startKey)
      .lte("workout_day", endKey)
      .order("workout_day", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })

    if (error) {
      return NextResponse.json(
        { error: "Failed to load workouts", details: error.message, code: error.code },
        { status: 400 },
      )
    }

    console.info("GET /api/v1/workouts/month", {
      userId: user.id,
      start: startKey,
      end: endKey,
      count: data?.length ?? 0,
    })

    return NextResponse.json({ workouts: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/workouts/month error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
