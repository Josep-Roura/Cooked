import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { generateWeeklyPlan } from "@/lib/ai/openai"
import type { WeeklyPlan } from "@/lib/ai/schemas"

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const payloadSchema = z.union([
  z.object({ weekStart: dateSchema, weekEnd: dateSchema }),
  z.object({ date: dateSchema }),
])

function getRange(payload: z.infer<typeof payloadSchema>) {
  if ("date" in payload) {
    return { weekStart: payload.date, weekEnd: payload.date }
  }
  return { weekStart: payload.weekStart, weekEnd: payload.weekEnd }
}

function workoutsByDate(workouts: { workout_day: string }[]) {
  const map = new Map<string, number>()
  workouts.forEach((workout) => {
    map.set(workout.workout_day, (map.get(workout.workout_day) ?? 0) + 1)
  })
  return map
}

function buildPlanRows(plan: WeeklyPlan, userId: string, planId: string, workoutMap: Map<string, number>) {
  return plan.days.map((day) => ({
    plan_id: planId,
    user_id: userId,
    date: day.date,
    day_type: workoutMap.has(day.date) ? "training" : "rest",
    kcal: day.totals.kcal,
    protein_g: day.totals.protein_g,
    carbs_g: day.totals.carbs_g,
    fat_g: day.totals.fat_g,
    intra_cho_g_per_h: 0,
  }))
}

function buildMealRows(plan: WeeklyPlan, userId: string) {
  return plan.days.flatMap((day) =>
    day.meals.map((meal) => ({
      user_id: userId,
      date: day.date,
      slot: meal.slot,
      name: meal.name,
      time: meal.time ?? null,
      kcal: meal.macros.kcal,
      protein_g: meal.macros.protein_g,
      carbs_g: meal.macros.carbs_g,
      fat_g: meal.macros.fat_g,
      ingredients: meal.ingredients,
      recipe: meal.recipe ?? null,
      eaten: false,
      eaten_at: null,
    })),
  )
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { weekStart, weekEnd } = getRange(parsed.data)
    if (weekStart > weekEnd) {
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
      .gte("workout_day", weekStart)
      .lte("workout_day", weekEnd)

    if (workoutError) {
      return NextResponse.json({ error: "Failed to load workouts", details: workoutError.message }, { status: 400 })
    }

    const plan = await generateWeeklyPlan({
      weekStart,
      weekEnd,
      profile: profile ?? {},
      workouts: workouts ?? [],
    })

    const { data: existingPlan } = await supabase
      .from("nutrition_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("start_date", weekStart)
      .eq("end_date", weekEnd)
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
          start_date: weekStart,
          end_date: weekEnd,
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
    const mealRows = buildMealRows(plan, user.id)

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
      week_start: weekStart,
      week_end: weekEnd,
      diff: {},
    })

    if (revisionError) {
      return NextResponse.json({ error: "Failed to save revision", details: revisionError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, plan }, { status: 200 })
  } catch (error) {
    console.error("POST /api/ai/plan/generate error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
