import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { weekPlanSchema } from "@/lib/ai/schemas"
import { createServerClient } from "@/lib/supabase/server"
import { generateWeeklyPlan } from "@/lib/ai/openai"
import type { WeekPlan } from "@/lib/ai/schemas"

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const payloadSchema = z.object({
  start: dateSchema,
  end: dateSchema,
  force: z.boolean().optional(),
})
const MAX_RANGE_DAYS = 62
const DEFAULT_MEALS_PER_DAY = 3

type PlanGenerateMeal = {
  slot: number
  name: string
  time?: string | null
  emoji?: string | null
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  ingredients?: Array<{ name: string; quantity?: string | number | null }>
  notes?: string | null
}

type PlanGenerateDay = {
  date: string
  meals: PlanGenerateMeal[]
  totals: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
  rationale?: string | null
}

function buildDateRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null
  }
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (days < 1 || days > MAX_RANGE_DAYS) {
    return null
  }
  return { startDate, endDate, days }
}

function workoutsByDate(workouts: { workout_day: string }[]) {
  const map = new Map<string, number>()
  workouts.forEach((workout) => {
    map.set(workout.workout_day, (map.get(workout.workout_day) ?? 0) + 1)
  })
  return map
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function pickDayType(workouts: Array<{ workout_type: string | null; tss: number | null; rpe: number | null; if: number | null }>) {
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

function computeMacros(weightKg: number, dayType: string) {
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
  }
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

function splitMacrosAcrossMeals(
  macros: { kcal: number; protein_g: number; carbs_g: number; fat_g: number },
  meals: Array<{ name: string; time: string }>,
) {
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
    ingredients: [],
    macros: {
      kcal: Math.round(macros.kcal * mealShares[index]),
      protein_g: Math.round(macros.protein_g * mealShares[index]),
      carbs_g: Math.round(macros.carbs_g * mealShares[index]),
      fat_g: Math.round(macros.fat_g * mealShares[index]),
    },
    notes: null,
  }))
}

function buildFallbackPlan({
  start,
  end,
  workouts,
  weightKg,
  mealsPerDay,
}: {
  start: string
  end: string
  workouts: Array<{ workout_day: string; workout_type: string | null; tss: number | null; rpe: number | null; if: number | null }>
  weightKg: number
  mealsPerDay: number
}): WeekPlan {
  const range = buildDateRange(start, end)
  if (!range) {
    return { start, end, days: [] }
  }
  const workoutsByDay = workouts.reduce((map, workout) => {
    if (!map.has(workout.workout_day)) {
      map.set(workout.workout_day, [])
    }
    map.get(workout.workout_day)?.push(workout)
    return map
  }, new Map<string, Array<typeof workouts[number]>>())

  const templates = defaultMealTemplates(mealsPerDay)
  const days = Array.from({ length: range.days }, (_value, index) => {
    const cursor = new Date(`${start}T00:00:00Z`)
    cursor.setUTCDate(cursor.getUTCDate() + index)
    const date = cursor.toISOString().split("T")[0]
    const dayWorkouts = workoutsByDay.get(date) ?? []
    const dayType = pickDayType(dayWorkouts)
    const macros = computeMacros(weightKg, dayType)
    const meals = splitMacrosAcrossMeals(macros, templates)
    return {
      date,
      day_type: dayType,
      macros,
      meals,
    }
  })

  return { start, end, days }
}

function buildCurrentPlan({
  start,
  end,
  meals,
  rows,
}: {
  start: string
  end: string
  meals: Array<any>
  rows: Array<any>
}): WeekPlan {
  const mealsByDate = meals.reduce((map, meal) => {
    if (!map.has(meal.date)) {
      map.set(meal.date, [])
    }
    map.get(meal.date)?.push(meal)
    return map
  }, new Map<string, any[]>())

  const rowsByDate = rows.reduce((map, row) => {
    map.set(row.date, row)
    return map
  }, new Map<string, any>())

  const days = Array.from({ length: buildDateRange(start, end)?.days ?? 0 }, (_value, index) => {
    const cursor = new Date(`${start}T00:00:00Z`)
    cursor.setUTCDate(cursor.getUTCDate() + index)
    const date = cursor.toISOString().split("T")[0]
    const dayMeals = (mealsByDate.get(date) ?? []).sort((a, b) => a.slot - b.slot)
    const row = rowsByDate.get(date)
    return {
      date,
      day_type: row?.day_type ?? "rest",
      macros: row
        ? {
            kcal: row.kcal ?? 0,
            protein_g: row.protein_g ?? 0,
            carbs_g: row.carbs_g ?? 0,
            fat_g: row.fat_g ?? 0,
          }
        : {
            kcal: 0,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
          },
      meals: dayMeals.map((meal) => ({
        slot: meal.slot,
        name: meal.name,
        time: meal.time ?? null,
        ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
        macros: meal.macros ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        notes: meal.notes ?? null,
      })),
    }
  })

  return { start, end, days }
}

function buildPlanRows(plan: WeekPlan, userId: string, planId: string, workoutMap: Map<string, number>) {
  return plan.days.map((day) => ({
    plan_id: planId,
    user_id: userId,
    date: day.date,
    day_type: day.day_type ?? (workoutMap.has(day.date) ? "training" : "rest"),
    kcal: day.macros.kcal,
    protein_g: day.macros.protein_g,
    carbs_g: day.macros.carbs_g,
    fat_g: day.macros.fat_g,
    intra_cho_g_per_h: 0,
  }))
}

function buildNutritionMealRows({
  plan,
  userId,
  existingMeals,
}: {
  plan: WeekPlan
  userId: string
  existingMeals: Map<string, { eaten: boolean; eaten_at: string | null }>
}) {
  return plan.days.flatMap((day) =>
    day.meals.map((meal) => {
      const existing = existingMeals.get(`${day.date}:${meal.slot}`)
      return {
        user_id: userId,
        date: day.date,
        slot: meal.slot,
        name: meal.name,
        time: meal.time ?? null,
        ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
        kcal: meal.macros.kcal,
        protein_g: meal.macros.protein_g,
        carbs_g: meal.macros.carbs_g,
        fat_g: meal.macros.fat_g,
        eaten: existing?.eaten ?? false,
        eaten_at: existing?.eaten_at ?? null,
      }
    }),
  )
}

function coerceNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return fallback
}

function normalizeMacros(
  raw: unknown,
  fallback: { kcal: number; protein_g: number; carbs_g: number; fat_g: number },
) {
  if (raw && typeof raw === "object") {
    const macros = raw as Record<string, unknown>
    return {
      kcal: Math.round(coerceNumber(macros.kcal, fallback.kcal)),
      protein_g: Math.round(coerceNumber(macros.protein_g, fallback.protein_g)),
      carbs_g: Math.round(coerceNumber(macros.carbs_g, fallback.carbs_g)),
      fat_g: Math.round(coerceNumber(macros.fat_g, fallback.fat_g)),
    }
  }
  return fallback
}

function normalizeIngredients(raw: unknown, fallback: Array<{ name: string; quantity?: string | number | null }>) {
  if (!Array.isArray(raw)) return fallback
  return raw
    .map((ingredient) => {
      if (!ingredient || typeof ingredient !== "object") return null
      const data = ingredient as Record<string, unknown>
      const name = typeof data.name === "string" ? data.name.trim() : ""
      if (!name) return null
      const quantity =
        typeof data.quantity === "string" || typeof data.quantity === "number"
          ? data.quantity
          : typeof data.amount_g === "number"
            ? data.amount_g
            : null
      return { name, quantity }
    })
    .filter((ingredient): ingredient is { name: string; quantity?: string | number | null } => Boolean(ingredient))
}

function normalizeMeal(
  raw: unknown,
  fallback: { slot: number; name: string; time?: string | null; ingredients: any[]; macros: any; notes?: string | null },
  index: number,
) {
  const base = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const slot = Math.max(1, Math.round(coerceNumber(base.slot, fallback.slot ?? index + 1)))
  const name = typeof base.name === "string" && base.name.trim() ? base.name.trim() : fallback.name
  const time = typeof base.time === "string" ? base.time : fallback.time ?? null
  const rawMacros =
    base.macros && typeof base.macros === "object"
      ? base.macros
      : {
          kcal: base.kcal,
          protein_g: base.protein_g,
          carbs_g: base.carbs_g,
          fat_g: base.fat_g,
        }
  const macros = normalizeMacros(rawMacros, fallback.macros)
  const ingredients = normalizeIngredients(base.ingredients, fallback.ingredients ?? [])
  const notes = typeof base.notes === "string" ? base.notes : fallback.notes ?? null

  return {
    slot,
    name,
    time,
    ingredients,
    macros,
    notes,
  }
}

function normalizeWeekPlan({
  rawPlan,
  fallbackPlan,
  start,
  end,
}: {
  rawPlan: WeekPlan | null
  fallbackPlan: WeekPlan
  start: string
  end: string
}) {
  const range = buildDateRange(start, end)
  if (!range) {
    return { plan: fallbackPlan, usedFallback: true }
  }

  const rawDays = Array.isArray(rawPlan?.days) ? rawPlan?.days ?? [] : []
  const rawByDate = new Map<string, WeekPlan["days"][number]>()
  rawDays.forEach((day) => {
    if (day?.date) rawByDate.set(day.date, day)
  })

  let usedFallback = rawDays.length === 0
  const days = Array.from({ length: range.days }, (_value, index) => {
    const cursor = new Date(`${start}T00:00:00Z`)
    cursor.setUTCDate(cursor.getUTCDate() + index)
    const date = cursor.toISOString().split("T")[0]
    const fallbackDay = fallbackPlan.days[index]
    const rawDay = rawByDate.get(date)
    const dayType = rawDay?.day_type ?? fallbackDay?.day_type ?? "rest"
    const macros = normalizeMacros(rawDay?.macros, fallbackDay?.macros ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
    const rawMeals = Array.isArray(rawDay?.meals) ? rawDay?.meals ?? [] : []
    const fallbackMeals = fallbackDay?.meals ?? []
    if (!rawDay || rawMeals.length === 0) {
      usedFallback = true
    }
    const meals = (rawMeals.length > 0 ? rawMeals : fallbackMeals).map((meal, mealIndex) => {
      const fallbackMeal =
        fallbackMeals[mealIndex] ??
        fallbackMeals[0] ?? {
          slot: mealIndex + 1,
          name: "Meal",
          time: null,
          ingredients: [],
          macros,
          notes: null,
        }
      return normalizeMeal(meal, fallbackMeal, mealIndex)
    })

    return {
      date,
      day_type: dayType,
      macros,
      meals,
    }
  })

  const plan: WeekPlan = { start, end, days }
  const parsed = weekPlanSchema.safeParse(plan)
  if (!parsed.success) {
    return { plan: fallbackPlan, usedFallback: true }
  }

  return { plan: parsed.data, usedFallback }
}

function buildResponseDays(plan: WeekPlan): PlanGenerateDay[] {
  return plan.days.map((day) => ({
    date: day.date,
    meals: day.meals.map((meal) => ({
      slot: meal.slot,
      name: meal.name,
      time: meal.time ?? null,
      emoji: null,
      kcal: meal.macros.kcal,
      protein_g: meal.macros.protein_g,
      carbs_g: meal.macros.carbs_g,
      fat_g: meal.macros.fat_g,
      ingredients: meal.ingredients ?? [],
      notes: meal.notes ?? null,
    })),
    totals: {
      kcal: day.macros.kcal,
      protein_g: day.macros.protein_g,
      carbs_g: day.macros.carbs_g,
      fat_g: day.macros.fat_g,
    },
    rationale: null,
  }))
}

function inferMealType(name: string) {
  const lowered = name.toLowerCase()
  if (lowered.includes("breakfast")) return "breakfast"
  if (lowered.includes("lunch")) return "lunch"
  if (lowered.includes("dinner")) return "dinner"
  if (lowered.includes("snack")) return "snack"
  return null
}

// Quick sanity check:
// curl -X POST http://localhost:3000/api/ai/plan/generate \
//   -H "Content-Type: application/json" \
//   -d '{"start":"2026-01-26","end":"2026-02-01"}'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    console.info("POST /api/ai/plan/generate payload keys", {
      keys: body && typeof body === "object" ? Object.keys(body as Record<string, unknown>) : [],
    })
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const { start, end } = parsed.data
    console.info("POST /api/ai/plan/generate payload", { start, end })
    if (start > end) {
      return NextResponse.json(
        { ok: false, error: "Invalid date range", issues: [{ message: "start must be <= end" }] },
        { status: 400 },
      )
    }
    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json(
        { ok: false, error: "Invalid date range", issues: [{ message: "range is outside allowed bounds" }] },
        { status: 400 },
      )
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated", details: authError?.message ?? null },
        { status: 401 },
      )
    }
    console.info("POST /api/ai/plan/generate auth", { userId: user.id })

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load profile", details: profileError.message },
        { status: 400 },
      )
    }

    const { data: workouts, error: workoutError } = await supabase
      .from("tp_workouts")
      .select("workout_day, workout_type, title, start_time, planned_hours, actual_hours, tss, if, rpe")
      .eq("user_id", user.id)
      .gte("workout_day", start)
      .lte("workout_day", end)

    if (workoutError) {
      return NextResponse.json(
        { ok: false, error: "Failed to load workouts", details: workoutError.message },
        { status: 400 },
      )
    }

    console.info("POST /api/ai/plan/generate", {
      userId: user.id,
      start,
      end,
      workoutCount: workouts?.length ?? 0,
    })

    const [{ data: existingMeals }, { data: existingRows }] = await Promise.all([
      supabase
        .from("nutrition_meals")
        .select("date, slot, eaten, eaten_at, ingredients, name, time, kcal, protein_g, carbs_g, fat_g, recipe")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("nutrition_plan_rows")
        .select("date, day_type, kcal, protein_g, carbs_g, fat_g")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
    ])

    const existingMealsMap = (existingMeals ?? []).reduce((map, meal) => {
      map.set(`${meal.date}:${meal.slot}`, { eaten: meal.eaten ?? false, eaten_at: meal.eaten_at ?? null })
      return map
    }, new Map<string, { eaten: boolean; eaten_at: string | null }>())

    const normalizedExistingMeals = (existingMeals ?? []).map((meal) => ({
      ...meal,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
      macros: {
        kcal: meal.kcal ?? 0,
        protein_g: meal.protein_g ?? 0,
        carbs_g: meal.carbs_g ?? 0,
        fat_g: meal.fat_g ?? 0,
      },
    }))

    const currentPlan = buildCurrentPlan({
      start,
      end,
      meals: normalizedExistingMeals,
      rows: existingRows ?? [],
    })

    let usedFallback = false
    let rawPlan: WeekPlan | null = null

    const fallbackPlan = buildFallbackPlan({
      start,
      end,
      workouts: (workouts ?? []).map((workout) => ({
        workout_day: workout.workout_day,
        workout_type: workout.workout_type ?? null,
        tss: workout.tss ?? null,
        rpe: workout.rpe ?? null,
        if: workout.if ?? null,
      })),
      weightKg: profile?.weight_kg ?? 70,
      mealsPerDay: profile?.meals_per_day ?? DEFAULT_MEALS_PER_DAY,
    })

    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
    const aiStartedAt = Date.now()
    try {
      rawPlan = await generateWeeklyPlan({
        start,
        end,
        profile: profile ?? {},
        workouts: workouts ?? [],
        currentPlan,
      })
      console.info("[AI] weekly plan generated", {
        userId: user.id,
        model,
        latencyMs: Date.now() - aiStartedAt,
      })
    } catch (error) {
      usedFallback = true
      console.warn("AI plan generation failed, using fallback plan.", {
        userId: user.id,
        start,
        end,
        model,
        latencyMs: Date.now() - aiStartedAt,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const normalized = normalizeWeekPlan({
      rawPlan,
      fallbackPlan,
      start,
      end,
    })
    usedFallback = usedFallback || normalized.usedFallback
    const plan = normalized.plan

    const { data: existingPlan } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("start_date", start)
      .eq("end_date", end)
      .maybeSingle()

    let planId = existingPlan?.id ?? null

    if (!planId) {
      const { data: created, error: createError } = await supabase
        .from("nutrition_plans")
        .insert({
          user_id: user.id,
          user_key: user.id,
          source_filename: "ai",
          weight_kg: profile?.weight_kg ?? 0,
          start_date: start,
          end_date: end,
        })
        .select("id")
        .single()

      if (createError || !created) {
        return NextResponse.json(
          { ok: false, error: "Failed to create nutrition plan", details: createError?.message ?? null },
          { status: 400 },
        )
      }
      planId = created.id
    }

    const workoutMap = workoutsByDate(workouts ?? [])
    const planRows = buildPlanRows(plan, user.id, planId, workoutMap)
    const mealRows = buildNutritionMealRows({ plan, userId: user.id, existingMeals: existingMealsMap })

    const { error: rowError } = await supabase
      .from("nutrition_plan_rows")
      .upsert(planRows, { onConflict: "user_id,date" })

    if (rowError) {
      console.error("Failed to save plan rows", rowError)
      return NextResponse.json(
        { ok: false, error: "Failed to save plan rows", details: rowError.message },
        { status: 400 },
      )
    }

    const { error: mealError } = await supabase
      .from("nutrition_meals")
      .upsert(mealRows, { onConflict: "user_id,date,slot" })

    if (mealError) {
      console.error("Failed to save meals", mealError)
      return NextResponse.json(
        { ok: false, error: "Failed to save meals", details: mealError.message },
        { status: 400 },
      )
    }

    for (const day of plan.days) {
      const { data: planRow, error: planRowError } = await supabase
        .from("meal_plans")
        .upsert(
          {
            user_id: user.id,
            date: day.date,
            target_kcal: day.macros.kcal,
            target_protein_g: day.macros.protein_g,
            target_carbs_g: day.macros.carbs_g,
            target_fat_g: day.macros.fat_g,
            training_day_type: day.day_type ?? null,
            status: "generated",
            locked: false,
          },
          { onConflict: "user_id,date" },
        )
        .select("id")
        .single()

      if (planRowError || !planRow) {
        console.error("Failed to save meal plan", planRowError)
        return NextResponse.json(
          { ok: false, error: "Failed to save meal plan", details: planRowError?.message ?? null },
          { status: 400 },
        )
      }

      const { data: existingItems } = await supabase
        .from("meal_plan_items")
        .select("id")
        .eq("meal_plan_id", planRow.id)
      const existingIds = (existingItems ?? []).map((item) => item.id)
      if (existingIds.length > 0) {
        await supabase.from("meal_plan_ingredients").delete().in("meal_item_id", existingIds)
      }
      await supabase.from("meal_plan_items").delete().eq("meal_plan_id", planRow.id)

      const items = day.meals.map((meal, index) => ({
        meal_plan_id: planRow.id,
        slot: meal.slot,
        meal_type: inferMealType(meal.name),
        sort_order: index + 1,
        name: meal.name,
        time: meal.time ?? null,
        emoji: null,
        kcal: meal.macros.kcal,
        protein_g: meal.macros.protein_g,
        carbs_g: meal.macros.carbs_g,
        fat_g: meal.macros.fat_g,
        eaten: false,
        notes: meal.notes ?? null,
        recipe_id: null,
      }))

      if (items.length > 0) {
        const { data: insertedItems, error: itemError } = await supabase
          .from("meal_plan_items")
          .insert(items)
          .select("id, slot")
        if (itemError || !insertedItems) {
          console.error("Failed to save meal plan items", itemError)
          return NextResponse.json(
            { ok: false, error: "Failed to save meal plan items", details: itemError?.message ?? null },
            { status: 400 },
          )
        }

        const ingredientRows = insertedItems.flatMap((item) => {
          const meal = day.meals.find((entry) => entry.slot === item.slot)
          const ingredients = Array.isArray(meal?.ingredients) ? meal?.ingredients ?? [] : []
          return ingredients
            .map((ingredient) => {
              if (!ingredient || typeof ingredient !== "object") return null
              const data = ingredient as Record<string, unknown>
              const name = typeof data.name === "string" ? data.name.trim() : ""
              if (!name) return null
              const quantity =
                typeof data.quantity === "string" || typeof data.quantity === "number"
                  ? String(data.quantity)
                  : null
              return {
                meal_item_id: item.id,
                name,
                quantity,
                checked: false,
              }
            })
            .filter((row): row is { meal_item_id: string; name: string; quantity: string | null; checked: boolean } =>
              Boolean(row),
            )
        })

        if (ingredientRows.length > 0) {
          const { error: ingredientError } = await supabase.from("meal_plan_ingredients").insert(ingredientRows)
          if (ingredientError) {
            console.error("Failed to save meal plan ingredients", ingredientError)
            return NextResponse.json(
              { ok: false, error: "Failed to save meal plan ingredients", details: ingredientError.message },
              { status: 400 },
            )
          }
        }
      }
    }

    const { error: revisionError } = await supabase.from("plan_revisions").insert({
      user_id: user.id,
      week_start: start,
      week_end: end,
      diff: { generated: true, start, end },
    })

    if (revisionError) {
      const isMissingTable =
        revisionError.code === "42P01" || /relation .*plan_revisions.* does not exist/i.test(revisionError.message)
      if (!isMissingTable) {
        console.error("Failed to save revision", revisionError)
      }
      console.warn("Skipping plan_revisions insert due to missing table.", {
        userId: user.id,
        start,
        end,
      })
    }

    return NextResponse.json(
      {
        ok: true,
        usedFallback,
        start,
        end,
        days: buildResponseDays(plan),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("POST /api/ai/plan/generate error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
