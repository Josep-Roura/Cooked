import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "node:crypto"
import { systemPrompt } from "@/lib/ai/prompt"
import { createServerClient } from "@/lib/supabase/server"

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const OPENAI_TIMEOUT_MS = 60000
const OPENAI_MAX_RETRIES = 2
const OPENAI_RETRY_BASE_MS = 800
const MAX_RANGE_DAYS = 90
const RECENT_REQUEST_WINDOW_MS = 10 * 60 * 1000

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const payloadSchema = z
  .object({
    start: dateSchema,
    end: dateSchema,
    force: z.boolean().optional(),
  })
  .strict()

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

type ErrorPayload = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

function jsonError(status: number, code: string, message: string, details?: unknown) {
  const payload: ErrorPayload = { ok: false, error: { code, message, details } }
  return NextResponse.json(payload, { status })
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

function normalizeSportType(value: string | null) {
  const normalized = value?.toLowerCase() ?? ""
  if (normalized.includes("swim")) return "swim"
  if (normalized.includes("bike") || normalized.includes("cycle")) return "bike"
  if (normalized.includes("run")) return "run"
  if (normalized.includes("strength") || normalized.includes("gym")) return "strength"
  if (normalized.includes("rest")) return "rest"
  return "other"
}

function summarizeWorkoutsByDay(
  workouts: Array<{
    workout_day: string
    workout_type: string | null
    planned_hours: number | null
    actual_hours: number | null
    tss: number | null
    if: number | null
    rpe: number | null
    title: string | null
  }>,
  start: string,
  end: string,
) {
  const dateKeys = buildDateKeys(start, end)
  const summaryMap = new Map<
    string,
    {
      total_hours: number
      tss_total: number
      sports: Set<string>
      intensityScore: number
      key_sessions: string[]
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
  })

  return dateKeys.map((date) => {
    const entry = summaryMap.get(date)
    if (!entry) {
      return {
        date,
        total_hours: 0,
        tss_total: 0,
        sports: [],
        intensity: "rest",
        key_sessions: [],
      }
    }
    const intensity =
      entry.total_hours === 0 && entry.tss_total === 0
        ? "rest"
        : entry.intensityScore >= 120
          ? "high"
          : entry.intensityScore >= 60
            ? "moderate"
            : "low"

    return {
      date,
      total_hours: Number(entry.total_hours.toFixed(2)),
      tss_total: Math.round(entry.tss_total),
      sports: Array.from(entry.sports).filter((value) => value !== "rest"),
      intensity,
      key_sessions: entry.key_sessions.slice(0, 3),
    }
  })
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
        "X-Request-Id": requestId,
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

async function callOpenAIWithRetry(args: {
  apiKey: string
  model: string
  requestId: string
  payload: Record<string, unknown>
}) {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= OPENAI_MAX_RETRIES; attempt += 1) {
    try {
      const { response, data, latencyMs } = await callOpenAI(args)
      if (response.ok || ![408, 429, 500, 502, 503, 504].includes(response.status)) {
        return { response, data, latencyMs }
      }
      lastError = new Error(`OpenAI retryable error: ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    if (attempt < OPENAI_MAX_RETRIES) {
      const waitMs = OPENAI_RETRY_BASE_MS * (attempt + 1)
      await sleep(waitMs)
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error("OpenAI request failed")
}

export async function POST(req: NextRequest) {
  let requestId = "unknown"
  try {
    requestId = crypto.randomUUID()
    const body = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return jsonError(400, "invalid_payload", "Invalid payload", parsed.error.issues)
    }

    const { start, end, force = false } = parsed.data
    if (start > end) {
      return jsonError(400, "invalid_range", "Invalid date range")
    }
    const range = buildDateRange(start, end)
    if (!range) {
      return jsonError(400, "invalid_range", "Invalid date range")
    }

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
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
    if (!force && hasAllDays) {
      const cutoff = new Date(Date.now() - RECENT_REQUEST_WINDOW_MS).toISOString()
      const { data: recentRequest } = await supabase
        .from("ai_requests")
        .select("id, created_at")
        .eq("user_id", user.id)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      return NextResponse.json(
        { ok: true, start, end, deduped: true, recentRequest: Boolean(recentRequest) },
        { status: 200 },
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("weight_kg, primary_goal, diet, meals_per_day, units")
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
      return jsonError(500, "config_missing", "OPENAI_API_KEY is not configured")
    }

    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini"
    const workoutsSummary = summarizeWorkoutsByDay(workouts ?? [], start, end)
    const payload = {
      start,
      end,
      profile: {
        weight_kg: profile?.weight_kg ?? null,
        meals_per_day: profile?.meals_per_day ?? null,
        diet: profile?.diet ?? null,
        primary_goal: profile?.primary_goal ?? null,
        units: profile?.units ?? null,
      },
      workouts_summary: workoutsSummary,
      schema:
        "days[{date,day_type,macros{kcal,protein_g,carbs_g,fat_g,intra_cho_g_per_h},meals[{slot,name,time,kcal,protein_g,carbs_g,fat_g}]}]",
    }

    let aiResponse: AiResponse | null = null
    let aiRaw: unknown = null
    let latencyMs = 0
    let tokens: number | null = null

    try {
      const { response, data, latencyMs: callLatency } = await callOpenAIWithRetry({
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
      return jsonError(500, "ai_log_failed", "Failed to log AI request", aiLogError.message)
    }

    if (!aiResponse || aiResponse.days.length === 0) {
      return jsonError(500, "ai_response_invalid", "AI response missing days")
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
      return jsonError(500, "plan_rows_save_failed", "Failed to save plan rows", rowError.message)
    }

    const { error: mealError } = await supabase
      .from("nutrition_meals")
      .upsert(mealRows, { onConflict: "user_id,date,slot" })
    if (mealError) {
      return jsonError(500, "meals_save_failed", "Failed to save meals", mealError.message)
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
      return jsonError(500, "plan_revision_failed", "Failed to save revision", revisionError.message)
    }

    const usedFallback = Boolean((aiRaw as { fallback?: boolean } | null)?.fallback)
    return NextResponse.json({ ok: true, start, end, usedFallback }, { status: 200 })
  } catch (error) {
    console.error("POST /api/ai/plan/generate error:", error)
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}
