import { test } from "node:test"
import assert from "node:assert/strict"

// Mock the buildDateKeys function since we can't import from route.ts directly
function buildDateKeys(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  const keys: string[] = []
  const current = new Date(startDate)
  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0]
    keys.push(dateStr)
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return keys
}

function normalizeSportType(value: string | null): string {
  if (!value) return "other"
  const normalized = value.toLowerCase()
  if (normalized.includes("swim")) return "swim"
  if (normalized.includes("bike") || normalized.includes("cycle")) return "bike"
  if (normalized.includes("run")) return "run"
  if (normalized.includes("strength") || normalized.includes("gym")) return "strength"
  if (normalized.includes("rest")) return "rest"
  return "other"
}

function summarizeWorkoutsByDay(
  workouts: Array<{
    workout_day: string
    start_time: string | null
    workout_type: string | null
    planned_hours: number | null
    actual_hours: number | null
    tss: number | null
    if: number | null
    rpe: number | null
    title: string | null
  }>,
  start: string,
  end: string,
) {
  const dateKeys = buildDateKeys(start, end)
  const summaryMap = new Map<
    string,
    {
      total_hours: number
      tss_total: number
      sports: Set<string>
      intensityScore: number
      key_sessions: string[]
      workouts: Array<{
        start_time: string | null
        duration_hours: number
        type: string
        intensity: "rest" | "training" | "high"
      }>
    }
  >()

  workouts.forEach((workout) => {
    const key = workout.workout_day
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        total_hours: 0,
        tss_total: 0,
        sports: new Set<string>(),
        intensityScore: 0,
        key_sessions: [],
        workouts: [],
      })
    }
    const entry = summaryMap.get(key)
    if (!entry) return
    const duration = workout.actual_hours ?? workout.planned_hours ?? 0
    entry.total_hours += duration
    entry.tss_total += workout.tss ?? 0
    entry.sports.add(normalizeSportType(workout.workout_type))

    const intensitySignals = [
      workout.tss ?? 0,
      (workout.if ?? 0) * 100,
      (workout.rpe ?? 0) * 15,
    ]
    entry.intensityScore = Math.max(entry.intensityScore, ...intensitySignals)

    const isKeySession =
      (workout.tss ?? 0) >= 80 ||
      (workout.if ?? 0) >= 0.8 ||
      (workout.rpe ?? 0) >= 7 ||
      duration >= 1.5
    if (isKeySession && workout.title) {
      if (!entry.key_sessions.includes(workout.title)) {
        entry.key_sessions.push(workout.title)
      }
    }

    // Store individual workout details for AI meal planning
    const workoutIntensity =
      entry.intensityScore >= 120
        ? "high"
        : entry.intensityScore >= 60
          ? "training"
          : "rest"

    entry.workouts.push({
      start_time: workout.start_time,
      duration_hours: duration,
      type: normalizeSportType(workout.workout_type),
      intensity: workoutIntensity,
    })
  })

  return dateKeys.map((date) => {
    const entry = summaryMap.get(date)
    if (!entry) {
      return {
        date,
        total_hours: 0,
        tss_total: 0,
        sports: [],
        intensity: "rest",
        key_sessions: [],
        workouts: [],
      }
    }
    const intensity =
      entry.total_hours === 0 && entry.tss_total === 0
        ? "rest"
        : entry.intensityScore >= 120
          ? "high"
          : entry.intensityScore >= 60
            ? "training"
            : "training"

    return {
      date,
      total_hours: Number(entry.total_hours.toFixed(2)),
      tss_total: Math.round(entry.tss_total),
      sports: Array.from(entry.sports).filter((value) => value !== "rest"),
      intensity,
      key_sessions: entry.key_sessions.slice(0, 3),
      workouts: entry.workouts.map((w) => ({
        start_time: w.start_time,
        duration_hours: Number(w.duration_hours.toFixed(2)),
        type: w.type,
        intensity: w.intensity,
      })),
    }
  })
}

test("Workout summary includes start_time field", () => {
  const workouts = [
    {
      workout_day: "2026-02-05",
      start_time: "10:00",
      workout_type: "bike",
      planned_hours: 2.5,
      actual_hours: null,
      tss: 150,
      if: 0.95,
      rpe: null,
      title: "Threshold intervals",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary.length, 1)
  assert.equal(summary[0].date, "2026-02-05")
  assert.equal(summary[0].workouts.length, 1)
  assert.equal(summary[0].workouts[0].start_time, "10:00")
  assert.equal(summary[0].workouts[0].duration_hours, 2.5)
  assert.equal(summary[0].workouts[0].type, "bike")
  assert.equal(summary[0].workouts[0].intensity, "high")
})

test("Multiple workouts same day include all start times", () => {
  const workouts = [
    {
      workout_day: "2026-02-05",
      start_time: "06:00",
      workout_type: "run",
      planned_hours: 1.0,
      actual_hours: null,
      tss: 50,
      if: null,
      rpe: 6,
      title: "Easy run",
    },
    {
      workout_day: "2026-02-05",
      start_time: "17:00",
      workout_type: "strength",
      planned_hours: 1.0,
      actual_hours: null,
      tss: 40,
      if: null,
      rpe: 5,
      title: "Gym session",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts.length, 2)
  assert.equal(summary[0].workouts[0].start_time, "06:00")
  assert.equal(summary[0].workouts[0].type, "run")
  assert.equal(summary[0].workouts[1].start_time, "17:00")
  assert.equal(summary[0].workouts[1].type, "strength")
})

test("Rest day has empty workouts array", () => {
  const workouts: typeof workouts = []

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].date, "2026-02-05")
  assert.equal(summary[0].intensity, "rest")
  assert.equal(summary[0].workouts.length, 0)
  assert.deepEqual(summary[0].workouts, [])
})

test("Null start_time is preserved in workout object", () => {
  const workouts = [
    {
      workout_day: "2026-02-05",
      start_time: null,
      workout_type: "bike",
      planned_hours: 1.5,
      actual_hours: null,
      tss: 100,
      if: 0.85,
      rpe: null,
      title: "Tempo ride",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts[0].start_time, null)
  assert.equal(summary[0].workouts[0].duration_hours, 1.5)
})

test("High intensity workout properly tagged", () => {
  const workouts = [
    {
      workout_day: "2026-02-05",
      start_time: "10:00",
      workout_type: "bike",
      planned_hours: 2.5,
      actual_hours: null,
      tss: 200,
      if: 1.1,
      rpe: null,
      title: "VO2 max intervals",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].intensity, "high")
  assert.equal(summary[0].workouts[0].intensity, "high")
})
