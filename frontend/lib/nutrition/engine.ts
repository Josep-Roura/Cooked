/**
 * NUTRITION ENGINE - Elite Endurance Sports Nutrition Calculations
 * 
 * This module computes periodized nutrition targets for endurance athletes
 * based on training load, duration, and intensity. It serves as the
 * deterministic baseline that guides AI recipe generation.
 * 
 * Core principles:
 * - Protein: 1.6–2.0 g/kg (stable)
 * - Fat: 0.7–1.0 g/kg (clamped)
 * - Carbs: Periodized by day_type (rest/training/high)
 * - Intra-training: Only when duration/intensity thresholds met
 */

export interface Workout {
  workout_day: string
  workout_type: string | null
  planned_hours: number | null
  actual_hours: number | null
  tss: number | null
  if: number | null
  rpe: number | null
  title: string | null
}

export interface AthleteProfile {
  weight_kg: number
  primary_goal: string | null
  diet: string | null
  meals_per_day: number
}

export interface DailyTargets {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  intra_cho_g_per_h: number
}

export interface MealTemplate {
  slot: number
  meal_type: "breakfast" | "snack" | "lunch" | "dinner" | "intra"
  time: string
  emoji: string
  target_kcal_pct: number
}

export interface IntraNutritionPlan {
  should_include: boolean
  duration_min: number
  recommended_carbs_g_per_h: number
  recommended_hydration_ml_per_h: number
  recommended_electrolytes_mg: number
  product_suggestions: string[]
}

/**
 * Classify training day type based on duration and intensity metrics
 */
export function computeDayType(
  workouts: Workout[]
): "rest" | "training" | "high" {
  if (workouts.length === 0) return "rest"

  const highIntensity = workouts.some((workout) => {
    const type = (workout.workout_type ?? "").toLowerCase()
    const tss = workout.tss ?? 0
    const rpe = workout.rpe ?? 0
    const IF = workout.if ?? 0

    return (
      tss >= 150 ||
      rpe >= 7 ||
      IF >= 0.85 ||
      type.includes("interval") ||
      type.includes("tempo") ||
      type.includes("race") ||
      type.includes("threshold")
    )
  })

  return highIntensity ? "high" : "training"
}

/**
 * Compute daily macronutrient targets for an endurance athlete
 * 
 * Algorithm:
 * 1. Base calories: weight_kg × (rest: 27, training: 30, high: 34) kcal/kg
 * 2. Protein: weight_kg × 1.8 g/kg (slight overshoot for muscle preservation)
 * 3. Fat: weight_kg × 0.9 g/kg (clamped 40–120g)
 * 4. Carbs: Fill remaining calories
 * 5. Intra carbs: Only if session qualifies (see buildIntraNutritionPlan)
 */
export function computeDailyTargets(
  weight_kg: number,
  dayType: "rest" | "training" | "high",
  workouts: Workout[] = []
): DailyTargets {
  // Base calorie multiplier
  const kcalMultiplier = dayType === "rest" ? 27 : dayType === "high" ? 34 : 30
  const kcalBase = Math.round(weight_kg * kcalMultiplier)

  // Protein: stable at 1.8 g/kg (slightly higher for preservation during hard training)
  const protein = Math.round(weight_kg * 1.8)

  // Fat: 0.9 g/kg, clamped to 40–120g
  const fat = Math.max(40, Math.min(120, Math.round(weight_kg * 0.9)))

  // Carbs: fill remaining calories
  const remaining = kcalBase - protein * 4 - fat * 9
  const carbs = Math.max(0, Math.round(remaining / 4))

  // Intra-workout carbs: depends on session duration/intensity
  const intra = buildIntraNutritionPlan(workouts)
  const intra_cho_g_per_h = intra.should_include ? intra.recommended_carbs_g_per_h : 0

  return {
    kcal: kcalBase,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    intra_cho_g_per_h,
  }
}

/**
 * Decide if intra-training nutrition is required and compute quantities
 * 
 * Thresholds (use ANY ONE):
 * - Duration ≥ 75 min
 * - TSS ≥ 80
 * - IF ≥ 0.75 (and duration > 45 min)
 * - RPE ≥ 6 (and duration > 45 min)
 * - Marked as "key session" or interval/tempo/race
 * 
 * Recommendations:
 * - 30–60g CHO per hour depending on intensity
 * - 500–750 ml fluid per hour
 * - 300–600 mg sodium
 */
export function buildIntraNutritionPlan(workouts: Workout[]): IntraNutritionPlan {
  if (workouts.length === 0) {
    return {
      should_include: false,
      duration_min: 0,
      recommended_carbs_g_per_h: 0,
      recommended_hydration_ml_per_h: 0,
      recommended_electrolytes_mg: 0,
      product_suggestions: [],
    }
  }

  // Find the primary (longest/most intense) workout
  const primaryWorkout = workouts.reduce((prev, current) => {
    const prevScore = (prev.tss ?? 0) + (prev.actual_hours ?? prev.planned_hours ?? 0) * 50
    const currScore = (current.tss ?? 0) + (current.actual_hours ?? current.planned_hours ?? 0) * 50
    return currScore > prevScore ? current : prev
  })

  const duration = (primaryWorkout.actual_hours ?? primaryWorkout.planned_hours ?? 0) * 60
  const tss = primaryWorkout.tss ?? 0
  const IF = primaryWorkout.if ?? 0
  const rpe = primaryWorkout.rpe ?? 0
  const type = (primaryWorkout.workout_type ?? "").toLowerCase()

  // Check if intra-training nutrition is warranted
  const isKeySession =
    (tss >= 80 ||
      IF >= 0.75 ||
      (rpe >= 6 && duration > 45) ||
      type.includes("interval") ||
      type.includes("tempo") ||
      type.includes("race")) &&
    duration >= 45

  const needsIntra = duration >= 75 || isKeySession

  if (!needsIntra) {
    return {
      should_include: false,
      duration_min: Math.round(duration),
      recommended_carbs_g_per_h: 0,
      recommended_hydration_ml_per_h: 0,
      recommended_electrolytes_mg: 0,
      product_suggestions: [],
    }
  }

  // Compute intra-training nutrition amounts
  // Higher intensity = more carbs, more hydration, more electrolytes
  const intensityFactor = Math.min(IF, 1.0) // Normalized to 0–1
  const carbs_g_per_h = Math.round(30 + intensityFactor * 30) // 30–60 g/h
  const hydration_ml_per_h = Math.round(500 + intensityFactor * 250) // 500–750 ml/h
  const electrolytes_mg = Math.round(300 + intensityFactor * 300) // 300–600 mg

  // Suggest products based on sport and intensity
  const products = []
  if (type.includes("bike")) {
    products.push("Sports Drink (Gatorade/Pocari)", "Energy Bar (Clif)", "Sports Gel (GU)")
  } else if (type.includes("run")) {
    products.push("Sports Gel (GU)", "Banana", "Electrolyte Drink (Nuun)")
  } else if (type.includes("swim")) {
    products.push("Sports Drink", "Protein Drink (post)", "Banana")
  } else {
    products.push("Sports Drink", "Energy Bar", "Sports Gel")
  }

  if (intensityFactor >= 0.8) {
    products.push("Salt Capsules (Hammer)")
  }

  return {
    should_include: true,
    duration_min: Math.round(duration),
    recommended_carbs_g_per_h: carbs_g_per_h,
    recommended_hydration_ml_per_h: hydration_ml_per_h,
    recommended_electrolytes_mg: electrolytes_mg,
    product_suggestions: products,
  }
}

/**
 * Build default meal time templates based on meals_per_day preference
 * 
 * Designed for athlete convenience:
 * - Times are staggered to avoid conflicts
 * - Meal types align with circadian rhythm
 * - Snacks provide flexibility for training windows
 */
export function buildMealTemplates(mealsPerDay: number): MealTemplate[] {
  const clamped = Math.max(3, Math.min(6, mealsPerDay))

  if (clamped === 3) {
    return [
      { slot: 1, meal_type: "breakfast", time: "08:00", emoji: "🍳", target_kcal_pct: 30 },
      { slot: 2, meal_type: "lunch", time: "13:00", emoji: "🥗", target_kcal_pct: 35 },
      { slot: 3, meal_type: "dinner", time: "19:30", emoji: "🍝", target_kcal_pct: 35 },
    ]
  }

  if (clamped === 4) {
    return [
      { slot: 1, meal_type: "breakfast", time: "08:00", emoji: "🍳", target_kcal_pct: 25 },
      { slot: 2, meal_type: "snack", time: "11:00", emoji: "🍌", target_kcal_pct: 15 },
      { slot: 3, meal_type: "lunch", time: "14:00", emoji: "🥗", target_kcal_pct: 30 },
      { slot: 4, meal_type: "dinner", time: "20:30", emoji: "🍝", target_kcal_pct: 30 },
    ]
  }

  if (clamped === 5) {
    return [
      { slot: 1, meal_type: "breakfast", time: "08:00", emoji: "🍳", target_kcal_pct: 22 },
      { slot: 2, meal_type: "snack", time: "11:00", emoji: "🍌", target_kcal_pct: 13 },
      { slot: 3, meal_type: "lunch", time: "14:00", emoji: "🥗", target_kcal_pct: 28 },
      { slot: 4, meal_type: "snack", time: "17:00", emoji: "🍏", target_kcal_pct: 12 },
      { slot: 5, meal_type: "dinner", time: "20:30", emoji: "🍝", target_kcal_pct: 25 },
    ]
  }

  // 6 meals
  return [
    { slot: 1, meal_type: "breakfast", time: "07:30", emoji: "🍳", target_kcal_pct: 20 },
    { slot: 2, meal_type: "snack", time: "10:00", emoji: "🥜", target_kcal_pct: 10 },
    { slot: 3, meal_type: "lunch", time: "13:00", emoji: "🥗", target_kcal_pct: 28 },
    { slot: 4, meal_type: "snack", time: "16:00", emoji: "🍞", target_kcal_pct: 10 },
    { slot: 5, meal_type: "dinner", time: "19:00", emoji: "🍝", target_kcal_pct: 25 },
    { slot: 6, meal_type: "snack", time: "21:30", emoji: "🥛", target_kcal_pct: 7 },
  ]
}

/**
 * Distribute daily macronutrient targets across meals
 * 
 * Allocates calories and macros to each meal based on:
 * 1. Meal template percentages
 * 2. Meal type (breakfast heavier on carbs, dinner lighter)
 * 3. Snack consistency
 */
export function distributeAcrossMeals(
  targets: DailyTargets,
  templates: MealTemplate[]
): Array<{
  slot: number
  meal_type: MealTemplate["meal_type"]
  time: string
  emoji: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}> {
  return templates.map((template) => {
    const kcal = Math.round(targets.kcal * (template.target_kcal_pct / 100))
    const protein = Math.round(targets.protein_g * (template.target_kcal_pct / 100))
    const fat = Math.round(targets.fat_g * (template.target_kcal_pct / 100))
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

    return {
      slot: template.slot,
      meal_type: template.meal_type,
      time: template.time,
      emoji: template.emoji,
      kcal,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    }
  })
}
