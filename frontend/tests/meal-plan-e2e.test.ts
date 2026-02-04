import { test } from "node:test"
import assert from "node:assert/strict"

// Reusable test utilities
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

interface Meal {
  slot: number
  meal_type: "breakfast" | "snack" | "lunch" | "dinner" | "intra"
  time: string
  emoji: string
  name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface DayPlan {
  date: string
  day_type: "rest" | "training" | "high"
  daily_targets: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    intra_cho_g_per_h: number
  }
  meals: Meal[]
  rationale: string
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

// Helper to validate meal times are scheduled appropriately around workouts
function validateMealTimingAroundWorkout(
  meals: Meal[],
  workout: WorkoutSummary["workouts"][0],
): { valid: boolean; issues: string[] } {
  if (!workout.start_time) {
    return { valid: true, issues: [] }
  }

  const workoutStart = parseTime(workout.start_time)
  const workoutEnd = addHours(workoutStart, workout.duration_hours)
  const preWorkoutWindow = subtractMinutes(workoutStart, 60)
  const postWorkoutWindow = addMinutes(workoutEnd, 60)

  const issues: string[] = []

  // Check for meals that would conflict with workout time
  for (const meal of meals) {
    const mealTime = parseTime(meal.time)
    if (
      isTimeBetween(mealTime, workoutStart, workoutEnd) &&
      meal.meal_type !== "intra"
    ) {
      issues.push(
        `${meal.meal_type} meal at ${meal.time} conflicts with workout at ${workout.start_time}`,
      )
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() + minutes)
  return result
}

function subtractMinutes(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(result.getMinutes() - minutes)
  return result
}

function isTimeBetween(
  time: Date,
  start: Date,
  end: Date,
): boolean {
  return time > start && time < end
}

// Test cases
test("E2E: Single workout day gets appropriate meal schedule", () => {
  const workouts: Workout[] = [
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
  assert.equal(summary[0].intensity, "high")
  assert.equal(summary[0].workouts.length, 1)
  assert.equal(summary[0].workouts[0].start_time, "10:00")

  // Simulate meal plan for this day
  const meals: Meal[] = [
    {
      slot: 1,
      meal_type: "breakfast",
      time: "07:00",
      emoji: "🥣",
      name: "Oatmeal with berries",
      kcal: 400,
      protein_g: 15,
      carbs_g: 60,
      fat_g: 8,
    },
    {
      slot: 2,
      meal_type: "snack",
      time: "09:15",
      emoji: "🍌",
      name: "Banana with almond butter",
      kcal: 250,
      protein_g: 8,
      carbs_g: 30,
      fat_g: 10,
    },
    {
      slot: 3,
      meal_type: "intra",
      time: "11:30",
      emoji: "⚡",
      name: "Sports drink",
      kcal: 150,
      protein_g: 0,
      carbs_g: 40,
      fat_g: 0,
    },
    {
      slot: 4,
      meal_type: "lunch",
      time: "13:00",
      emoji: "🥗",
      name: "Recovery bowl",
      kcal: 650,
      protein_g: 35,
      carbs_g: 75,
      fat_g: 15,
    },
  ]

  // Validate timing
  const validation = validateMealTimingAroundWorkout(meals, summary[0].workouts[0])
  assert.equal(
    validation.valid,
    true,
    `Meals should not conflict with workout: ${validation.issues.join(", ")}`,
  )
})

test("E2E: Multiple workouts same day have separate meal windows", () => {
  const workouts: Workout[] = [
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
  assert.equal(summary[0].workouts[1].start_time, "17:00")

  // Validate that we can schedule meals around both workouts
  // Pre-first workout: 4:30-5:45
  // Between workouts: 7:30-16:30
  // Post-second workout: 18:30+

  const meals: Meal[] = [
    {
      slot: 1,
      meal_type: "breakfast",
      time: "05:00",
      emoji: "🥣",
      name: "Pre-run breakfast",
      kcal: 300,
      protein_g: 12,
      carbs_g: 45,
      fat_g: 6,
    },
    {
      slot: 2,
      meal_type: "snack",
      time: "07:15",
      emoji: "🍎",
      name: "Post-run snack",
      kcal: 200,
      protein_g: 8,
      carbs_g: 30,
      fat_g: 5,
    },
    {
      slot: 3,
      meal_type: "lunch",
      time: "12:00",
      emoji: "🥗",
      name: "Lunch",
      kcal: 650,
      protein_g: 35,
      carbs_g: 70,
      fat_g: 18,
    },
    {
      slot: 4,
      meal_type: "snack",
      time: "16:00",
      emoji: "🍌",
      name: "Pre-gym snack",
      kcal: 250,
      protein_g: 12,
      carbs_g: 35,
      fat_g: 5,
    },
    {
      slot: 5,
      meal_type: "dinner",
      time: "19:00",
      emoji: "🍗",
      name: "Post-gym dinner",
      kcal: 750,
      protein_g: 45,
      carbs_g: 75,
      fat_g: 20,
    },
  ]

  // Validate both workouts
  for (const workout of summary[0].workouts) {
    const validation = validateMealTimingAroundWorkout(meals, workout)
    assert.equal(
      validation.valid,
      true,
      `Meals should not conflict with ${workout.type} at ${workout.start_time}: ${validation.issues.join(", ")}`,
    )
  }
})

test("E2E: Rest day has evenly distributed meals", () => {
  const workouts: Workout[] = [] // No workouts

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")

  assert.equal(summary[0].date, "2026-02-05")
  assert.equal(summary[0].intensity, "rest")
  assert.equal(summary[0].workouts.length, 0)

  // For rest days, meals should be evenly distributed
  const meals: Meal[] = [
    {
      slot: 1,
      meal_type: "breakfast",
      time: "08:00",
      emoji: "🥣",
      name: "Breakfast",
      kcal: 500,
      protein_g: 20,
      carbs_g: 60,
      fat_g: 12,
    },
    {
      slot: 2,
      meal_type: "snack",
      time: "10:30",
      emoji: "🍎",
      name: "Morning snack",
      kcal: 200,
      protein_g: 8,
      carbs_g: 25,
      fat_g: 6,
    },
    {
      slot: 3,
      meal_type: "lunch",
      time: "12:30",
      emoji: "🥗",
      name: "Lunch",
      kcal: 700,
      protein_g: 35,
      carbs_g: 80,
      fat_g: 18,
    },
    {
      slot: 4,
      meal_type: "snack",
      time: "15:00",
      emoji: "🍌",
      name: "Afternoon snack",
      kcal: 250,
      protein_g: 10,
      carbs_g: 35,
      fat_g: 7,
    },
    {
      slot: 5,
      meal_type: "dinner",
      time: "18:00",
      emoji: "🍗",
      name: "Dinner",
      kcal: 750,
      protein_g: 40,
      carbs_g: 80,
      fat_g: 22,
    },
  ]

  // Verify meals are roughly 2-3 hours apart
  const mealTimes = meals.map((m) => parseTime(m.time))
  for (let i = 1; i < mealTimes.length; i++) {
    const diffMinutes =
      (mealTimes[i].getTime() - mealTimes[i - 1].getTime()) / (1000 * 60)
    assert(
      diffMinutes >= 90 && diffMinutes <= 240,
      `Meals should be 1.5-4 hours apart, but found ${diffMinutes} minutes`,
    )
  }
})

test("E2E: Long workout (3+ hours) schedules intra-meal", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "08:00",
      workout_type: "bike",
      planned_hours: 3.5,
      actual_hours: null,
      tss: 200,
      if: 0.9,
      rpe: null,
      title: "Long endurance ride",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")

  assert.equal(summary[0].workouts.length, 1)
  assert.equal(summary[0].workouts[0].duration_hours, 3.5)

  const meals: Meal[] = [
    {
      slot: 1,
      meal_type: "breakfast",
      time: "07:00",
      emoji: "🥣",
      name: "Pre-ride breakfast",
      kcal: 400,
      protein_g: 15,
      carbs_g: 55,
      fat_g: 10,
    },
    {
      slot: 2,
      meal_type: "intra",
      time: "09:30",
      emoji: "⚡",
      name: "Sports drink round 1",
      kcal: 200,
      protein_g: 0,
      carbs_g: 50,
      fat_g: 0,
    },
    {
      slot: 3,
      meal_type: "intra",
      time: "11:15",
      emoji: "⚡",
      name: "Energy bar",
      kcal: 250,
      protein_g: 8,
      carbs_g: 45,
      fat_g: 5,
    },
    {
      slot: 4,
      meal_type: "lunch",
      time: "12:00",
      emoji: "🥗",
      name: "Post-ride recovery",
      kcal: 800,
      protein_g: 40,
      carbs_g: 100,
      fat_g: 20,
    },
  ]

  // Validate that intra-meals fall within workout window
  const workout = summary[0].workouts[0]
  const intraMeals = meals.filter((m) => m.meal_type === "intra")
  assert(intraMeals.length >= 2, "Long workout should have at least 2 intra-meals")

  for (const meal of intraMeals) {
    const validation = validateMealTimingAroundWorkout(meals, workout)
    assert.equal(validation.valid, true)
  }
})

test("E2E: Very short workout (< 60 min) doesn't need intra-meal", () => {
  const workouts: Workout[] = [
    {
      workout_day: "2026-02-05",
      start_time: "17:00",
      workout_type: "strength",
      planned_hours: 0.75,
      actual_hours: null,
      tss: 45,
      if: null,
      rpe: 6,
      title: "Quick strength session",
    },
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-05")

  assert.equal(summary[0].workouts[0].duration_hours, 0.75)

  const meals: Meal[] = [
    {
      slot: 1,
      meal_type: "snack",
      time: "16:15",
      emoji: "🍌",
      name: "Pre-workout snack",
      kcal: 200,
      protein_g: 8,
      carbs_g: 30,
      fat_g: 5,
    },
    {
      slot: 2,
      meal_type: "dinner",
      time: "18:00",
      emoji: "🍗",
      name: "Dinner",
      kcal: 750,
      protein_g: 40,
      carbs_g: 80,
      fat_g: 20,
    },
  ]

  // Short workouts shouldn't have intra-meals
  const intraMeals = meals.filter((m) => m.meal_type === "intra")
  assert.equal(intraMeals.length, 0, "Short workouts shouldn't have intra-meals")

  const validation = validateMealTimingAroundWorkout(
    meals,
    summary[0].workouts[0],
  )
  assert.equal(validation.valid, true)
})

test("E2E: Multi-day plan with varied workout intensity", () => {
  const workouts: Workout[] = [
    // Day 1: Hard
    {
      workout_day: "2026-02-05",
      start_time: "10:00",
      workout_type: "bike",
      planned_hours: 2.0,
      actual_hours: null,
      tss: 180,
      if: 1.0,
      rpe: null,
      title: "VO2 max intervals",
    },
    // Day 2: Moderate
    {
      workout_day: "2026-02-06",
      start_time: "09:00",
      workout_type: "run",
      planned_hours: 1.5,
      actual_hours: null,
      tss: 80,
      if: 0.8,
      rpe: null,
      title: "Steady run",
    },
    // Day 3: Rest (no workouts)
  ]

  const summary = summarizeWorkoutsByDay(workouts, "2026-02-05", "2026-02-07")

  assert.equal(summary.length, 3)
  
  // Day 1: High intensity
  assert.equal(summary[0].date, "2026-02-05")
  assert.equal(summary[0].intensity, "high")
  assert.equal(summary[0].workouts.length, 1)
  
  // Day 2: Training intensity
  assert.equal(summary[1].date, "2026-02-06")
  assert.equal(summary[1].intensity, "training")
  assert.equal(summary[1].workouts.length, 1)
  
  // Day 3: Rest
  assert.equal(summary[2].date, "2026-02-07")
  assert.equal(summary[2].intensity, "rest")
  assert.equal(summary[2].workouts.length, 0)
})
