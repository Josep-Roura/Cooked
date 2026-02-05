/**
 * Deterministic Workout Fueling Engine
 * Pure functions, no IO, no randomness
 * Source of truth for macro targets and schedule skeleton
 */

import {
  AthleteProfile,
  WorkoutInput,
  FuelingTargets,
  ScheduleSkeleton,
  FuelingScheduleEntry,
  FuelingPlan,
  FuelingPhase,
  FuelingItem,
} from "./workoutFuelingTypes"

/**
 * CORE ENGINE: Compute deterministic fueling targets
 * Rules based on: athlete weight, workout duration, intensity, sweat rate, GI sensitivity, temperature
 */
export function computeFuelingTargets(
  athlete: AthleteProfile,
  workout: WorkoutInput,
): FuelingTargets {
  const durationH = workout.duration_min / 60
  const capsApplied: string[] = []

  // ============================================
  // CARBS PER HOUR (main determinant: duration + intensity)
  // ============================================

  let carbsGPerH = 0

  if (workout.intensity === "low") {
    // Low intensity: no carbs unless very long (>120 min)
    carbsGPerH = 0
  } else if (workout.intensity === "moderate") {
    if (workout.duration_min < 60) {
      carbsGPerH = 0
    } else if (workout.duration_min <= 90) {
      carbsGPerH = 30 // Single deterministic value for 60-90 min moderate
    } else {
      carbsGPerH = 50 // Single deterministic value for >90 min moderate
    }
  } else if (workout.intensity === "high" || workout.intensity === "very_high") {
    if (workout.duration_min < 60) {
      carbsGPerH = 0 // Even high intensity: <60 min is too short
    } else if (workout.duration_min <= 90) {
      carbsGPerH = 45 // Single deterministic value for 60-90 min high
    } else {
      carbsGPerH = 70 // Single deterministic value for >90 min high
    }
  }

  // ============================================
  // GI SENSITIVITY CAPS
  // ============================================

  if (athlete.gi_sensitivity === "high") {
    if (carbsGPerH > 60) {
      carbsGPerH = 60
      capsApplied.push("GI_CAP_60g_per_h")
    }
  } else if (athlete.gi_sensitivity === "medium") {
    if (carbsGPerH > 75) {
      carbsGPerH = 75
      capsApplied.push("GI_CAP_75g_per_h")
    }
  } else {
    // low: cap at 90
    if (carbsGPerH > 90) {
      carbsGPerH = 90
      capsApplied.push("GI_CAP_90g_per_h")
    }
  }

  // ============================================
  // FLUIDS PER HOUR (primary: sweat_rate, secondary: temperature)
  // ============================================

  let fluidsMLPerH = 0
  switch (athlete.sweat_rate) {
    case "low":
      fluidsMLPerH = 475 // midpoint of 400-550
      break
    case "medium":
      fluidsMLPerH = 650 // midpoint of 550-750
      break
    case "high":
      fluidsMLPerH = 850 // midpoint of 750-950
      break
  }

  // Temperature adjustment
  if (workout.temperature_c !== undefined) {
    if (workout.temperature_c >= 30) {
      fluidsMLPerH = Math.round(fluidsMLPerH * 1.25) // +25%
    } else if (workout.temperature_c >= 25) {
      fluidsMLPerH = Math.round(fluidsMLPerH * 1.15) // +15%
    }
  }

  // Cap at 1000 ml/h
  if (fluidsMLPerH > 1000) {
    fluidsMLPerH = 1000
    capsApplied.push("HYDRATION_CAP_1000ml_per_h")
  }

  // ============================================
  // SODIUM PER HOUR (primary: sweat_rate, secondary: temperature)
  // ============================================

  let sodiumMgPerH = 0
  switch (athlete.sweat_rate) {
    case "low":
      sodiumMgPerH = 300
      break
    case "medium":
      sodiumMgPerH = 450
      break
    case "high":
      sodiumMgPerH = 600
      break
  }

  // Temperature adjustment (same as hydration)
  if (workout.temperature_c !== undefined) {
    if (workout.temperature_c >= 30) {
      sodiumMgPerH = Math.round(sodiumMgPerH * 1.15) // +15%
    } else if (workout.temperature_c >= 25) {
      sodiumMgPerH = Math.round(sodiumMgPerH * 1.1) // +10%
    }
  }

  // Cap at 1000 mg/h
  if (sodiumMgPerH > 1000) {
    sodiumMgPerH = 1000
    capsApplied.push("SODIUM_CAP_1000mg_per_h")
  }

  // ============================================
  // CAFFEINE (only for mid/long workouts + if athlete uses it)
  // ============================================

  let caffeineTotal = 0
  if (athlete.caffeine_use !== "none") {
    if (workout.duration_min >= 90 && (workout.intensity === "high" || workout.intensity === "very_high")) {
      const mgPerKg = athlete.caffeine_use === "high" ? 3 : 2
      let totalMg = athlete.weight_kg * mgPerKg

      // Beginner tolerance: half dosage
      if (athlete.experience_level === "beginner") {
        totalMg = totalMg / 2
      }

      // Cap at 200 mg total
      caffeineTotal = Math.min(totalMg, 200)
    }
  }

  // ============================================
  // CALCULATE TOTALS
  // ============================================

  const carbsTotalG = roundTo5(carbsGPerH * durationH)
  const fluidsTotalML = roundTo10(fluidsMLPerH * durationH)
  const sodiumTotalMg = roundTo10(sodiumMgPerH * durationH)

  return {
    carbs_g_per_h: carbsGPerH,
    fluids_ml_per_h: fluidsMLPerH,
    sodium_mg_per_h: sodiumMgPerH,
    caffeine_mg_total: caffeineTotal,
    carbs_total_g: carbsTotalG,
    fluids_total_ml: fluidsTotalML,
    sodium_total_mg: sodiumTotalMg,
    duration_h: durationH,
    caps_applied: capsApplied.length > 0 ? capsApplied : undefined,
  }
}

/**
 * BUILD SCHEDULE SKELETON
 * Determines timing of pre/during/post fueling (no items yet)
 */
export function buildScheduleSkeleton(
  athlete: AthleteProfile,
  workout: WorkoutInput,
  targets: FuelingTargets,
): ScheduleSkeleton {
  const preEntry: FuelingScheduleEntry = {
    time: workout.start_time ? formatOffsetTime(workout.start_time, -40) : "T-40min",
    action: "Consume pre-workout fueling",
  }

  const duringEntries: FuelingScheduleEntry[] = []
  if (targets.carbs_total_g > 0 || targets.fluids_total_ml > 0) {
    const interval = athlete.gi_sensitivity === "high" ? 15 : 20
    const numIntervals = Math.ceil(workout.duration_min / interval)

    for (let i = 0; i < numIntervals; i++) {
      const offsetMin = i * interval
      duringEntries.push({
        time: workout.start_time ? formatOffsetTime(workout.start_time, offsetMin) : `T+${offsetMin}min`,
        action: `Consume fueling (interval ${i + 1}/${numIntervals})`,
        slot_index: i,
      })
    }
  }

  const postEntry: FuelingScheduleEntry = {
    time: workout.start_time ? formatOffsetTime(workout.start_time, workout.duration_min + 40) : `T+${workout.duration_min + 40}min`,
    action: "Consume post-workout recovery meal",
  }

  return {
    pre: preEntry,
    during: duringEntries,
    post: postEntry,
  }
}

/**
 * DETERMINISTIC FALLBACK PLAN
 * Generic but realistic items, guaranteed valid, no external dependencies
 */
export function deterministicFallbackItems(
  athlete: AthleteProfile,
  workout: WorkoutInput,
  targets: FuelingTargets,
  skeleton: ScheduleSkeleton,
): FuelingPlan {
  const durationMin = workout.duration_min

  // ============================================
  // PRE-WORKOUT PHASE
  // ============================================

  const preItems: FuelingItem[] = []
  if (durationMin >= 60) {
    // For >=60 min, recommend some pre-fuel
    const preCarbs = Math.round(targets.carbs_total_g * 0.15) // ~15% of total carbs pre-workout

    if (preCarbs > 0) {
      // Suggest isotonic drink or carb-rich food
      if (athlete.gi_sensitivity === "high") {
        preItems.push({
          name: "White rice cakes or toast",
          quantity: preCarbs > 30 ? 3 : 2,
          unit: "pieces",
          carbs_g: preCarbs,
          notes: "Low fiber, easy to digest. Eat 40 minutes before.",
        })
      } else {
        preItems.push({
          name: "Isotonic sports drink (6% carbs)",
          quantity: Math.round((preCarbs / 6) * 100), // assuming 6g carbs per 100ml
          unit: "ml",
          carbs_g: preCarbs,
          sodium_mg: Math.round(preCarbs * 0.5), // rough estimate
          fluids_ml: Math.round((preCarbs / 6) * 100),
          notes: "Mix if powder. Sip slowly for 30-40 min before.",
        })
      }
    }

    // Always add water for pre-hydration
    preItems.push({
      name: "Water",
      quantity: 400,
      unit: "ml",
      fluids_ml: 400,
      notes: "Drink in sips over 30-40 minutes before.",
    })
  }

  const prePhase: FuelingPhase = {
    timing: skeleton.pre.time.includes("T-") ? `${Math.abs(parseInt(skeleton.pre.time))} minutes before` : skeleton.pre.time,
    schedule_entries: [skeleton.pre],
    items: preItems.length > 0 ? preItems : [{ name: "Light snack or water", quantity: 200, unit: "ml", fluids_ml: 200 }],
    total_carbs_g: preItems.reduce((sum, item) => sum + (item.carbs_g || 0), 0),
    total_protein_g: preItems.reduce((sum, item) => sum + (item.protein_g || 0), 0),
    total_fluids_ml: preItems.reduce((sum, item) => sum + (item.fluids_ml || 0), 0),
  }

  // ============================================
  // DURING-WORKOUT PHASE
  // ============================================

  const duringItems: FuelingItem[] = []

   if (targets.carbs_total_g > 0) {
     // Carb strategy
     if (targets.carbs_g_per_h <= 30) {
       // Low carb need: single isotonic drink
       duringItems.push({
         name: "Isotonic sports drink (6% carbs)",
         quantity: targets.fluids_total_ml, // Use target fluids, not derived from carbs
         unit: "ml",
         carbs_g: targets.carbs_total_g,
         sodium_mg: targets.sodium_total_mg,
         fluids_ml: targets.fluids_total_ml,
         frequency: `Every ${athlete.gi_sensitivity === "high" ? 15 : 20} min`,
         notes: "Mix with water if powder. Easy to digest.",
       })
     } else {
      // Higher carb need: gels + drink combo
      const numGels = Math.ceil(targets.carbs_total_g / 25) // ~25g carbs per gel
      if (numGels > 0) {
        duringItems.push({
          name: "Energy gel (25g carbs + 20mg sodium)",
          quantity: numGels,
          unit: "piece",
          carbs_g: numGels * 25,
          sodium_mg: numGels * 20,
          frequency: `Every ${athlete.gi_sensitivity === "high" ? 15 : 20} min`,
          notes: "Take 1-2 gels per interval with water. Choose flavor you like.",
        })
      }

      // Water for hydration
      duringItems.push({
        name: "Water",
        quantity: targets.fluids_total_ml,
        unit: "ml",
        fluids_ml: targets.fluids_total_ml,
        frequency: `Sip every ${athlete.gi_sensitivity === "high" ? 15 : 20} min`,
        notes: "Drink to thirst, don't overdo. Split across intervals.",
      })

      // Electrolyte boost if needed
      if (targets.sodium_total_mg > 500 && targets.fluids_total_ml > 1000) {
        duringItems.push({
          name: "Electrolyte supplement (sodium/potassium)",
          quantity: targets.sodium_total_mg,
          unit: "mg",
          sodium_mg: targets.sodium_total_mg,
          frequency: `Spread across all intervals`,
          notes: "Use sports drink or electrolyte capsules. Prevents hyponatremia.",
        })
      }
    }
  } else {
    // No carbs needed (<60 min), just water + minimal electrolytes
    duringItems.push({
      name: "Water",
      quantity: targets.fluids_total_ml,
      unit: "ml",
      fluids_ml: targets.fluids_total_ml,
      frequency: "As needed",
      notes: "For workouts <60 min, water is sufficient.",
    })

    if (targets.sodium_total_mg > 0) {
      duringItems.push({
        name: "Electrolyte drink or salt capsule",
        quantity: targets.sodium_total_mg,
        unit: "mg",
        sodium_mg: targets.sodium_total_mg,
        notes: "Optional for high sweat rate or hot conditions.",
      })
    }
  }

  const duringPhase: FuelingPhase = {
    timing: `Every ${athlete.gi_sensitivity === "high" ? 15 : 20} min during`,
    interval: athlete.gi_sensitivity === "high" ? 15 : 20,
    schedule_entries: skeleton.during,
    items: duringItems,
    total_carbs_g: duringItems.reduce((sum, item) => sum + (item.carbs_g || 0), 0),
    total_fluids_ml: duringItems.reduce((sum, item) => sum + (item.fluids_ml || 0), 0),
    total_sodium_mg: duringItems.reduce((sum, item) => sum + (item.sodium_mg || 0), 0),
    carbs_per_hour_g: targets.carbs_g_per_h,
    fluids_per_hour_ml: targets.fluids_ml_per_h,
    sodium_per_hour_mg: targets.sodium_mg_per_h,
  }

  // ============================================
  // POST-WORKOUT PHASE
  // ============================================

  const postItems: FuelingItem[] = []

  // Recovery macros
  const postCarbsG = Math.round(athlete.weight_kg * (durationMin > 90 ? 1.2 : 1.0))
  const postProteinG = Math.round(athlete.weight_kg * 0.3)

  if (durationMin >= 60) {
    // Real recovery meal
    if (athlete.gi_sensitivity === "high") {
      // Simple, easy-to-digest option
      postItems.push({
        name: "White rice + grilled chicken",
        quantity: 200,
        unit: "g",
        carbs_g: Math.round(200 * 0.28), // ~28% carbs in cooked white rice
        protein_g: Math.round(200 * 0.12), // ~12% protein in chicken
        notes: "Simple, tasty, easy to digest. Eat within 30 min post-workout.",
      })
      postItems.push({
        name: "Banana",
        quantity: 1,
        unit: "medium",
        carbs_g: 27,
        protein_g: 1,
        notes: "Extra carbs for glycogen replenishment.",
      })
    } else {
      // More flexible option
      postItems.push({
        name: "Greek yogurt with granola and berries",
        quantity: 200,
        unit: "g",
        carbs_g: Math.round(200 * 0.1 + 50 + 20), // yogurt + granola + berries
        protein_g: Math.round(200 * 0.1), // Greek yogurt ~10% protein
        notes: "Balanced option. Eat within 30-60 min for optimal recovery.",
      })
    }
  } else {
    // Short workout: light snack
    postItems.push({
      name: "Banana + peanut butter",
      quantity: 1,
      unit: "serving",
      carbs_g: 30,
      protein_g: 8,
      notes: "Quick recovery snack. Sit for 20 min after if possible.",
    })
  }

  const postPhase: FuelingPhase = {
    timing: `${skeleton.post.time.includes("T+") ? "Within " + Math.round(parseInt(skeleton.post.time.replace("T+", "").replace("min", "")) / 60) + " min after" : "30-60 min after"}`,
    schedule_entries: [skeleton.post],
    items: postItems,
    total_carbs_g: postItems.reduce((sum, item) => sum + (item.carbs_g || 0), 0),
    total_protein_g: postItems.reduce((sum, item) => sum + (item.protein_g || 0), 0),
    total_fluids_ml: 400, // typical drink
  }

  // ============================================
  // ASSEMBLE FULL PLAN
  // ============================================

  return {
    pre_workout: prePhase,
    during_workout: duringPhase,
    post_workout: postPhase,
    summary: `${durationMin}-min ${workout.intensity} ${workout.sport}: ${targets.carbs_total_g}g carbs, ${targets.fluids_total_ml}ml fluids, ${targets.sodium_total_mg}mg sodium`,
    safety_checks: {
      carbs_g_per_hour: targets.carbs_g_per_h,
      fluids_ml_per_hour: targets.fluids_ml_per_h,
      sodium_mg_per_hour: targets.sodium_mg_per_h,
      energy_kcal: Math.round(targets.carbs_total_g * 4 + (targets.carbs_total_g * 0.3) * 4), // rough estimate
    },
    rationale: `Based on ${durationMin} min ${workout.intensity} intensity and ${athlete.sweat_rate} sweat rate. ${
      athlete.gi_sensitivity === "high" ? "GI-sensitive recommendations applied." : ""
    }`,
  }
}

// ============================================
// HELPERS
// ============================================

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5
}

function roundTo10(n: number): number {
  return Math.round(n / 10) * 10
}

function formatOffsetTime(baseTime: string, offsetMin: number): string {
  const [hours, minutes] = baseTime.split(":").map(Number)
  const totalMin = hours * 60 + minutes + offsetMin
  const newHours = Math.floor(totalMin / 60) % 24
  const newMin = totalMin % 60

  return `${String(newHours).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`
}
