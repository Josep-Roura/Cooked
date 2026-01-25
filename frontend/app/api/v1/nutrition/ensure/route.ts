import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import type { Meal, NutritionDayType, NutritionMacros } from "@/lib/db/types"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 62

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function parseDate(value: string) {
  if (!DATE_REGEX.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function buildDateRange(start: string, end: string) {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return null
  if (start > end) return null
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (days > MAX_RANGE_DAYS) return null
  return { start, end, startDate, endDate, days }
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0]
}

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function formatMinutes(totalMinutes: number) {
  const minutes = (totalMinutes + 24 * 60) % (24 * 60)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`
}

type WorkoutRow = {
  workout_day: string
  start_time: string | null
  workout_type: string | null
  planned_hours: number | null
  actual_hours: number | null
  tss: number | null
  rpe: number | null
  if: number | null
}

function pickDayType(workouts: WorkoutRow[]): NutritionDayType {
  if (workouts.length === 0) return "rest"

  const totalHours = workouts.reduce((sum, workout) => sum + (workout.actual_hours ?? workout.planned_hours ?? 0), 0)
  const highIntensity = workouts.some((workout) => {
    const type = workout.workout_type?.toLowerCase() ?? ""
    return (
      (workout.tss ?? 0) >= 150 ||
      (workout.rpe ?? 0) >= 7 ||
      (workout.if ?? 0) >= 0.85 ||
      type.includes("interval") ||
      type.includes("tempo") ||
      type.includes("race") ||
      type.includes("threshold")
    )
  })

  if (highIntensity || totalHours >= 2) return "high"
  return "training"
}

function computeMacros(weightKg: number, dayType: NutritionDayType, primaryGoal: string | null, diet: string | null): NutritionMacros {
  const goal = primaryGoal?.toLowerCase() ?? ""
  const dietType = diet?.toLowerCase() ?? ""

  const baseMultiplier = dayType === "rest" ? 27 : dayType === "high" ? 34 : 30
  const goalMultiplier =
    goal.includes("lose") || goal.includes("fat") || goal.includes("cut")
      ? 0.9
      : goal.includes("gain") || goal.includes("performance") || goal.includes("build")
        ? 1.05
        : 1

  const kcalBase = clamp(Math.round(weightKg * baseMultiplier * goalMultiplier), 1600, 4500)

  const proteinPerKg = goal.includes("lose") || goal.includes("fat") || goal.includes("cut") ? 2.0 : 1.8
  const protein = Math.round(weightKg * proteinPerKg)

  const lowCarb = (dietType.includes("low") && dietType.includes("carb")) || dietType.includes("keto")
  const carbPerKg = lowCarb
    ? dayType === "rest" ? 2 : dayType === "high" ? 4 : 3
    : dayType === "rest" ? 3 : dayType === "high" ? 6 : 4.5

  let carbs = Math.round(weightKg * carbPerKg)

  let fat = Math.round((kcalBase - protein * 4 - carbs * 4) / 9)
  fat = clamp(fat, 40, 140)

  const remaining = kcalBase - protein * 4 - fat * 9
  if (remaining < 0) {
    carbs = Math.max(0, Math.round((kcalBase - protein * 4 - fat * 9) / 4))
  } else {
    carbs = Math.max(0, Math.round(remaining / 4))
  }

  return {
    kcal: kcalBase,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    intra_cho_g_per_h: 0,
  }
}

function computeIntraCho(workouts: WorkoutRow[], dayType: NutritionDayType) {
  if (dayType === "rest") return 0
  const totalHours = workouts.reduce((sum, workout) => sum + (workout.actual_hours ?? workout.planned_hours ?? 0), 0)
  const highIntensity = workouts.some((workout) => (workout.tss ?? 0) >= 150 || (workout.if ?? 0) >= 0.85)

  if (totalHours >= 2 || highIntensity) return dayType === "high" ? 90 : 60
  if (totalHours >= 1) return dayType === "high" ? 60 : 30
  return dayType === "high" ? 45 : 30
}

function defaultMealTemplates(mealsPerDay: number) {
  const clampedMeals = clamp(mealsPerDay, 3, 6)
  if (clampedMeals === 3) {
    return [
      { name: "Breakfast", time: "08:00" },
      { name: "Lunch", time: "13:00" },
      { name: "Dinner", time: "19:30" },
    ]
  }
  if (clampedMeals === 4) {
    return [
      { name: "Breakfast", time: "08:00" },
      { name: "Snack", time: "11:00" },
      { name: "Lunch", time: "14:00" },
      { name: "Dinner", time: "20:30" },
    ]
  }
  if (clampedMeals === 5) {
    return [
      { name: "Breakfast", time: "08:00" },
      { name: "Snack", time: "11:00" },
      { name: "Lunch", time: "14:00" },
      { name: "Snack", time: "17:00" },
      { name: "Dinner", time: "20:30" },
    ]
  }
  return [
    { name: "Breakfast", time: "07:30" },
    { name: "Snack", time: "10:00" },
    { name: "Lunch", time: "13:00" },
    { name: "Snack", time: "16:00" },
    { name: "Dinner", time: "19:00" },
    { name: "Snack", time: "21:30" },
  ]
}

function splitMacrosAcrossMeals(macros: NutritionMacros, meals: Array<{ name: string; time: string }>): Meal[] {
  const snackCount = meals.filter((meal) => meal.name.toLowerCase().includes("snack")).length
  const mealShares = meals.map((meal) => {
    if (snackCount === 0) {
      if (meal.name === "Breakfast") return 0.3
      if (meal.name === "Lunch") return 0.35
      if (meal.name === "Dinner") return 0.35
      return 0.0
    }
    if (meal.name === "Breakfast") return 0.25
    if (meal.name === "Lunch") return 0.3
    if (meal.name === "Dinner") return 0.3
    return 0.15 / snackCount
  })

  return meals.map((meal, index) => ({
    slot: index + 1,
    name: meal.name,
    time: meal.time,
    kcal: Math.round(macros.kcal * mealShares[index]),
    protein_g: Math.round(macros.protein_g * mealShares[index]),
    carbs_g: Math.round(macros.carbs_g * mealShares[index]),
    fat_g: Math.round(macros.fat_g * mealShares[index]),
    notes: null,
    tags: [],
  }))
}

function alignMealTimes(meals: Meal[], workouts: WorkoutRow[]) {
  if (workouts.length === 0) return meals
  const workout = workouts.find((item) => parseTimeToMinutes(item.start_time) !== null)
  if (!workout) return meals

  const workoutStart = parseTimeToMinutes(workout.start_time) ?? 0
  const durationHours = workout.actual_hours ?? workout.planned_hours ?? 0
  const preTime = formatMinutes(workoutStart - 90)
  const postTime = formatMinutes(workoutStart + Math.round(durationHours * 60) + 60)

  const updatedMeals = meals.map((meal) => ({ ...meal }))

  const snackIndex = updatedMeals.findIndex((meal) => meal.name.toLowerCase().includes("snack"))
  if (snackIndex >= 0) {
    updatedMeals[snackIndex].time = preTime
    updatedMeals[snackIndex].notes = "Pre-workout"
    updatedMeals[snackIndex].tags = ["pre-workout"]
  }

  const postMealIndex = updatedMeals.findIndex((meal) => meal.name === "Lunch")
  const fallbackIndex = postMealIndex >= 0 ? postMealIndex : updatedMeals.findIndex((meal) => meal.name === "Dinner")
  if (fallbackIndex >= 0) {
    updatedMeals[fallbackIndex].time = postTime
    updatedMeals[fallbackIndex].notes = "Post-workout"
    updatedMeals[fallbackIndex].tags = ["post-workout"]
  }

  return updatedMeals
}

type NutritionMetaEntry = {
  meals?: Meal[]
  macros?: NutritionMacros
  day_type?: NutritionDayType
  meals_per_day?: number
  updated_at?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { searchParams } = req.nextUrl
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date." }, { status: 400 })
    }

    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json({ error: `Invalid date range (YYYY-MM-DD required, max ${MAX_RANGE_DAYS} days).` }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated", details: authError?.message ?? null }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, weight_kg, meals_per_day, diet, primary_goal, meta")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found", details: profileError?.message ?? null }, { status: 404 })
    }

    const mealsPerDay = profile.meals_per_day ?? 4
    const weightKg = Number(profile.weight_kg ?? 70)

    // ✅ IMPORTANT: tu SQL tiene tp_workouts.user_id (uuid). Usamos eso.
    const { data: workouts, error: workoutError } = await supabase
      .from("tp_workouts")
      .select("workout_day, start_time, workout_type, planned_hours, actual_hours, tss, rpe, if")
      .eq("user_id", user.id)
      .gte("workout_day", range.start)
      .lte("workout_day", range.end)
      .order("workout_day", { ascending: true })

    if (workoutError) {
      return NextResponse.json({ error: "Failed to load workouts", details: workoutError.message, code: workoutError.code }, { status: 400 })
    }

    const workoutMap = new Map<string, WorkoutRow[]>()
    const workoutRows = (workouts ?? []) as WorkoutRow[]
    workoutRows.forEach((workout) => {
      const dayKey = String(workout.workout_day)
      const list = workoutMap.get(dayKey) ?? []
      list.push(workout)
      workoutMap.set(dayKey, list)
    })

    // Plan exacto por rango (lo mantengo igual que tú)
    const { data: existingPlan, error: existingPlanError } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("start_date", range.start)
      .eq("end_date", range.end)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingPlanError) {
      return NextResponse.json({ error: "Failed to load nutrition plan", details: existingPlanError.message, code: existingPlanError.code }, { status: 400 })
    }

    let planId: string | null = existingPlan?.id ?? null
    const userKey = user.email ?? user.id

    if (planId) {
      const { error: planUpdateError } = await supabase
        .from("nutrition_plans")
        .update({
          weight_kg: weightKg,
          user_key: userKey,
          source_filename: `ensure:${range.start}:${range.end}`,
        })
        .eq("id", planId)

      if (planUpdateError) {
        return NextResponse.json({ error: "Failed to update nutrition plan", details: planUpdateError.message, code: planUpdateError.code }, { status: 400 })
      }
    } else {
      const { data: plan, error: planError } = await supabase
        .from("nutrition_plans")
        .insert({
          user_id: user.id,
          user_key: userKey,
          source_filename: `ensure:${range.start}:${range.end}`,
          weight_kg: weightKg,
          start_date: range.start,
          end_date: range.end,
        })
        .select("id")
        .single()

      if (planError || !plan) {
        return NextResponse.json({ error: "Failed to create nutrition plan", details: planError?.message ?? null }, { status: 400 })
      }

      planId = plan.id
    }

    if (!planId) {
      return NextResponse.json({ error: "PlanId missing after ensure" }, { status: 500 })
    }

    // ✅ Borramos el rango y luego INSERT. Esto evita el problema del onConflict sin constraint unique.
    const { error: deleteError } = await supabase
      .from("nutrition_plan_rows")
      .delete()
      .eq("plan_id", planId)
      .gte("date", range.start)
      .lte("date", range.end)

    if (deleteError) {
      return NextResponse.json({ error: "Failed to clear existing plan rows", details: deleteError.message, code: deleteError.code }, { status: 400 })
    }

    const rowsToInsert: Array<{
      plan_id: string
      user_id: string
      date: string
      day_type: NutritionDayType
      kcal: number
      protein_g: number
      carbs_g: number
      fat_g: number
      intra_cho_g_per_h: number
    }> = []

    const metaUpdates: Record<string, NutritionMetaEntry> = {}
    const nowIso = new Date().toISOString()

    const cursor = new Date(range.startDate)
    while (cursor <= range.endDate) {
      const dateKey = formatDate(cursor)
      const dailyWorkouts = workoutMap.get(dateKey) ?? []
      const dayType = pickDayType(dailyWorkouts)

      const macros = computeMacros(weightKg, dayType, profile.primary_goal, profile.diet)
      macros.intra_cho_g_per_h = computeIntraCho(dailyWorkouts, dayType)

      const templates = defaultMealTemplates(mealsPerDay)
      const mealsWithMacros = splitMacrosAcrossMeals(macros, templates)
      const meals = alignMealTimes(mealsWithMacros, dailyWorkouts)

      rowsToInsert.push({
        plan_id: planId,
        user_id: user.id,
        date: dateKey,
        day_type: dayType,
        kcal: macros.kcal,
        protein_g: macros.protein_g,
        carbs_g: macros.carbs_g,
        fat_g: macros.fat_g,
        intra_cho_g_per_h: macros.intra_cho_g_per_h,
      })

      metaUpdates[dateKey] = {
        meals,
        macros,
        day_type: dayType,
        meals_per_day: mealsPerDay,
        updated_at: nowIso,
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase.from("nutrition_plan_rows").insert(rowsToInsert)

      if (insertError) {
        // Log completo para que veas el motivo exacto en consola
        console.error("Failed to save nutrition plan rows (insert)", insertError)
        return NextResponse.json(
          { error: "Failed to save nutrition plan rows", details: insertError.message, code: insertError.code },
          { status: 400 },
        )
      }
    }

    // Actualiza meta en profiles
    const existingMeta = (profile.meta && typeof profile.meta === "object" ? profile.meta : {}) as Record<string, unknown>
    const currentNutrition =
      existingMeta["nutrition_by_date"] && typeof existingMeta["nutrition_by_date"] === "object"
        ? (existingMeta["nutrition_by_date"] as Record<string, NutritionMetaEntry>)
        : {}

    const updatedMeta = {
      ...existingMeta,
      nutrition_by_date: {
        ...currentNutrition,
        ...metaUpdates,
      },
    }

    const { error: metaError } = await supabase.from("profiles").update({ meta: updatedMeta, updated_at: nowIso }).eq("id", user.id)

    if (metaError) {
      return NextResponse.json({ error: "Failed to update profile meta", details: metaError.message, code: metaError.code }, { status: 400 })
    }

    console.info("POST /api/v1/nutrition/ensure OK", {
      userId: user.id,
      start: range.start,
      end: range.end,
      planId,
      rows: rowsToInsert.length,
    })

    return NextResponse.json({ ok: true, planId, start: range.start, end: range.end }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/nutrition/ensure error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
