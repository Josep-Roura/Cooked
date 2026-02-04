import { test } from "node:test"
import assert from "node:assert/strict"

// Test utilities for edge cases
interface Workout {
  workout_day: string
  start_time: string | null
  workout_type: string | null
  planned_hours: number | null
  actual_hours: number | null
  tss: number | null
  if: number | null
  rpe: number | null
  title: string | null
}

interface WorkoutSummary {
  date: string
  total_hours: number
  tss_total: number
  sports: string[]
  intensity: "rest" | "training" | "high"
  key_sessions: string[]
  workouts: Array<{
    start_time: string | null
    duration_hours: number
    type: string
    intensity: "rest" | "training" | "high"
  }>
}

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
  workouts: Workout[],
  start: string,
  end: string,
): WorkoutSummary[] {
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
        intensity: "rest" as const,
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
      intensity: intensity as "rest" | "training" | "high",
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

// Edge case tests
test("Edge: Very early morning workout (5:00 AM)", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "05:00",
      workout_type: "run",
      planned_hours: 1.0,
      actual_hours: null,
      tss: 60,
      if: null,
      rpe: 6,
      title: "Early morning run",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts[0].start_time, "05:00")
  assert(
    summary[0].workouts.length === 1,
    "Should capture very early morning workout",
  )
})

test("Edge: Very late evening workout (22:00)", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "22:00",
      workout_type: "strength",
      planned_hours: 1.0,
      actual_hours: null,
      tss: 50,
      if: null,
      rpe: 5,
      title: "Evening gym",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts[0].start_time, "22:00")
  assert(
    summary[0].workouts.length === 1,
    "Should capture very late evening workout",
  )
})

test("Edge: Extremely long workout (5+ hours)", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "07:00",
      workout_type: "bike",
      planned_hours: 5.5,
      actual_hours: null,
      tss: 300,
      if: 0.8,
      rpe: null,
      title: "Ultra-long endurance ride",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts[0].duration_hours, 5.5)
  assert.equal(summary[0].intensity, "high")
  assert(
    summary[0].tss_total >= 300,
    "Should properly accumulate TSS for very long workouts",
  )
})

test("Edge: Very short workout (15 minutes)", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "12:00",
      workout_type: "strength",
      planned_hours: 0.25,
      actual_hours: null,
      tss: 10,
      if: null,
      rpe: 3,
      title: "Quick core",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts[0].duration_hours, 0.25)
  // Short, low intensity workout
  assert.equal(summary[0].intensity, "training")
})

test("Edge: Multiple workouts same time (back-to-back)", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "08:00",
      workout_type: "swim",
      planned_hours: 1.0,
      actual_hours: null,
      tss: 80,
      if: 0.8,
      rpe: null,
      title: "Swim",
    },
    {
      workout_day: "2026-02-05",
      start_time: "09:00",
      workout_type: "bike",
      planned_hours: 1.5,
      actual_hours: null,
      tss: 100,
      if: 0.9,
      rpe: null,
      title: "Bike",
    },
    {
      workout_day: "2026-02-05",
      start_time: "10:45",
      workout_type: "run",
      planned_hours: 1.0,
      actual_hours: null,
      tss: 80,
      if: 0.8,
      rpe: null,
      title: "Run",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts.length, 3)
  assert.equal(summary[0].workouts[0].start_time, "08:00")
  assert.equal(summary[0].workouts[1].start_time, "09:00")
  assert.equal(summary[0].workouts[2].start_time, "10:45")
  assert.equal(summary[0].total_hours, 3.5)
  assert.equal(summary[0].tss_total, 260)
  // Triathlon day should be training intensity (260 TSS falls in training zone)
  assert.equal(summary[0].intensity, "training")
  // Triathlon day should have all 3 sports
  assert.equal(summary[0].sports.length, 3)
})

test("Edge: Workout with no start_time specified", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: null,
      workout_type: "bike",
      planned_hours: 2.0,
      actual_hours: null,
      tss: 120,
      if: 0.9,
      rpe: null,
      title: "Unscheduled bike",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts[0].start_time, null)
  assert.equal(summary[0].workouts[0].duration_hours, 2.0)
  assert.equal(summary[0].workouts.length, 1)
})

test("Edge: Rest week (7 consecutive days no workouts)", () => {
  const workouts: Workout[] = [] // No workouts

  const summary = summarizeWorkoutsByDay(
    workouts,
    "2026-02-05",
    "2026-02-11",
  )
  
  assert.equal(summary.length, 7)
  for (const day of summary) {
    assert.equal(day.intensity, "rest")
    assert.equal(day.workouts.length, 0)
    assert.equal(day.total_hours, 0)
    assert.equal(day.tss_total, 0)
  }
})

test("Edge: Alternating hard/easy with 1 rest day", () => {
  const workouts: Workout[] = [
    // Day 1: Hard
    {
      workout_day: "2026-02-05",
      start_time: "10:00",
      workout_type: "bike",
      planned_hours: 2.5,
      actual_hours: null,
      tss: 180,
      if: 1.0,
      rpe: null,
      title: "Hard intervals",
    },
    // Day 2: Easy
    {
      workout_day: "2026-02-06",
      start_time: "09:00",
      workout_type: "run",
      planned_hours: 0.75,
      actual_hours: null,
      tss: 30,
      if: null,
      rpe: 4,
      title: "Easy run",
    },
    // Day 3: Rest
    // Day 4: Hard
    {
      workout_day: "2026-02-08",
      start_time: "10:00",
      workout_type: "swim",
      planned_hours: 1.5,
      actual_hours: null,
      tss: 100,
      if: 0.85,
      rpe: null,
      title: "Swim set",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-08")
  
  assert.equal(summary.length, 4)
  assert.equal(summary[0].intensity, "high") // Day 1
  assert.equal(summary[1].intensity, "training") // Day 2
  assert.equal(summary[2].intensity, "rest") // Day 3
  assert.equal(summary[3].intensity, "training") // Day 4
})

test("Edge: Dual sport day with very different durations", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "06:00",
      workout_type: "swim",
      planned_hours: 0.5,
      actual_hours: null,
      tss: 40,
      if: 0.75,
      rpe: null,
      title: "Quick swim",
    },
    {
      workout_day: "2026-02-05",
      start_time: "17:00",
      workout_type: "bike",
      planned_hours: 4.0,
      actual_hours: null,
      tss: 200,
      if: 0.95,
      rpe: null,
      title: "Long bike",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts.length, 2)
  assert.equal(summary[0].total_hours, 4.5)
  // Long bike dominates intensity
  assert.equal(summary[0].intensity, "high")
})

test("Edge: Workout with actual_hours vs planned_hours", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "10:00",
      workout_type: "bike",
      planned_hours: 2.0,
      actual_hours: 1.75, // Finished early
      tss: 130,
      if: 0.92,
      rpe: null,
      title: "Tempo ride",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  // Should use actual_hours if available
  assert.equal(summary[0].workouts[0].duration_hours, 1.75)
  assert.equal(summary[0].total_hours, 1.75)
})

test("Edge: Workout with null actual_hours falls back to planned_hours", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "10:00",
      workout_type: "bike",
      planned_hours: 2.0,
      actual_hours: null,
      tss: 150,
      if: 0.95,
      rpe: null,
      title: "Threshold",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts[0].duration_hours, 2.0)
})

test("Edge: Single day with all null values except required fields", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: null,
      workout_type: null,
      planned_hours: null,
      actual_hours: null,
      tss: null,
      if: null,
      rpe: null,
      title: null,
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")
  
  assert.equal(summary[0].workouts.length, 1)
  assert.equal(summary[0].workouts[0].start_time, null)
  assert.equal(summary[0].workouts[0].duration_hours, 0)
  assert.equal(summary[0].workouts[0].type, "other")
})

test("Edge: Massive training week (15 workouts)", () => {
  const workouts: Workout[] = Array.from({ length: 15 }, (_, i) => {
    const dayOffset = Math.floor(i / 3)
    const hour = 6 + (i % 3) * 6
    return {
      workout_day: `2026-02-0${5 + dayOffset}`,
      start_time: `${hour.toString().padStart(2, "0")}:00`,
      workout_type: ["swim", "bike", "run"][i % 3],
      planned_hours: 1.0 + Math.random(),
      actual_hours: null,
      tss: 50 + Math.random() * 50,
      if: 0.7 + Math.random() * 0.25,
      rpe: null,
      title: `Workout ${i + 1}`,
    }
  })

  const summary = summarizeWorkoutsByDay(
    workouts,
    "2026-02-05",
    "2026-02-07",
  )
  
  assert.equal(summary.length, 3)
  for (const day of summary) {
    assert(day.workouts.length > 0, "Each day should have workouts")
    assert(day.total_hours > 0, "Each day should have duration")
  }
})
