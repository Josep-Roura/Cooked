import { buildMealTemplates, computeDailyTargets, computeDayType, type Workout } from "./engine"

export type PlannerProfile = {
  weight_kg: number
  meals_per_day: number
  diet?: string | null
  allergies?: string[] | null
}

export type MealTarget = {
  slot: number
  meal_type: "breakfast" | "snack" | "lunch" | "dinner" | "intra"
  time: string
  emoji: string
  target_macros: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

export type DayPlan = {
  date: string
  day_type: "rest" | "training" | "high"
  daily_targets: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
    intra_cho_g_per_h: number
  }
  meals: MealTarget[]
}

type WorkoutWithTiming = Workout & {
  start_time: string | null
  planned_hours: number | null
  actual_hours: number | null
}

type WeeklyPlannerInput = {
  start: string
  end: string
  profile: PlannerProfile
  workouts: WorkoutWithTiming[]
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function toTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440
  const hours = Math.floor(normalized / 60)
  const mins = Math.floor(normalized % 60)
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

function roundToNearest(minutes: number, step = 5) {
  return Math.round(minutes / step) * step
}

function ensureTimeGaps(meals: MealTarget[], minGap = 30) {
  const sorted = [...meals].sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
  let lastTime = -Infinity
  sorted.forEach((meal) => {
    let current = toMinutes(meal.time)
    if (current - lastTime < minGap) {
      current = lastTime + minGap
      meal.time = toTime(current)
    }
    lastTime = current
  })
  return sorted
}

function adjustForWorkoutTiming(
  meals: MealTarget[],
  workout: { start_time: string; duration_hours: number },
) {
  const startMinutes = toMinutes(workout.start_time)
  const durationMinutes = Math.round(workout.duration_hours * 60)
  const endMinutes = startMinutes + durationMinutes

  const preTime = roundToNearest(startMinutes - 60)
  const postTime = roundToNearest(endMinutes + 60)
  const intraTime = roundToNearest(startMinutes + Math.round(durationMinutes / 2))

  const preMeal = meals.find((meal) => meal.meal_type === "breakfast" || meal.meal_type === "snack")
  if (preMeal) {
    preMeal.time = toTime(preTime)
  }

  const postMeal = [...meals]
    .reverse()
    .find((meal) => meal.meal_type === "lunch" || meal.meal_type === "dinner" || meal.meal_type === "snack")
  if (postMeal) {
    postMeal.time = toTime(postTime)
  }

  const intraMeal = meals.find((meal) => meal.meal_type === "intra")
  if (intraMeal) {
    intraMeal.time = toTime(intraTime)
  }
}

function buildMealTargets({
  templates,
  dailyTargets,
  intraCarbs,
  intraTime,
}: {
  templates: ReturnType<typeof buildMealTemplates>
  dailyTargets: DayPlan["daily_targets"]
  intraCarbs: number
  intraTime: string | null
}) {
  const intraKcal = intraCarbs * 4
  const remainingKcal = Math.max(dailyTargets.kcal - intraKcal, 0)
  const remainingCarbs = Math.max(dailyTargets.carbs_g - intraCarbs, 0)

  const baseMeals = templates.map((template) => ({
    slot: template.slot,
    meal_type: template.meal_type,
    time: template.time,
    emoji: template.emoji,
    target_macros: {
      kcal: Math.round((remainingKcal * template.target_kcal_pct) / 100),
      protein_g: Math.round((dailyTargets.protein_g * template.target_kcal_pct) / 100),
      fat_g: Math.round((dailyTargets.fat_g * template.target_kcal_pct) / 100),
      carbs_g: 0,
    },
  }))

  baseMeals.forEach((meal) => {
    const remaining = meal.target_macros.kcal - meal.target_macros.protein_g * 4 - meal.target_macros.fat_g * 9
    meal.target_macros.carbs_g = Math.max(0, Math.round(remaining / 4))
  })

  const macrosTotal = baseMeals.reduce(
    (acc, meal) => {
      acc.kcal += meal.target_macros.kcal
      acc.protein_g += meal.target_macros.protein_g
      acc.carbs_g += meal.target_macros.carbs_g
      acc.fat_g += meal.target_macros.fat_g
      return acc
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  )

  const lastMeal = baseMeals[baseMeals.length - 1]
  if (lastMeal) {
    lastMeal.target_macros.kcal += remainingKcal - macrosTotal.kcal
    lastMeal.target_macros.protein_g += dailyTargets.protein_g - macrosTotal.protein_g
    lastMeal.target_macros.carbs_g += remainingCarbs - macrosTotal.carbs_g
    lastMeal.target_macros.fat_g += dailyTargets.fat_g - macrosTotal.fat_g
  }

  if (intraCarbs > 0 && intraTime) {
    baseMeals.push({
      slot: baseMeals.length + 1,
      meal_type: "intra",
      time: intraTime,
      emoji: "⚡️",
      target_macros: {
        kcal: intraKcal,
        protein_g: 0,
        carbs_g: intraCarbs,
        fat_g: 0,
      },
    })
  }

  return baseMeals
}

export function buildWeeklyPlan({ start, end, profile, workouts }: WeeklyPlannerInput): DayPlan[] {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  const days: DayPlan[] = []
  const workoutMap = new Map<string, WorkoutWithTiming[]>()
  workouts.forEach((workout) => {
    if (!workoutMap.has(workout.workout_day)) {
      workoutMap.set(workout.workout_day, [])
    }
    workoutMap.get(workout.workout_day)?.push(workout)
  })

  for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const dateKey = cursor.toISOString().split("T")[0]
    const dayWorkouts = workoutMap.get(dateKey) ?? []
    const dayType = computeDayType(dayWorkouts)
    const dailyTargets = computeDailyTargets(profile.weight_kg, dayType, dayWorkouts)
    const templates = buildMealTemplates(profile.meals_per_day)

    const primaryWorkout = dayWorkouts.reduce<WorkoutWithTiming | null>((current, workout) => {
      if (!current) return workout
      const currentDuration = (current.actual_hours ?? current.planned_hours ?? 0) * 60
      const workoutDuration = (workout.actual_hours ?? workout.planned_hours ?? 0) * 60
      return workoutDuration > currentDuration ? workout : current
    }, null)

    const durationHours = primaryWorkout ? (primaryWorkout.actual_hours ?? primaryWorkout.planned_hours ?? 0) : 0
    const intraCarbs = dailyTargets.intra_cho_g_per_h > 0 && durationHours > 0
      ? Math.round(dailyTargets.intra_cho_g_per_h * durationHours)
      : 0
    const intraTime = primaryWorkout?.start_time
      ? toTime(roundToNearest(toMinutes(primaryWorkout.start_time) + Math.round(durationHours * 60 * 0.5)))
      : null

    let meals = buildMealTargets({
      templates,
      dailyTargets,
      intraCarbs,
      intraTime,
    })

    if (primaryWorkout?.start_time) {
      adjustForWorkoutTiming(meals, {
        start_time: primaryWorkout.start_time,
        duration_hours: durationHours,
      })
    }

    meals = ensureTimeGaps(meals)
    meals = meals
      .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))
      .map((meal, index) => ({ ...meal, slot: index + 1 }))

    days.push({
      date: dateKey,
      day_type: dayType,
      daily_targets: dailyTargets,
      meals,
    })
  }

  return days
}
