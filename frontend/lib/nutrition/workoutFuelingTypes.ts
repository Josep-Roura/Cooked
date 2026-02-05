/**
 * Workout Fueling Types - Strict TypeScript definitions
 * No drift from UI contract or LLM responses
 */

// ============================================
// INPUT TYPES (from athlete profile + workout)
// ============================================

export interface AthleteProfile {
  weight_kg: number
  age: number
  sex: "male" | "female"
  experience_level: "beginner" | "intermediate" | "advanced"
  sweat_rate: "low" | "medium" | "high"
  gi_sensitivity: "low" | "medium" | "high"
  caffeine_use: "none" | "some" | "high"
  primary_goal: "endurance" | "strength" | "weight_loss" | "maintenance" | "hypertrophy"
}

export interface WorkoutInput {
  sport: string // e.g., "cycling", "running", "swimming", "triathlon"
  duration_min: number // Must be positive
  intensity: "low" | "moderate" | "high" | "very_high"
  start_time?: string // HH:MM format (24h)
  temperature_c?: number
  humidity_pct?: number
}

// ============================================
// DETERMINISTIC TARGET CALCULATIONS
// ============================================

export interface FuelingTargets {
  // Per-hour rates (can be 0 for <60 min)
  carbs_g_per_h: number
  fluids_ml_per_h: number
  sodium_mg_per_h: number
  caffeine_mg_total: number

  // Totals for entire workout
  carbs_total_g: number
  fluids_total_ml: number
  sodium_total_mg: number

  // Meta
  duration_h: number
  caps_applied?: string[] // Which caps were hit (e.g., ["GI_CAP_60g", "HYDRATION_1000ml"])
}

// ============================================
// SCHEDULE SKELETON (times, no items yet)
// ============================================

export interface FuelingScheduleEntry {
  time: string // HH:MM (24h) or "T-40min", "T+20min" (relative)
  action: string // e.g., "Consume pre-workout fueling"
  slot_index?: number // For during-workout multi-entry
}

export interface ScheduleSkeleton {
  pre: FuelingScheduleEntry
  during: FuelingScheduleEntry[] // One per ~20 min interval
  post: FuelingScheduleEntry
}

// ============================================
// FOOD/DRINK ITEMS
// ============================================

export interface FuelingItem {
  // Required
  name: string
  quantity: number
  unit: string // "g", "ml", "serving", "piece", "tbsp", etc.

  // Nutrition (optional, but encouraged)
  carbs_g?: number
  protein_g?: number
  fat_g?: number
  sodium_mg?: number
  fluids_ml?: number // For drinks
  caffeine_mg?: number

  // Meta
  notes?: string // "Easy to carry", "Mix with water", etc.
  frequency?: string // "Every 20 min", "Once", "As needed"
}

// ============================================
// FUELING PLAN (main output)
// ============================================

export interface FuelingPhase {
  timing: string // e.g., "40 minutes before", "Every 20 minutes during", "30-60 minutes after"
  interval?: number // For during-workout: minutes between feedings
  schedule_entries?: FuelingScheduleEntry[]
  items: FuelingItem[]
  
  // Totals (must be manually summed from items or provided by AI)
  total_carbs_g: number
  total_protein_g?: number
  total_fat_g?: number
  total_fluids_ml?: number
  total_sodium_mg?: number
  
  // Per-hour rates (critical for during-workout)
  carbs_per_hour_g?: number
  fluids_per_hour_ml?: number
  sodium_per_hour_mg?: number
  
  // Athlete-facing explanation
  rationale?: string
  warnings?: string[]
}

export interface FuelingPlan {
  // Three phases
  pre_workout: FuelingPhase
  during_workout: FuelingPhase
  post_workout: FuelingPhase

  // Plan-level meta
  summary?: string // Brief executive summary
  safety_checks?: {
    carbs_g_per_hour: number
    fluids_ml_per_hour: number
    sodium_mg_per_hour: number
    energy_kcal: number
  }

  // Plan rationale
  rationale?: string
  warnings?: string[]
}

// ============================================
// API CONTRACT (for UI compatibility)
// ============================================

/**
 * This matches what WorkoutNutritionTimeline component expects.
 * Transformed from our internal FuelingPlan.
 */
export interface WorkoutNutritionUIContract {
  preWorkout?: {
    timing: string
    items: Array<{
      time?: string
      product: string
      quantity: number
      unit: string
      carbs?: number
      protein?: number
      fat?: number
      sodium?: number
      notes?: string
    }>
    totalCarbs: number
    totalProtein?: number
    totalCalories?: number
    rationale?: string
  }

  duringWorkout?: {
    timing: string
    interval: number
    items: Array<{
      time?: string
      product: string
      quantity: number
      unit: string
      carbs?: number
      sodium?: number
      fluids_ml?: number
      notes?: string
      frequency?: string
    }>
    totalCarbs: number
    totalHydration: number
    totalSodium: number
    carbsPerHour?: number
    hydrationPerHour?: number
    sodiumPerHour?: number
    rationale?: string
    warnings?: string[]
  }

  postWorkout?: {
    timing: string
    items: Array<{
      time?: string
      product: string
      quantity: number
      unit: string
      carbs?: number
      protein?: number
      fat?: number
      sodium?: number
      notes?: string
    }>
    totalCarbs: number
    totalProtein?: number
    totalCalories?: number
    rationale?: string
  }

  rationale?: string
  warnings?: string[]
  recommendations?: string
}

// ============================================
// VALIDATION RESULT
// ============================================

export interface ValidationResult {
  ok: boolean
  errors: string[]
  warnings?: string[]
}

// ============================================
// API REQUEST / RESPONSE
// ============================================

export interface WorkoutFuelingRequest {
  // Workout details
  duration_min: number
  intensity: "low" | "moderate" | "high" | "very_high"
  sport: string
  start_time?: string // HH:MM
  temperature_c?: number
  humidity_pct?: number
  available_products?: string // Comma-separated or formatted list

  // Optional DB context
  workout_id?: string
  date?: string // YYYY-MM-DD
}

export interface WorkoutFuelingResponse {
  ok: boolean
  plan: WorkoutNutritionUIContract
  used_fallback: boolean
  validation_errors?: string[]
  generated_at: string
  duration_min: number
  intensity: string
}

// ============================================
// HELPERS FOR TYPE GUARDS
// ============================================

export function isFuelingItem(obj: any): obj is FuelingItem {
  return (
    obj &&
    typeof obj.name === "string" &&
    typeof obj.quantity === "number" &&
    typeof obj.unit === "string"
  )
}

export function isFuelingTargets(obj: any): obj is FuelingTargets {
  return (
    obj &&
    typeof obj.carbs_g_per_h === "number" &&
    typeof obj.fluids_ml_per_h === "number" &&
    typeof obj.sodium_mg_per_h === "number" &&
    typeof obj.carbs_total_g === "number" &&
    typeof obj.fluids_total_ml === "number" &&
    typeof obj.sodium_total_mg === "number"
  )
}

export function isFuelingPlan(obj: any): obj is FuelingPlan {
  return (
    obj &&
    typeof obj.pre_workout === "object" &&
    typeof obj.during_workout === "object" &&
    typeof obj.post_workout === "object"
  )
}
