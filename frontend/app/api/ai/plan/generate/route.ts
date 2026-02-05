import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "node:crypto"
import { createServerClient } from "@/lib/supabase/server"
import { buildWeeklyPlan } from "@/lib/nutrition/weeklyPlanner"
import { loadRecipePool, selectRecipe } from "@/lib/nutrition/recipeSelector"

const MAX_RANGE_DAYS = 90
const RECENT_REQUEST_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_FORCE_PER_MIN = 5
const RATE_LIMIT_ENSURE_PER_MIN = 20

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const payloadSchema = z
  .object({
    start: dateSchema,
    end: dateSchema,
    force: z.boolean().optional(),
    resetLocks: z.boolean().optional(),
  })
  .strict()

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1), // Accept any unit, will normalize it
})

const recipeSchema = z.object({
  title: z.string().min(1),
  servings: z.number().int().min(1),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string().min(1)),
  notes: z.string().min(1).nullable().optional(),
})

const mealSchema = z.object({
  slot: z.number().int().min(1),
  meal_type: z.enum(["breakfast", "snack", "lunch", "dinner", "intra"]),
  time: z.string().min(1), // Accept any time string, will normalize
  emoji: z.string().min(1),
  name: z.string().min(1),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  recipe: recipeSchema,
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
  daily_targets: macrosSchema,
  meals: z.array(mealSchema).min(1),
  rationale: z.string().min(1),
})

const aiResponseSchema = z.object({
  days: z.array(daySchema).min(1),
  rationale: z.string().min(1).optional(),
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

function formatErrorCode(value: string) {
  return value.toUpperCase()
}

function buildPromptPreview(payload: {
  start: string
  end: string
  profile: Record<string, unknown>
  workouts_summary: Array<{ date: string; total_hours: number; tss_total: number; sports: string[]; intensity: string }>
}) {
  const workoutDays = payload.workouts_summary.length
  const sportsSet = new Set<string>()
  payload.workouts_summary.forEach((summary) => summary.sports.forEach((sport) => sportsSet.add(sport)))

  return JSON.stringify(
    {
      start: payload.start,
      end: payload.end,
      profile: payload.profile,
      workout_days: workoutDays,
      sports: Array.from(sportsSet),
    },
    null,
    0,
  ).slice(0, 300)
}

function buildResponsePreview(response: AiResponse) {
  const dayTypes = response.days.reduce<Record<string, number>>((acc, day) => {
    acc[day.day_type] = (acc[day.day_type] ?? 0) + 1
    return acc
  }, {})
  return JSON.stringify(
    {
      days: response.days.length,
      day_types: dayTypes,
      meals_per_day: Math.round(
        response.days.reduce((sum, day) => sum + day.meals.length, 0) / response.days.length,
      ),
    },
    null,
    0,
  )
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
    start_time: string | null
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
      workouts: Array<{
        start_time: string | null
        duration_hours: number
        type: string
        intensity: "rest" | "training" | "high"
      }>
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
        workouts: [],
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

    // Store individual workout details for AI meal planning
    const workoutIntensity =
      entry.intensityScore >= 120
        ? "high"
        : entry.intensityScore >= 60
          ? "training"
          : "rest"

    entry.workouts.push({
      start_time: workout.start_time,
      duration_hours: duration,
      type: normalizeSportType(workout.workout_type),
      intensity: workoutIntensity,
    })
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
        workouts: [],
      }
    }
    const intensity =
      entry.total_hours === 0 && entry.tss_total === 0
        ? "rest"
        : entry.intensityScore >= 120
          ? "high"
          : entry.intensityScore >= 60
            ? "training"
            : "training"

    return {
      date,
      total_hours: Number(entry.total_hours.toFixed(2)),
      tss_total: Math.round(entry.tss_total),
      sports: Array.from(entry.sports).filter((value) => value !== "rest"),
      intensity,
      key_sessions: entry.key_sessions.slice(0, 3),
      workouts: entry.workouts.map((w) => ({
        start_time: w.start_time,
        duration_hours: Number(w.duration_hours.toFixed(2)),
        type: w.type,
        intensity: w.intensity,
      })),
    }
  })
}


/**
 * Validates response for overlapping meal times and fixes conflicts by nudging times forward.
 */
function validateAndFixAiResponseRules(response: AiResponse): { valid: boolean; errors: string[]; fixed: boolean; fixedResponse?: AiResponse } {
  const errors: string[] = []
  let needsFixing = false

  const fixedResponse: AiResponse = JSON.parse(JSON.stringify(response))
  fixedResponse.days.forEach((day) => {
    const usedTimes = new Set<string>()
    const standardTimes = ["07:00", "08:30", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
    let timeIndex = 0

    day.meals.forEach((meal) => {
      const time = meal.time ?? "12:00"
      if (usedTimes.has(time)) {
        errors.push(`Day ${day.date}: Multiple meals at ${time}`)
        needsFixing = true
        while (timeIndex < standardTimes.length && usedTimes.has(standardTimes[timeIndex])) {
          timeIndex += 1
        }
        if (timeIndex < standardTimes.length) {
          meal.time = standardTimes[timeIndex]
          usedTimes.add(standardTimes[timeIndex])
          timeIndex += 1
        }
      } else {
        usedTimes.add(time)
      }
    })
  })

  return {
    valid: !needsFixing,
    errors,
    fixed: needsFixing,
    fixedResponse: needsFixing ? fixedResponse : undefined,
  }
}

async function enforceRateLimit({
  supabase,
  userId,
  limit,
}: {
  supabase: Awaited<ReturnType<typeof createServerClient>>
  userId: string
  limit: number
}) {
  const cutoff = new Date(Date.now() - 60_000).toISOString()
  const { data, error } = await supabase
    .from("ai_requests")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", cutoff)

  if (error) {
    console.warn("Rate limit check failed", error)
    return { ok: true, remaining: null }
  }

  if ((data?.length ?? 0) >= limit) {
    return { ok: false, remaining: 0 }
  }

  return { ok: true, remaining: limit - (data?.length ?? 0) }
}

export async function POST(req: NextRequest) {
  let requestId = "unknown"
  try {
    requestId = crypto.randomUUID()
    console.log(`[${requestId}] POST /api/ai/plan/generate started`)
    
    const body = await req.json().catch((err) => {
      console.error(`[${requestId}] Error parsing request body:`, err)
      return null
    })
    
    console.log(`[${requestId}] Request body parsed:`, { start: body?.start, end: body?.end, force: body?.force })
    
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      console.error(`[${requestId}] Payload validation failed:`, parsed.error.issues)
      return jsonError(400, "invalid_payload", "Invalid payload", parsed.error.issues)
    }

    const { start, end, force = false, resetLocks = false } = parsed.data
    console.log(`[${requestId}] Validated payload: start=${start}, end=${end}, force=${force}, resetLocks=${resetLocks}`)
    
    if (start > end) {
      console.error(`[${requestId}] Invalid date range: start > end`)
      return jsonError(400, "invalid_range", "Invalid date range")
    }
    const range = buildDateRange(start, end)
    if (!range) {
      console.error(`[${requestId}] Invalid date range after parsing`)
      return jsonError(400, "invalid_range", "Invalid date range")
    }

    console.log(`[${requestId}] Date range: ${range.days} days (${start} to ${end})`)

    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error(`[${requestId}] Auth error:`, authError?.message ?? "No user")
      return jsonError(401, "unauthorized", "Not authenticated", authError?.message ?? null)
    }

    console.log(`[${requestId}] Authenticated user: ${user.id}`)

    const effectiveForce = force || resetLocks
    const rateLimit = await enforceRateLimit({
      supabase,
      userId: user.id,
      limit: effectiveForce ? RATE_LIMIT_FORCE_PER_MIN : RATE_LIMIT_ENSURE_PER_MIN,
    })
    if (!rateLimit.ok) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${user.id}`)
      return jsonError(
        429,
        "rate_limited",
        "Too many requests. Please wait a moment before trying again.",
      )
    }

    console.log(`[${requestId}] Rate limit OK. Remaining: ${rateLimit.remaining}`)

    const dateKeys = buildDateKeys(start, end)
    const [{ data: existingRows }, { data: existingMeals }] = await Promise.all([
      supabase
        .from("nutrition_plan_rows")
        .select("date, day_type, plan_id, kcal, protein_g, carbs_g, fat_g, intra_cho_g_per_h, locked")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("nutrition_meals")
        .select("date, slot, name, time, kcal, protein_g, carbs_g, fat_g, eaten, eaten_at, locked, recipe")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
    ])

    const rowsByDate = new Set((existingRows ?? []).map((row) => row.date))
    const mealsByDate = new Set((existingMeals ?? []).map((meal) => meal.date))
    const hasAllDays = dateKeys.every((date) => rowsByDate.has(date) && mealsByDate.has(date))
    if (!effectiveForce && hasAllDays) {
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

    if (resetLocks) {
      await supabase
        .from("nutrition_plan_rows")
        .update({ locked: false })
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
      await supabase
        .from("nutrition_meals")
        .update({ locked: false })
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
    }

    const normalizedRows = (existingRows ?? []).map((row) => ({
      ...row,
      locked: resetLocks ? false : row.locked ?? false,
    }))
    const normalizedMeals = (existingMeals ?? []).map((meal) => ({
      ...meal,
      locked: resetLocks ? false : meal.locked ?? false,
    }))

    const { data: profile } = await supabase
      .from("profiles")
      .select("weight_kg, primary_goal, diet, meals_per_day, units")
      .eq("id", user.id)
      .single()

    const { data: workouts } = await supabase
      .from("tp_workouts")
      .select("workout_day, start_time, workout_type, planned_hours, actual_hours, tss, if, rpe, title")
      .eq("user_id", user.id)
      .gte("workout_day", start)
      .lte("workout_day", end)

    const model = process.env.OPENAI_MODEL ?? "deterministic-planner"
    const workoutsSummary = summarizeWorkoutsByDay(workouts ?? [], start, end)

    const payloadForLogging = {
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
        'days[{date,day_type,daily_targets{kcal,protein_g,carbs_g,fat_g,intra_cho_g_per_h},meals[{slot,meal_type,time,emoji,name,kcal,protein_g,carbs_g,fat_g,recipe{title,servings,ingredients[{name,quantity,unit}],steps,notes}}],rationale}]',
    }

    const recipePool = await loadRecipePool({ supabase, userId: user.id })
    const usedTitles = new Map<string, number>()
    normalizedMeals.forEach((meal) => {
      const recipeTitle = (meal as { recipe?: { title?: string } | null }).recipe?.title
      const title = recipeTitle ?? meal.name
      const normalized = title.trim().toLowerCase()
      usedTitles.set(normalized, (usedTitles.get(normalized) ?? 0) + 1)
    })

    const plannerDays = buildWeeklyPlan({
      start,
      end,
      profile: {
        weight_kg: profile?.weight_kg ?? 70,
        meals_per_day: profile?.meals_per_day ?? 3,
        diet: profile?.diet ?? null,
        allergies: (profile as { allergies?: string[] | null } | null)?.allergies ?? null,
      },
      workouts: (workouts ?? []).map((workout) => ({
        workout_day: workout.workout_day,
        workout_type: workout.workout_type ?? null,
        planned_hours: workout.planned_hours ?? null,
        actual_hours: workout.actual_hours ?? null,
        tss: workout.tss ?? null,
        if: workout.if ?? null,
        rpe: workout.rpe ?? null,
        title: workout.title ?? null,
        start_time: workout.start_time ?? null,
      })),
    })

    const ensureNumber = (value: unknown, fallback: number) => {
      if (typeof value === "number" && Number.isFinite(value)) return value
      if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
        return Number(value)
      }
      return fallback
    }

    const days = plannerDays.map((day) => {
      const meals = day.meals.map((meal) => {
        const recipe = selectRecipe({
          mealType: meal.meal_type,
          targetMacros: meal.target_macros,
          usedTitles,
          profile: { diet: profile?.diet ?? null, allergies: (profile as { allergies?: string[] | null })?.allergies ?? null },
          pool: recipePool,
        })
        const normalizedTitle = recipe.title.trim().toLowerCase()
        usedTitles.set(normalizedTitle, (usedTitles.get(normalizedTitle) ?? 0) + 1)

        const normalizedIngredients = recipe.ingredients.map((ingredient) => ({
          name: ingredient.name,
          quantity: ensureNumber(ingredient.quantity, 1),
          unit: ingredient.unit ?? "unit",
        }))

        const steps = recipe.steps.length > 0 ? recipe.steps : ["Prepare the ingredients.", "Combine and serve."]

        return {
          slot: meal.slot,
          meal_type: meal.meal_type,
          time: meal.time,
          emoji: meal.emoji,
          name: recipe.title,
          kcal: meal.target_macros.kcal,
          protein_g: meal.target_macros.protein_g,
          carbs_g: meal.target_macros.carbs_g,
          fat_g: meal.target_macros.fat_g,
          recipe: {
            title: recipe.title,
            servings: recipe.servings ?? 1,
            ingredients: normalizedIngredients,
            steps,
            notes: recipe.notes ?? null,
          },
        }
      })

      return {
        date: day.date,
        day_type: day.day_type,
        daily_targets: day.daily_targets,
        meals,
        rationale: "Deterministic targets with recipe selection for consistent macro adherence.",
      }
    })

    let aiResponse: AiResponse = {
      days,
      rationale: "Deterministic targets with recipe selection for consistent macro adherence.",
    }

    let aiRaw: unknown = { days, deterministic: true }
    const tokens = null
    const latencyMs = 0
    const aiErrorCode = null

    const promptHash = crypto
      .createHash("sha256")
      .update(`deterministic:${JSON.stringify(payloadForLogging)}`)
      .digest("hex")
    const promptPreview = buildPromptPreview(payloadForLogging)
    const responsePreview = aiResponse ? buildResponsePreview(aiResponse) : null

    const { data: aiLogRow, error: aiLogError } = await supabase
      .from("ai_requests")
      .insert({
        user_id: user.id,
        provider: "other",
        model,
        prompt_hash: promptHash,
        response_json: aiRaw,
        tokens,
        latency_ms: latencyMs,
        error_code: aiErrorCode ? formatErrorCode(aiErrorCode) : null,
        prompt_preview: promptPreview,
        response_preview: responsePreview,
      })
      .select("id")
      .single()

    if (aiLogError) {
      console.error(`[${requestId}] Failed to log AI request to database:`, aiLogError.message)
      return jsonError(500, "ai_log_failed", "Failed to log AI request", aiLogError.message)
    }

    console.log(`[${requestId}] AI request logged with ID: ${aiLogRow?.id}`)

    if (!aiResponse || aiResponse.days.length === 0) {
      console.error(`[${requestId}] AI response invalid: no days or missing response`)
      return jsonError(500, "ai_response_invalid", "AI response missing days")
    }

    // Validate and auto-fix business rules (no overlapping times, max 2x per week per dish)
    const validation = validateAndFixAiResponseRules(aiResponse)
    
    if (validation.fixed && validation.fixedResponse) {
      console.log(`[${requestId}] Auto-corrected ${validation.errors.length} business rule violations`)
      aiResponse = validation.fixedResponse
    } else if (!validation.valid) {
      console.warn(`[${requestId}] AI response has business rule violations:`, validation.errors)
      // Continue anyway - AI should mostly follow rules
      console.log(`[${requestId}] Proceeding with AI response despite ${validation.errors.length} issues`)
    }

    const rowsByDateMap = new Map(normalizedRows.map((row) => [row.date, row]))
    const lockedDaySet = new Set(normalizedRows.filter((row) => row.locked).map((row) => row.date))
    const mealsByDateMap = normalizedMeals.reduce((map, meal) => {
      if (!map.has(meal.date)) {
        map.set(meal.date, [])
      }
      map.get(meal.date)?.push(meal)
      return map
    }, new Map<string, typeof normalizedMeals>())

    const planRows: Array<{
      user_id: string
      date: string
      day_type: string
      kcal: number
      protein_g: number
      carbs_g: number
      fat_g: number
      intra_cho_g_per_h: number
      plan_id?: string | null
      locked?: boolean
      rationale?: string | null
    }> = []

    const mealRows: Array<{
      user_id: string
      date: string
      slot: number
      meal_type: string
      emoji: string
      name: string
      time: string | null
      kcal: number
      protein_g: number
      carbs_g: number
      fat_g: number
      ingredients: unknown[]
      recipe: unknown
      notes: string | null
      eaten: boolean
      eaten_at: string | null
      locked?: boolean
    }> = []

    const diff = {
      mode: resetLocks ? "reset" : effectiveForce ? "regenerate" : "ensure",
      macros_changed: 0,
      meals_added: 0,
      meals_removed: 0,
      meals_updated: 0,
      preserved_days: [] as string[],
      preserved_meals: [] as Array<{ date: string; slot: number }>,
    }

    const aiMealsByDate = aiResponse.days.reduce((map, day) => {
      map.set(day.date, day.meals)
      return map
    }, new Map<string, typeof aiResponse.days[number]["meals"]>())

    aiResponse.days.forEach((day) => {
      const existingRow = rowsByDateMap.get(day.date)
      const dayLocked = existingRow?.locked ?? false
      const existingMealsForDay = mealsByDateMap.get(day.date) ?? []
      const existingMealsBySlot = new Map(existingMealsForDay.map((meal) => [meal.slot, meal]))

      if (dayLocked && !resetLocks) {
        diff.preserved_days.push(day.date)
        return
      }

      planRows.push({
        user_id: user.id,
        date: day.date,
        day_type: day.day_type,
        kcal: day.daily_targets.kcal,
        protein_g: day.daily_targets.protein_g,
        carbs_g: day.daily_targets.carbs_g,
        fat_g: day.daily_targets.fat_g,
        intra_cho_g_per_h: day.daily_targets.intra_cho_g_per_h,
        plan_id: existingRow?.plan_id ?? null,
        locked: resetLocks ? false : existingRow?.locked ?? false,
        rationale: day.rationale,
      })

      if (existingRow) {
        const macroChanged =
          existingRow.kcal !== day.daily_targets.kcal ||
          existingRow.protein_g !== day.daily_targets.protein_g ||
          existingRow.carbs_g !== day.daily_targets.carbs_g ||
          existingRow.fat_g !== day.daily_targets.fat_g ||
          existingRow.intra_cho_g_per_h !== day.daily_targets.intra_cho_g_per_h
        if (macroChanged) diff.macros_changed += 1
      }

      const aiMeals = aiMealsByDate.get(day.date) ?? []
      aiMeals.forEach((meal) => {
        const existingMeal = existingMealsBySlot.get(meal.slot)
        if (existingMeal?.locked && !resetLocks) {
          diff.preserved_meals.push({ date: day.date, slot: meal.slot })
          return
        }
        const eaten = existingMeal?.eaten ?? false
        const eatenAt = existingMeal?.eaten_at ?? null

        if (!existingMeal) {
          diff.meals_added += 1
        } else {
          const updated =
            existingMeal.name !== meal.recipe.title ||
            (existingMeal.time ?? null) !== (meal.time ?? null) ||
            (existingMeal.kcal ?? 0) !== meal.kcal ||
            (existingMeal.protein_g ?? 0) !== meal.protein_g ||
            (existingMeal.carbs_g ?? 0) !== meal.carbs_g ||
            (existingMeal.fat_g ?? 0) !== meal.fat_g
          if (updated) diff.meals_updated += 1
        }

        mealRows.push({
          user_id: user.id,
          date: day.date,
          slot: meal.slot,
          meal_type: meal.meal_type,
          emoji: meal.emoji,
          name: meal.recipe.title, // Use recipe title (specific dish name, not "Breakfast")
          time: meal.time ?? null,
          kcal: meal.kcal,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          ingredients: meal.recipe.ingredients,
          recipe: meal.recipe,
          notes: meal.recipe.notes ?? null,
          eaten,
          eaten_at: eatenAt,
          locked: resetLocks ? false : existingMeal?.locked ?? false,
        })
      })

      if (existingMealsForDay.length > aiMeals.length) {
        const aiSlots = new Set(aiMeals.map((meal) => meal.slot))
        existingMealsForDay.forEach((meal) => {
          if (!aiSlots.has(meal.slot) && !(meal.locked && !resetLocks)) {
            diff.meals_removed += 1
          }
        })
      }
    })

    if (resetLocks) {
      await supabase
        .from("nutrition_meals")
        .delete()
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
    } else {
      const unlockedDates = dateKeys.filter((date) => !lockedDaySet.has(date))
      await Promise.all(
        unlockedDates.map((date) =>
          supabase
            .from("nutrition_meals")
            .delete()
            .eq("user_id", user.id)
            .eq("date", date)
            .eq("locked", false),
        ),
      )
    }

    const { error: rowError } = await supabase
      .from("nutrition_plan_rows")
      .upsert(planRows, { onConflict: "user_id,date" })
    if (rowError) {
      console.error(`[${requestId}] Failed to save plan rows:`, rowError.message)
      if (aiLogRow?.id) {
        await supabase.from("ai_requests").update({ error_code: "DB_WRITE_FAIL" }).eq("id", aiLogRow.id)
      }
      return jsonError(500, "plan_rows_save_failed", "Failed to save plan rows", rowError.message)
    }

    console.log(`[${requestId}] Saved ${planRows.length} nutrition plan rows`)

    const { error: mealError } = await supabase
      .from("nutrition_meals")
      .upsert(mealRows, { onConflict: "user_id,date,slot" })
    if (mealError) {
      console.error(`[${requestId}] Failed to save meals:`, mealError.message)
      if (aiLogRow?.id) {
        await supabase.from("ai_requests").update({ error_code: "DB_WRITE_FAIL" }).eq("id", aiLogRow.id)
      }
      return jsonError(500, "meals_save_failed", "Failed to save meals", mealError.message)
    }

    console.log(`[${requestId}] Saved ${mealRows.length} nutrition meals`)

    const { error: revisionError } = await supabase.from("plan_revisions").insert({
      user_id: user.id,
      week_start: start,
      week_end: end,
      diff,
    })

    if (revisionError) {
      console.error(`[${requestId}] Failed to save revision:`, revisionError.message)
      if (aiLogRow?.id) {
        await supabase.from("ai_requests").update({ error_code: "DB_WRITE_FAIL" }).eq("id", aiLogRow.id)
      }
      return jsonError(500, "plan_revision_failed", "Failed to save revision", revisionError.message)
    }

    console.log(`[${requestId}] Plan revision saved successfully`)

    const usedFallback = Boolean((aiRaw as { fallback?: boolean } | null)?.fallback)
    console.log(`[${requestId}] POST /api/ai/plan/generate completed. Fallback: ${usedFallback}`)
    
    return NextResponse.json(
      { ok: true, start, end, usedFallback, diff },
      { status: 200 },
    )
  } catch (error) {
    console.error(`[${requestId}] POST /api/ai/plan/generate error:`, error instanceof Error ? error.message : String(error))
    console.error(`[${requestId}] Stack:`, error instanceof Error ? error.stack : "No stack")
    return jsonError(
      500,
      "internal_error",
      "Internal error",
      error instanceof Error ? error.message : String(error),
    )
  }
}
