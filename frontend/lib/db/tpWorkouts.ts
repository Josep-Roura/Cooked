import { supabase } from "@/lib/supabase/client"
import type { TpWorkout } from "@/lib/db/types"
import type { TrainingPeaksCsvRow } from "@/lib/integrations/trainingpeaks/csv"

const BATCH_SIZE = 200

export type TpWorkoutInsert = Omit<TpWorkout, "id" | "created_at" | "updated_at">

function dedupeRows(rows: TpWorkoutInsert[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = `${row.user_id}-${row.workout_day}-${row.title}-${row.workout_type}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function toInsertRow(userId: string, row: TrainingPeaksCsvRow): TpWorkoutInsert {
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

export async function importWorkouts(
  userId: string,
  rows: TrainingPeaksCsvRow[],
  onProgress?: (progress: number) => void,
) {
  const payload = dedupeRows(rows.map((row) => toInsertRow(userId, row)))
  const total = payload.length
  let processed = 0

  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from("tp_workouts")
      .upsert(batch, { onConflict: "user_id,workout_day,title,workout_type" })

    if (error) {
      throw new Error(error.message)
    }

    processed += batch.length
    if (onProgress) {
      onProgress(Math.min(100, Math.round((processed / total) * 100)))
    }
  }

  return { inserted: total }
}

export async function fetchWorkoutsByDateRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<TpWorkout[]> {
  const { data, error } = await supabase
    .from("tp_workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("workout_day", startDate)
    .lte("workout_day", endDate)
    .order("workout_day", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
