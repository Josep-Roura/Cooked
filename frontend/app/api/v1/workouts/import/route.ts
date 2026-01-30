import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { parseTrainingPeaksCsv } from "@/lib/integrations/trainingpeaks/csv"

const PREVIEW_LIMIT = 10

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status })
}

type TrainingPeaksCsvRow = ReturnType<typeof parseTrainingPeaksCsv>["rows"][number]

function toInsertRow(userId: string, row: TrainingPeaksCsvRow) {
  return {
    user_id: userId,
    workout_day: row.workout_day,
    start_time: row.start_time,
    workout_type: row.workout_type || "Training",
    title: row.title || row.workout_type || "Training",
    description: row.description,
    coach_comments: row.coach_comments,
    athlete_comments: row.athlete_comments,
    planned_hours: row.planned_hours,
    planned_km: row.planned_km,
    actual_hours: row.actual_hours,
    actual_km: row.actual_km,
    if: row.if,
    tss: row.tss,
    power_avg: row.power_avg,
    hr_avg: row.hr_avg,
    rpe: row.rpe,
    feeling: row.feeling,
    has_actual: row.has_actual,
    week: row.week,
    dow: row.dow,
    source: row.source ?? "trainingpeaks_csv",
  }
}

export async function POST(req: NextRequest) {
  try {
    const mode = req.nextUrl.searchParams.get("mode") ?? "preview"
    const formData = await req.formData()
    const file = formData.get("file")
    if (!file || !(file instanceof File)) {
      return jsonError(400, "CSV file is required.")
    }

    const csvText = await file.text()
    const result = parseTrainingPeaksCsv(csvText)

    if (mode === "preview") {
      const duplicates = (() => {
        const seen = new Set<string>()
        const dupes: Array<{ workout_day: string; title: string; workout_type: string }> = []
        result.rows.forEach((row) => {
          const key = `${row.workout_day}-${row.title}-${row.workout_type}`
          if (seen.has(key)) {
            dupes.push({ workout_day: row.workout_day, title: row.title, workout_type: row.workout_type })
          } else {
            seen.add(key)
          }
        })
        return dupes
      })()

      return NextResponse.json(
        {
          preview: result.preview.slice(0, PREVIEW_LIMIT),
          errors: result.errors,
          stats: result.stats,
          duplicates,
        },
        { status: 200 },
      )
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "Not authenticated", authError?.message ?? null)
    }

    if (result.rows.length === 0) {
      return jsonError(400, "No valid workouts were found in this CSV.")
    }

    const payload = result.rows.map((row) => toInsertRow(user.id, row))
    const dates = payload.map((row) => row.workout_day)
    const minDate = dates.reduce((min, date) => (date < min ? date : min), dates[0])
    const maxDate = dates.reduce((max, date) => (date > max ? date : max), dates[0])

    const { data: existingRows, error: existingError } = await supabase
      .from("tp_workouts")
      .select("workout_day, title, workout_type")
      .eq("user_id", user.id)
      .gte("workout_day", minDate)
      .lte("workout_day", maxDate)

    if (existingError) {
      return jsonError(400, "Failed to load existing workouts", existingError.message)
    }

    const existingKeys = new Set(
      (existingRows ?? []).map((row) => `${row.workout_day}-${row.title}-${row.workout_type}`),
    )

    let created = 0
    let updated = 0
    payload.forEach((row) => {
      const key = `${row.workout_day}-${row.title}-${row.workout_type}`
      if (existingKeys.has(key)) {
        updated += 1
      } else {
        created += 1
      }
    })

    const { error: upsertError } = await supabase
      .from("tp_workouts")
      .upsert(payload, { onConflict: "user_id,workout_day,title,workout_type" })

    if (upsertError) {
      return jsonError(400, "Failed to import workouts", upsertError.message)
    }

    return NextResponse.json(
      {
        created,
        updated,
        skipped: result.errors.length,
        errors: result.errors,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("POST /api/v1/workouts/import error:", error)
    return jsonError(
      500,
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}
