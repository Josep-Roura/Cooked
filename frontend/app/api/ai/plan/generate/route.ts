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
  workoutCount: z.number().optional(),
  force: z.boolean().optional(),
})
const aiResponseSchema = z.object({
  days: z.array(z.unknown()),
  rationale: z.string().optional(),
})
const MAX_RANGE_DAYS = 62
const DEFAULT_MEALS_PER_DAY = 3

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

function buildMealRows({
  plan,
  userId,
  planId,
  existingMeals,
}: {
  plan: WeekPlan
  userId: string
  planId: string
  existingMeals: Map<string, { eaten: boolean; eaten_at: string | null }>
}) {
  return plan.days.flatMap((day) =>
    day.meals.map((meal) => {
      const existing = existingMeals.get(`${day.date}:${meal.slot}`)
      return {
        user_id: userId,
        plan_id: planId,
        date: day.date,
        slot: meal.slot,
        name: meal.name,
        time: meal.time ?? null,
        ingredients: meal.ingredients,
        kcal: meal.macros.kcal,
        protein_g: meal.macros.protein_g,
        carbs_g: meal.macros.carbs_g,
        fat_g: meal.macros.fat_g,
        eaten: existing?.eaten ?? false,
        eaten_at: existing?.eaten_at ?? null,
        notes: meal.notes ?? null,
      }
    }),
  )
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
        { error: "Not authenticated", details: authError?.message ?? null },
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
      return NextResponse.json({ error: "Failed to load profile", details: profileError.message }, { status: 400 })
    }

    const { data: workouts, error: workoutError } = await supabase
      .from("tp_workouts")
      .select("workout_day, workout_type, title, start_time, planned_hours, actual_hours, tss, if, rpe")
      .eq("user_id", user.id)
      .gte("workout_day", start)
      .lte("workout_day", end)

    if (workoutError) {
      return NextResponse.json({ error: "Failed to load workouts", details: workoutError.message }, { status: 400 })
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
        .select("date, slot, eaten, eaten_at, ingredients, name, time, notes, kcal, protein_g, carbs_g, fat_g, recipe")
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

    let plan: WeekPlan
    let usedFallback = false

    try {
      plan = await generateWeeklyPlan({
        start,
        end,
        profile: profile ?? {},
        workouts: workouts ?? [],
        currentPlan,
      })
      const aiParsed = aiResponseSchema.safeParse(plan)
      if (!aiParsed.success) {
        throw new Error("AI response missing required days")
      }
      weekPlanSchema.parse(plan)
    } catch (error) {
      usedFallback = true
      console.warn("AI plan generation failed, using fallback plan.", {
        userId: user.id,
        start,
        end,
        error: error instanceof Error ? error.message : String(error),
      })
      plan = buildFallbackPlan({
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
    }

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
          { error: "Failed to create nutrition plan", details: createError?.message ?? null },
          { status: 400 },
        )
      }
      planId = created.id
    }

    const workoutMap = workoutsByDate(workouts ?? [])
    const planRows = buildPlanRows(plan, user.id, planId, workoutMap)
    const mealRows = buildMealRows({ plan, userId: user.id, planId, existingMeals: existingMealsMap })

    const { error: rowError } = await supabase
      .from("nutrition_plan_rows")
      .upsert(planRows, { onConflict: "user_id,date" })

    if (rowError) {
      console.error("Failed to save plan rows", rowError)
      return NextResponse.json({ error: "Failed to save plan rows", details: rowError.message }, { status: 400 })
    }

    const mealRowsWithPlan = mealRows.map((meal) => ({
      ...meal,
      plan_id: planId,
      macros: {
        kcal: meal.kcal,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
      },
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
      eaten: meal.eaten ?? false,
    }))
    const mealRowsWithoutPlan = mealRows.map(({ plan_id: _planId, ...meal }) => meal)

    let { error: mealError } = await supabase
      .from("nutrition_meals")
      .upsert(mealRowsWithPlan, { onConflict: "user_id,date,slot" })

    if (mealError) {
      const isMissingColumn =
        mealError.code === "42703" ||
        mealError.code === "PGRST204" ||
        /column "(plan_id|macros)"/i.test(mealError.message) ||
        /schema cache/i.test(mealError.message)

      if (isMissingColumn) {
        ;({ error: mealError } = await supabase
          .from("nutrition_meals")
          .upsert(mealRowsWithoutPlan, { onConflict: "user_id,date,slot" }))
      }
    }

    if (mealError) {
      console.error("Failed to save meals", mealError)
      return NextResponse.json({ error: "Failed to save meals", details: mealError.message }, { status: 400 })
    }

    const { error: revisionError } = await supabase.from("plan_revisions").insert({
      user_id: user.id,
      plan_id: planId,
      source: "generate",
      diff: { generated: true, start, end },
    })

    if (revisionError) {
      const isMissingTable =
        revisionError.code === "42P01" || /relation .*plan_revisions.* does not exist/i.test(revisionError.message)
      if (!isMissingTable) {
        console.error("Failed to save revision", revisionError)
        return NextResponse.json({ error: "Failed to save revision", details: revisionError.message }, { status: 400 })
      }
      console.warn("Skipping plan_revisions insert due to missing table.", {
        userId: user.id,
        start,
        end,
      })
    }

    return NextResponse.json({ ok: true, planId, start, end, usedFallback }, { status: 200 })
  } catch (error) {
    console.error("POST /api/ai/plan/generate error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
