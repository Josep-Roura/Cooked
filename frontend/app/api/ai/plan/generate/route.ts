import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "node:crypto"
import { systemPrompt } from "@/lib/ai/prompt"
import { createServerClient } from "@/lib/supabase/server"

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const OPENAI_TIMEOUT_MS = 60000
const MAX_RANGE_DAYS = 62

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const payloadSchema = z.object({
  start: dateSchema,
  end: dateSchema,
}).strict()

const mealSchema = z.object({
  slot: z.number().int().min(1),
  name: z.string().min(1),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
})

const macrosSchema = z.object({
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  intra_cho_g_per_h: z.number().nonnegative(),
})

const daySchema = z.object({
  date: dateSchema,
  day_type: z.enum(["rest", "training", "high"]),
  macros: macrosSchema,
  meals: z.array(mealSchema).min(1),
})

const aiResponseSchema = z.object({
  days: z.array(daySchema).min(1),
  rationale: z.string().min(1),
})

type AiResponse = z.infer<typeof aiResponseSchema>

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

function buildDateKeys(start: string, end: string) {
  const range = buildDateRange(start, end)
  if (!range) return []
  return Array.from({ length: range.days }, (_value, index) => {
    const cursor = new Date(`${start}T00:00:00Z`)
    cursor.setUTCDate(cursor.getUTCDate() + index)
    return cursor.toISOString().split("T")[0]
  })
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
    intra_cho_g_per_h: 0,
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
    kcal: Math.round(macros.kcal * mealShares[index]),
    protein_g: Math.round(macros.protein_g * mealShares[index]),
    carbs_g: Math.round(macros.carbs_g * mealShares[index]),
    fat_g: Math.round(macros.fat_g * mealShares[index]),
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
}): AiResponse {
  const range = buildDateRange(start, end)
  if (!range) {
    return { days: [], rationale: "Fallback plan unavailable for the requested range." }
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

  return {
    days,
    rationale: "Fallback plan generated deterministically from profile and workouts.",
  }
}

async function callOpenAI({
  apiKey,
  model,
  requestId,
  payload,
}: {
  apiKey: string
  model: string
  requestId: string
  payload: Record<string, unknown>
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
      signal: controller.signal,
    })

    const data = await response.json().catch(() => null)
    const latencyMs = Date.now() - startedAt
    return { response, data, latencyMs }
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(req: NextRequest) {
  let requestId = "unknown"
  try {
    requestId = crypto.randomUUID()
    const body = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.issues },
        { status: 400 },
      )
    }

    const { start, end } = parsed.data
    if (start > end) {
      return NextResponse.json({ ok: false, error: "Invalid date range" }, { status: 400 })
    }
    const range = buildDateRange(start, end)
    if (!range) {
      return NextResponse.json({ ok: false, error: "Invalid date range" }, { status: 400 })
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

    const dateKeys = buildDateKeys(start, end)
    const [{ data: existingRows }, { data: existingMeals }] = await Promise.all([
      supabase
        .from("nutrition_plan_rows")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("nutrition_meals")
        .select("date")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
    ])

    const rowsByDate = new Set((existingRows ?? []).map((row) => row.date))
    const mealsByDate = new Set((existingMeals ?? []).map((meal) => meal.date))
    const hasAllDays = dateKeys.every((date) => rowsByDate.has(date) && mealsByDate.has(date))
    if (hasAllDays) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("weight_kg, primary_goal, diet, meals_per_day")
      .eq("id", user.id)
      .single()

    const { data: workouts } = await supabase
      .from("tp_workouts")
      .select("workout_day, workout_type, planned_hours, actual_hours, tss, if, rpe, title")
      .eq("user_id", user.id)
      .gte("workout_day", start)
      .lte("workout_day", end)

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY is not configured" }, { status: 500 })
    }

    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
    const payload = {
      start,
      end,
      profile: profile ?? {},
      workouts: workouts ?? [],
      schema: "days[{date,day_type,macros{kcal,protein_g,carbs_g,fat_g,intra_cho_g_per_h},meals[{slot,name,time,kcal,protein_g,carbs_g,fat_g}]}]",
    }

    let aiResponse: AiResponse | null = null
    let aiRaw: unknown = null
    let latencyMs = 0
    let tokens: number | null = null

    try {
      const { response, data, latencyMs: callLatency } = await callOpenAI({
        apiKey,
        model,
        requestId,
        payload,
      })
      latencyMs = callLatency
      aiRaw = data

      if (!response.ok || !data) {
        const message = data?.error?.message ?? "OpenAI request failed"
        throw new Error(message)
      }

      const content = data.choices?.[0]?.message?.content ?? ""
      const parsedJson = JSON.parse(content)
      const parsed = aiResponseSchema.safeParse(parsedJson)
      if (!parsed.success) {
        throw new Error("Invalid AI response")
      }

      tokens = data?.usage?.total_tokens ?? null
      aiResponse = parsed.data
    } catch (error) {
      const fallback = buildFallbackPlan({
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
        mealsPerDay: profile?.meals_per_day ?? 3,
      })
      aiResponse = fallback
      aiRaw = { fallback: true, error: error instanceof Error ? error.message : String(error) }
    }

    const promptHash = crypto
      .createHash("sha256")
      .update(`${systemPrompt}:${JSON.stringify(payload)}`)
      .digest("hex")

    const { error: aiLogError } = await supabase.from("ai_requests").insert({
      user_id: user.id,
      provider: "openai",
      model,
      prompt_hash: promptHash,
      response_json: aiRaw,
      tokens,
      latency_ms: latencyMs,
    })

    if (aiLogError) {
      return NextResponse.json({ ok: false, error: "Failed to log AI request" }, { status: 500 })
    }

    if (!aiResponse || aiResponse.days.length === 0) {
      return NextResponse.json({ ok: false, error: "AI response missing days" }, { status: 500 })
    }

    const planRows = aiResponse.days.map((day) => ({
      user_id: user.id,
      date: day.date,
      day_type: day.day_type,
      kcal: day.macros.kcal,
      protein_g: day.macros.protein_g,
      carbs_g: day.macros.carbs_g,
      fat_g: day.macros.fat_g,
      intra_cho_g_per_h: day.macros.intra_cho_g_per_h,
    }))

    const mealRows = aiResponse.days.flatMap((day) =>
      day.meals.map((meal) => ({
        user_id: user.id,
        date: day.date,
        slot: meal.slot,
        name: meal.name,
        time: meal.time ?? null,
        kcal: meal.kcal,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        ingredients: [],
        eaten: false,
      })),
    )

    const { error: rowError } = await supabase
      .from("nutrition_plan_rows")
      .upsert(planRows, { onConflict: "user_id,date" })
    if (rowError) {
      return NextResponse.json({ ok: false, error: "Failed to save plan rows", details: rowError.message }, { status: 500 })
    }

    const { error: mealError } = await supabase
      .from("nutrition_meals")
      .upsert(mealRows, { onConflict: "user_id,date,slot" })
    if (mealError) {
      return NextResponse.json({ ok: false, error: "Failed to save meals", details: mealError.message }, { status: 500 })
    }

    const { error: revisionError } = await supabase.from("plan_revisions").insert({
      user_id: user.id,
      week_start: start,
      week_end: end,
      diff: {
        generated: true,
        start,
        end,
        days: aiResponse.days.length,
      },
    })

    if (revisionError) {
      return NextResponse.json({ ok: false, error: "Failed to save revision", details: revisionError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error("POST /api/ai/plan/generate error:", error)
    return NextResponse.json(
      { ok: false, error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
