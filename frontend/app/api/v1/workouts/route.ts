import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workout_type: z.string().min(1),
  title: z.string().min(1).optional(),
  start_time: z.string().regex(/^(\d{1,2}):(\d{2})$/).nullable().optional(),
  duration_hours: z.number().nonnegative().max(24),
  tss: z.number().nonnegative().max(500).optional(),
  rpe: z.number().int().min(1).max(10).optional(),
})

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
      .eq("user_id", user.id)
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

    console.info("GET /api/v1/workouts", {
      userId: user.id,
      date,
      count: workouts.length,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 })
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

    const payload = {
      user_id: user.id,
      workout_day: parsed.data.date,
      workout_type: parsed.data.workout_type,
      title: parsed.data.title ?? parsed.data.workout_type,
      start_time: parsed.data.start_time ?? null,
      planned_hours: parsed.data.duration_hours,
      actual_hours: parsed.data.duration_hours,
      tss: parsed.data.tss ?? null,
      rpe: parsed.data.rpe ?? null,
      source: "manual_entry",
    }

    const { data, error } = await supabase
      .from("tp_workouts")
      .insert(payload)
      .select(
        "id, workout_day, start_time, workout_type, title, description, coach_comments, planned_hours, actual_hours, tss, rpe, if",
      )
      .single()

    if (error) {
      return NextResponse.json({ error: "Database error", details: error.message, code: error.code }, { status: 400 })
    }

    return NextResponse.json({ workout: data }, { status: 201 })
  } catch (error) {
    console.error("POST /api/v1/workouts error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
