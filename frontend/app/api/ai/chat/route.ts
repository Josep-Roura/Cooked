import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { applyPlanEdits } from "@/lib/ai/openai"
import type { WeeklyPlan } from "@/lib/ai/schemas"

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const postSchema = z.object({
  threadId: z.string().uuid().optional(),
  weekStart: dateSchema,
  weekEnd: dateSchema,
  message: z.string().min(1),
})

function buildDays(start: string, end: string) {
  const days: string[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  while (cursor <= endDate) {
    days.push(cursor.toISOString().split("T")[0])
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

function buildWeeklyPlan({
  weekStart,
  weekEnd,
  meals,
  rows,
}: {
  weekStart: string
  weekEnd: string
  meals: Array<any>
  rows: Array<any>
}): WeeklyPlan {
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

  const days = buildDays(weekStart, weekEnd).map((date) => {
    const dayMeals = (mealsByDate.get(date) ?? []).sort((a, b) => a.slot - b.slot)
    const totals = rowsByDate.get(date)
    const macroTotals = totals
      ? {
          kcal: totals.kcal ?? 0,
          protein_g: totals.protein_g ?? 0,
          carbs_g: totals.carbs_g ?? 0,
          fat_g: totals.fat_g ?? 0,
        }
      : dayMeals.reduce(
          (acc, meal) => {
            acc.kcal += meal.kcal ?? 0
            acc.protein_g += meal.protein_g ?? 0
            acc.carbs_g += meal.carbs_g ?? 0
            acc.fat_g += meal.fat_g ?? 0
            return acc
          },
          { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
        )

    return {
      date,
      meals: dayMeals.map((meal) => ({
        slot: meal.slot,
        name: meal.name,
        time: meal.time ?? null,
        macros: {
          kcal: meal.kcal ?? 0,
          protein_g: meal.protein_g ?? 0,
          carbs_g: meal.carbs_g ?? 0,
          fat_g: meal.fat_g ?? 0,
        },
        ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
        recipe: meal.recipe ?? null,
      })),
      totals: macroTotals,
    }
  })

  return { week_start: weekStart, week_end: weekEnd, days }
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const weekStart = searchParams.get("weekStart") ?? ""
    const weekEnd = searchParams.get("weekEnd") ?? ""

    if (!dateSchema.safeParse(weekStart).success || !dateSchema.safeParse(weekEnd).success) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }
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

    const { data: thread } = await supabase
      .from("ai_threads")
      .select("*")
      .eq("user_id", user.id)
      .eq("context->>week_start", weekStart)
      .eq("context->>week_end", weekEnd)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!thread) {
      return NextResponse.json({ thread: null, messages: [] }, { status: 200 })
    }

    const { data: messages } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true })

    const formattedMessages = (messages ?? []).map((message) => {
      const content = typeof message.content === "object" && message.content && "text" in message.content
        ? String(message.content.text)
        : JSON.stringify(message.content)
      return {
        id: message.id,
        thread_id: message.thread_id,
        user_id: message.user_id,
        role: message.role === "tool" ? "assistant" : message.role,
        content,
        meta: null,
        created_at: message.created_at,
      }
    })

    return NextResponse.json(
      {
        thread: {
          id: thread.id,
          user_id: thread.user_id,
          week_start_date: thread.context?.week_start ?? weekStart,
          title: null,
          created_at: thread.created_at,
          updated_at: thread.updated_at,
        },
        messages: formattedMessages,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("GET /api/ai/chat error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = postSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { threadId, weekStart, weekEnd, message } = parsed.data
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

    let thread = null
    if (threadId) {
      const { data: existing } = await supabase
        .from("ai_threads")
        .select("*")
        .eq("id", threadId)
        .eq("user_id", user.id)
        .maybeSingle()
      thread = existing
    } else {
      const { data: existing } = await supabase
        .from("ai_threads")
        .select("*")
        .eq("user_id", user.id)
        .eq("context->>week_start", weekStart)
        .eq("context->>week_end", weekEnd)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      thread = existing
    }

    if (!thread) {
      const { data: created, error: createError } = await supabase
        .from("ai_threads")
        .insert({ user_id: user.id, context: { week_start: weekStart, week_end: weekEnd } })
        .select("*")
        .single()

      if (createError || !created) {
        return NextResponse.json(
          { error: "Failed to create chat thread", details: createError?.message ?? null },
          { status: 400 },
        )
      }
      thread = created
    }

    const { error: userMessageError } = await supabase.from("ai_messages").insert({
      thread_id: thread.id,
      user_id: user.id,
      role: "user",
      content: { text: message },
    })

    if (userMessageError) {
      return NextResponse.json({ error: "Failed to save message", details: userMessageError.message }, { status: 400 })
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: "Failed to load profile", details: profileError.message }, { status: 400 })
    }

    const [{ data: meals }, { data: rows }] = await Promise.all([
      supabase
        .from("nutrition_meals")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", weekStart)
        .lte("date", weekEnd),
      supabase
        .from("nutrition_plan_rows")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", weekStart)
        .lte("date", weekEnd),
    ])

    const currentPlan = buildWeeklyPlan({
      weekStart,
      weekEnd,
      meals: meals ?? [],
      rows: rows ?? [],
    })

    const editResponse = await applyPlanEdits({
      weekStart,
      weekEnd,
      profile: profile ?? {},
      workouts: workouts ?? [],
      currentPlan,
      message,
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
    const planRows = buildPlanRows(editResponse.updatedWeekPlan, user.id, planId, workoutMap)
    const mealRows = buildMealRows(editResponse.updatedWeekPlan, user.id)

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

    const { error: assistantError } = await supabase.from("ai_messages").insert({
      thread_id: thread.id,
      user_id: user.id,
      role: "assistant",
      content: { text: "Plan updated", payload: editResponse },
    })

    if (assistantError) {
      return NextResponse.json({ error: "Failed to save response", details: assistantError.message }, { status: 400 })
    }

    const { error: revisionError } = await supabase.from("plan_revisions").insert({
      user_id: user.id,
      week_start: weekStart,
      week_end: weekEnd,
      diff: editResponse.diff,
    })

    if (revisionError) {
      return NextResponse.json({ error: "Failed to save revision", details: revisionError.message }, { status: 400 })
    }

    return NextResponse.json(
      {
        ok: true,
        threadId: thread.id,
        updatedPlan: editResponse.updatedWeekPlan,
        diff: editResponse.diff,
        warnings: editResponse.warnings ?? [],
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("POST /api/ai/chat error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const threadId = searchParams.get("threadId") ?? ""

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

    if (!threadId) {
      return NextResponse.json({ error: "Thread id required" }, { status: 400 })
    }

    const { error } = await supabase
      .from("ai_threads")
      .delete()
      .eq("id", threadId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete thread", details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("DELETE /api/ai/chat error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
