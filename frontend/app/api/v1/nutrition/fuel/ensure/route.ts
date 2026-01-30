import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const payloadSchema = z.object({
  date: dateSchema,
})

type FuelMacro = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

type FuelItemPayload = {
  slot: number
  name: string
  meal_type: "fuel_pre" | "fuel_intra" | "fuel_post"
  time: string | null
  macros: FuelMacro
  ingredients: Array<{ name: string; quantity: string }>
  recipe: Record<string, unknown>
}

const intensityThresholds = {
  low: 4,
  high: 7,
}

function normalizeStartTime(value: string | null | undefined) {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function getDurationMinutes(workout: { actual_hours: number | null; planned_hours: number | null }) {
  const hours = workout.actual_hours ?? workout.planned_hours ?? 0
  if (!hours || hours <= 0) return 0
  return Math.round(hours * 60)
}

function mapIntensity(workout: { rpe: number | null; if: number | null }) {
  const rpe = workout.rpe ?? null
  if (rpe !== null) {
    if (rpe >= intensityThresholds.high) return "high"
    if (rpe >= intensityThresholds.low) return "moderate"
    return "low"
  }
  const intensityFactor = workout.if ?? null
  if (intensityFactor !== null) {
    if (intensityFactor >= 0.85) return "high"
    if (intensityFactor >= 0.7) return "moderate"
    return "low"
  }
  return "moderate"
}

function addMinutes(time: string, minutesToAdd: number) {
  const [hours, minutes] = time.split(":").map(Number)
  const totalMinutes = hours * 60 + minutes + minutesToAdd
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const nextHours = Math.floor(normalized / 60)
  const nextMinutes = normalized % 60
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`
}

function buildPreFuel(durationMinutes: number, intensity: string): FuelMacro {
  const baseCarbs = durationMinutes >= 60 ? 45 : 25
  const boost = intensity === "high" ? 15 : 0
  const carbs = baseCarbs + boost
  const protein = durationMinutes >= 60 ? 15 : 10
  const fat = durationMinutes >= 90 ? 8 : 4
  return {
    carbs_g: carbs,
    protein_g: protein,
    fat_g: fat,
    kcal: carbs * 4 + protein * 4 + fat * 9,
  }
}

function buildPostFuel(durationMinutes: number, intensity: string, workoutType: string | null): FuelMacro {
  const isStrength = workoutType?.toLowerCase().includes("strength") ?? false
  const protein = isStrength ? 30 : 25
  const carbs = durationMinutes >= 90 ? 70 : durationMinutes >= 45 ? 55 : 35
  const fat = intensity === "high" ? 6 : 4
  return {
    carbs_g: carbs,
    protein_g: protein,
    fat_g: fat,
    kcal: carbs * 4 + protein * 4 + fat * 9,
  }
}

function buildIntraFuel(durationMinutes: number, intensity: string) {
  const hours = Math.max(durationMinutes / 60, 0)
  const carbsPerHour = intensity === "high" ? 70 : intensity === "moderate" ? 50 : 30
  const sodiumMgPerHour = intensity === "high" ? 700 : intensity === "moderate" ? 500 : 400
  const fluidsMlPerHour = intensity === "high" ? 750 : 600
  const totalCarbs = Math.round(carbsPerHour * hours)
  return {
    macros: {
      carbs_g: totalCarbs,
      protein_g: 0,
      fat_g: 0,
      kcal: totalCarbs * 4,
    },
    carbsPerHour,
    sodiumMgPerHour,
    fluidsMlPerHour,
  }
}

function buildFuelItems({
  workout,
  slotBase,
}: {
  workout: {
    id: number
    workout_day: string
    title: string | null
    workout_type: string | null
    start_time: string | null
    planned_hours: number | null
    actual_hours: number | null
    rpe: number | null
    if: number | null
  }
  slotBase: number
}): FuelItemPayload[] {
  const durationMinutes = getDurationMinutes(workout)
  const intensity = mapIntensity(workout)
  const startTime = normalizeStartTime(workout.start_time)
  const workoutTitle = workout.title ?? workout.workout_type ?? "Workout"
  const items: FuelItemPayload[] = []

  if (durationMinutes < 30) {
    return items
  }

  const preMacros = buildPreFuel(durationMinutes, intensity)
  items.push({
    slot: slotBase,
    name: `Pre-fuel · ${workoutTitle}`,
    meal_type: "fuel_pre",
    time: startTime ? addMinutes(startTime, -60) : null,
    macros: preMacros,
    ingredients: [
      { name: "Carbs", quantity: `${preMacros.carbs_g} g` },
      { name: "Protein", quantity: `${preMacros.protein_g} g` },
      { name: "Fat", quantity: `${preMacros.fat_g} g` },
    ],
    recipe: {
      type: "fuel",
      timing: "pre",
      workout: {
        id: workout.id,
        title: workoutTitle,
        workout_type: workout.workout_type,
        start_time: startTime,
        duration_min: durationMinutes,
        intensity,
      },
      guidance: {
        carbs_g: preMacros.carbs_g,
        protein_g: preMacros.protein_g,
        fat_g: preMacros.fat_g,
      },
      steps: [
        "Eat 45–60 minutes before training.",
        "Focus on easily digested carbs plus a bit of protein.",
      ],
      tips: ["Keep fiber low for comfort.", "Sip water steadily before you start."],
    },
  })

  if (durationMinutes >= 75) {
    const intraFuel = buildIntraFuel(durationMinutes, intensity)
    items.push({
      slot: slotBase + 1,
      name: `Intra-fuel · ${workoutTitle}`,
      meal_type: "fuel_intra",
      time: startTime ? addMinutes(startTime, Math.round(durationMinutes / 2)) : null,
      macros: intraFuel.macros,
      ingredients: [
        { name: "Carbs", quantity: `${intraFuel.carbsPerHour} g/h` },
        { name: "Sodium", quantity: `${intraFuel.sodiumMgPerHour} mg/h` },
        { name: "Fluids", quantity: `${intraFuel.fluidsMlPerHour} ml/h` },
      ],
      recipe: {
        type: "fuel",
        timing: "intra",
        workout: {
          id: workout.id,
          title: workoutTitle,
          workout_type: workout.workout_type,
          start_time: startTime,
          duration_min: durationMinutes,
          intensity,
        },
        guidance: {
          carbs_g_per_h: intraFuel.carbsPerHour,
          sodium_mg_per_h: intraFuel.sodiumMgPerHour,
          fluids_ml_per_h: intraFuel.fluidsMlPerHour,
          total_carbs_g: intraFuel.macros.carbs_g,
        },
        steps: [
          "Start fueling after the first 20–30 minutes.",
          "Split carbs into small doses every 15–20 minutes.",
        ],
        tips: ["Use a mix of drink + gel/chew.", "Adjust sodium for heat and sweat rate."],
      },
    })
  }

  const postMacros = buildPostFuel(durationMinutes, intensity, workout.workout_type)
  items.push({
    slot: slotBase + 2,
    name: `Post-fuel · ${workoutTitle}`,
    meal_type: "fuel_post",
    time: startTime ? addMinutes(startTime, durationMinutes + 15) : null,
    macros: postMacros,
    ingredients: [
      { name: "Carbs", quantity: `${postMacros.carbs_g} g` },
      { name: "Protein", quantity: `${postMacros.protein_g} g` },
      { name: "Fat", quantity: `${postMacros.fat_g} g` },
    ],
    recipe: {
      type: "fuel",
      timing: "post",
      workout: {
        id: workout.id,
        title: workoutTitle,
        workout_type: workout.workout_type,
        start_time: startTime,
        duration_min: durationMinutes,
        intensity,
      },
      guidance: {
        carbs_g: postMacros.carbs_g,
        protein_g: postMacros.protein_g,
        fat_g: postMacros.fat_g,
      },
      steps: ["Refuel within 60 minutes of finishing.", "Prioritize carbs plus protein."],
      tips: ["Add fluids and sodium if you sweated heavily."],
    },
  })

  return items
}

function assignSlotBase(workoutId: number, usedSlots: Set<number>) {
  let base = 1000 + (workoutId % 100000) * 10
  while (usedSlots.has(base) || usedSlots.has(base + 1) || usedSlots.has(base + 2)) {
    base += 30
  }
  usedSlots.add(base)
  usedSlots.add(base + 1)
  usedSlots.add(base + 2)
  return base
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = payloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { date } = parsed.data
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

    const { data: workouts, error: workoutError } = await supabase
      .from("tp_workouts")
      .select("id, workout_day, title, workout_type, start_time, planned_hours, actual_hours, rpe, if")
      .eq("user_id", user.id)
      .eq("workout_day", date)

    if (workoutError) {
      return NextResponse.json(
        { error: "Failed to load workouts", details: workoutError.message },
        { status: 400 },
      )
    }

    if (!workouts || workouts.length === 0) {
      await supabase
        .from("nutrition_meals")
        .delete()
        .eq("user_id", user.id)
        .eq("date", date)
        .in("meal_type", ["fuel_pre", "fuel_intra", "fuel_post"])
      return NextResponse.json({ ok: true, items: [] }, { status: 200 })
    }

    const usedSlots = new Set<number>()
    const sortedWorkouts = [...workouts].sort((a, b) => {
      const timeA = a.start_time ?? ""
      const timeB = b.start_time ?? ""
      if (timeA && timeB && timeA !== timeB) return timeA.localeCompare(timeB)
      return a.id - b.id
    })

    const fuelItems = sortedWorkouts.flatMap((workout) =>
      buildFuelItems({
        workout,
        slotBase: assignSlotBase(workout.id, usedSlots),
      }),
    )

    const { data: mealLog, error: logError } = await supabase
      .from("meal_log")
      .select("slot, is_eaten, eaten_at")
      .eq("user_id", user.id)
      .eq("date", date)

    if (logError) {
      return NextResponse.json(
        { error: "Failed to load meal log", details: logError.message },
        { status: 400 },
      )
    }

    const logMap = new Map((mealLog ?? []).map((log) => [log.slot, log]))

    await supabase
      .from("nutrition_meals")
      .delete()
      .eq("user_id", user.id)
      .eq("date", date)
      .in("meal_type", ["fuel_pre", "fuel_intra", "fuel_post"])

    if (fuelItems.length > 0) {
      const payload = fuelItems.map((item) => {
        const logEntry = logMap.get(item.slot)
        return {
          user_id: user.id,
          date,
          slot: item.slot,
          name: item.name,
          meal_type: item.meal_type,
          time: item.time,
          kcal: item.macros.kcal,
          protein_g: item.macros.protein_g,
          carbs_g: item.macros.carbs_g,
          fat_g: item.macros.fat_g,
          ingredients: item.ingredients,
          recipe: item.recipe,
          eaten: logEntry?.is_eaten ?? false,
          eaten_at: logEntry?.eaten_at ?? null,
        }
      })

      const { error: upsertError } = await supabase
        .from("nutrition_meals")
        .upsert(payload, { onConflict: "user_id,date,slot" })

      if (upsertError) {
        return NextResponse.json(
          { error: "Failed to save fuel items", details: upsertError.message },
          { status: 400 },
        )
      }
    }

    return NextResponse.json({ ok: true, items: fuelItems }, { status: 200 })
  } catch (error) {
    console.error("POST /api/v1/nutrition/fuel/ensure error:", error)
    return NextResponse.json(
      { error: "Internal error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
