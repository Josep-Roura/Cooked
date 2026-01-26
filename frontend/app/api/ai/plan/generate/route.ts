import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { generateWeeklyPlan } from "@/lib/ai/openai"
import type { WeekPlan } from "@/lib/ai/schemas"

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const payloadSchema = z.object({ start: dateSchema, end: dateSchema, force: z.boolean().optional() })
const MAX_RANGE_DAYS = 62

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
        macros: meal.macros,
        eaten: existing?.eaten ?? false,
        eaten_at: existing?.eaten_at ?? null,
        notes: meal.notes ?? null,
      }
    }),
  )
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { start, end } = parsed.data
    if (start > end) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }
    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
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

    const [{ data: existingMeals }, { data: existingRows }] = await Promise.all([
      supabase
        .from("nutrition_meals")
        .select("date, slot, eaten, eaten_at, macros, ingredients, name, time, notes")
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

    const currentPlan = buildCurrentPlan({
      start,
      end,
      meals: existingMeals ?? [],
      rows: existingRows ?? [],
    })

    const plan = await generateWeeklyPlan({
      start,
      end,
      profile: profile ?? {},
      workouts: workouts ?? [],
      currentPlan,
    })

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
      return NextResponse.json({ error: "Failed to save plan rows", details: rowError.message }, { status: 400 })
    }

    const { error: mealError } = await supabase
      .from("nutrition_meals")
      .upsert(mealRows, { onConflict: "user_id,date,slot" })

    if (mealError) {
      return NextResponse.json({ error: "Failed to save meals", details: mealError.message }, { status: 400 })
    }

    const { error: revisionError } = await supabase.from("plan_revisions").insert({
      user_id: user.id,
      plan_id: planId,
      source: "generate",
      diff: { generated: true, start, end },
    })

    if (revisionError) {
      return NextResponse.json({ error: "Failed to save revision", details: revisionError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, planId, start, end }, { status: 200 })
  } catch (error) {
    console.error("POST /api/ai/plan/generate error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
