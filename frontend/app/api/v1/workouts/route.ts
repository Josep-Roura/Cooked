import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function normalizeStartTime(value: string | null) {
  if (!value) return "07:00"
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return "07:00"
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const date = url.searchParams.get("date")

    if (!date || !DATE_REGEX.test(date)) {
      return NextResponse.json({ error: "Invalid or missing date (YYYY-MM-DD required)." }, { status: 400 })
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
      .from("tp_workouts")
      .select(
        "id, workout_day, start_time, workout_type, title, description, coach_comments, planned_hours, actual_hours, tss, rpe, if",
      )
      .eq("athlete_id", `user:${user.id}`)
      .eq("workout_day", date)
      .order("start_time", { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: "Database error", details: error.message, code: error.code },
        { status: 400 },
      )
    }

    const workouts = (data ?? []).map((workout) => {
      const durationHours = workout.actual_hours ?? workout.planned_hours ?? 0
      return {
        id: workout.id,
        date: workout.workout_day,
        type: workout.workout_type ?? "training",
        title: workout.title ?? workout.workout_type ?? "Training",
        start_time: normalizeStartTime(workout.start_time),
        planned_hours: workout.planned_hours ?? 0,
        actual_hours: workout.actual_hours ?? 0,
        duration_hours: durationHours,
        tss: workout.tss ?? 0,
        rpe: workout.rpe ?? null,
        if: workout.if ?? null,
        description: workout.description ?? workout.coach_comments ?? null,
      }
    })

    return NextResponse.json({ date, workouts }, { status: 200 })
  } catch (error) {
    console.error("GET /api/v1/workouts error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
