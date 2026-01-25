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

function pickDayType(workouts: Array<{ workout_type: string | null; tss: number | null; rpe: number | null; if: number | null }>): NutritionDayType {
  if (workouts.length === 0) return "rest"
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

  return highIntensity ? "high" : "training"
}

function computeMacros(weightKg: number, dayType: NutritionDayType): NutritionMacros {
  const kcalBase = Math.round(weightKg * (dayType === "rest" ? 27 : dayType === "high" ? 34 : 30))
  const protein = Math.round(weightKg * 1.8)
  const fat = clamp(Math.round(weightKg * 0.9), 40, 120)
  const remaining = kcalBase - protein * 4 - fat * 9
  const carbs = Math.max(0, Math.round(remaining / 4))

  return {
    kcal: kcalBase,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    intra_cho_g_per_h: 0,
  }
}

function computeIntraCho(
  workouts: Array<{ workout_type: string | null; actual_hours: number | null; planned_hours: number | null }>,
  dayType: NutritionDayType,
) {
  if (dayType === "rest") return 0
  const longSession = workouts.some((workout) => {
    const duration = workout.actual_hours ?? workout.planned_hours ?? 0
    const type = workout.workout_type?.toLowerCase() ?? ""
    return duration >= 1.5 && (type.includes("bike") || type.includes("run"))
  })

  if (longSession) {
    return dayType === "high" ? 90 : 60
  }
  return dayType === "high" ? 60 : 30
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

function alignMealTimes(
  meals: Meal[],
  workouts: Array<{ start_time: string | null; actual_hours: number | null; planned_hours: number | null }>,
) {
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const start = (body as { start?: string }).start
    const end = (body as { end?: string }).end
    const regenerate = Boolean((body as { regenerate?: boolean }).regenerate)

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end date." }, { status: 400 })
    }

    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json(
        { error: `Invalid date range (YYYY-MM-DD required, max ${MAX_RANGE_DAYS} days).` },
        { status: 400 },
      )
    }

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, weight_kg, meals_per_day, diet, units, meta")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found", details: profileError?.message ?? null },
        { status: 404 },
      )
    }

    const mealsPerDay = profile.meals_per_day ?? 4
    const weightKg = profile.weight_kg ?? 70

    const { data: workouts, error: workoutError } = await supabase
      .from("tp_workouts")
      .select("workout_day, start_time, workout_type, planned_hours, actual_hours, tss, rpe, if")
      .eq("athlete_id", `user:${user.id}`)
      .gte("workout_day", range.start)
      .lte("workout_day", range.end)
      .order("workout_day", { ascending: true })

    if (workoutError) {
      return NextResponse.json(
        { error: "Failed to load workouts", details: workoutError.message, code: workoutError.code },
        { status: 400 },
      )
    }

    const workoutMap = new Map<string, WorkoutRow[]>()
    ;(workouts ?? []).forEach((workout) => {
      const dayKey = workout.workout_day
      const list = workoutMap.get(dayKey) ?? []
      list.push(workout)
      workoutMap.set(dayKey, list)
    })

    const { data: plan, error: planError } = await supabase
      .from("nutrition_plans")
      .insert({
        user_id: user.id,
        user_key: user.id,
        source_filename: `generated:${range.start}:${range.end}`,
        weight_kg: weightKg,
        start_date: range.start,
        end_date: range.end,
      })
      .select("id")
      .single()

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Failed to create nutrition plan", details: planError?.message ?? null },
        { status: 400 },
      )
    }

    const { data: existingRows, error: existingRowsError } = await supabase
      .from("nutrition_plan_rows")
      .select("date")
      .eq("plan_id", plan.id)
      .gte("date", range.start)
      .lte("date", range.end)

    if (existingRowsError) {
      return NextResponse.json(
        { error: "Failed to check existing plans", details: existingRowsError.message, code: existingRowsError.code },
        { status: 400 },
      )
    }

    const existingDates = new Set((existingRows ?? []).map((row) => row.date))
    const generatedDates: string[] = []
    const skippedDates: string[] = []
    const rowsToInsert: Array<{
      plan_id: string
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

    if (regenerate && existingDates.size > 0) {
      const { error: deleteError } = await supabase
        .from("nutrition_plan_rows")
        .delete()
        .eq("plan_id", plan.id)
        .gte("date", range.start)
        .lte("date", range.end)

      if (deleteError) {
        return NextResponse.json(
          { error: "Failed to clear existing plan rows", details: deleteError.message, code: deleteError.code },
          { status: 400 },
        )
      }
    }

    const cursor = new Date(range.startDate)
    while (cursor <= range.endDate) {
      const dateKey = formatDate(cursor)
      if (!regenerate && existingDates.has(dateKey)) {
        skippedDates.push(dateKey)
        cursor.setUTCDate(cursor.getUTCDate() + 1)
        continue
      }

      const dailyWorkouts = workoutMap.get(dateKey) ?? []
      const dayType = pickDayType(dailyWorkouts)
      const macros = computeMacros(weightKg, dayType)
      macros.intra_cho_g_per_h = computeIntraCho(dailyWorkouts, dayType)

      const templates = defaultMealTemplates(mealsPerDay)
      const mealsWithMacros = splitMacrosAcrossMeals(macros, templates)
      const meals = alignMealTimes(mealsWithMacros, dailyWorkouts)

      rowsToInsert.push({
        plan_id: plan.id,
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

      generatedDates.push(dateKey)
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase.from("nutrition_plan_rows").insert(rowsToInsert)
      if (insertError) {
        return NextResponse.json(
          { error: "Failed to save nutrition plan rows", details: insertError.message, code: insertError.code },
          { status: 400 },
        )
      }
    }

    if (Object.keys(metaUpdates).length > 0) {
      const existingMeta = (profile.meta && typeof profile.meta === "object" ? profile.meta : {}) as Record<
        string,
        unknown
      >
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

      const { error: metaError } = await supabase
        .from("profiles")
        .update({ meta: updatedMeta, updated_at: nowIso })
        .eq("id", user.id)

      if (metaError) {
        return NextResponse.json(
          { error: "Failed to update profile meta", details: metaError.message, code: metaError.code },
          { status: 400 },
        )
      }
    }

    console.info("POST /api/v1/nutrition/generate-range", {
      userId: user.id,
      start: range.start,
      end: range.end,
      generated: generatedDates.length,
      skipped: skippedDates.length,
      regenerate,
    })

    return NextResponse.json(
      {
        ok: true,
        plan_id: plan.id,
        start: range.start,
        end: range.end,
        generated_dates: generatedDates,
        skipped_dates: skippedDates,
        count_generated: generatedDates.length,
        count_skipped: skippedDates.length,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("POST /api/v1/nutrition/generate-range error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
