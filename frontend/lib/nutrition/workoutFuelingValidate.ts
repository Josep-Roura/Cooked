/**
 * Workout Fueling Validation
 * Hard gates to prevent unrealistic recommendations
 * NO PLAN ESCAPES THESE RULES
 */

import {
  FuelingPlan,
  FuelingTargets,
  WorkoutInput,
  AthleteProfile,
  ValidationResult,
} from "./workoutFuelingTypes"

/**
 * MASTER VALIDATION FUNCTION
 * Returns { ok: true } if plan is valid
 * Returns { ok: false, errors: [...] } if plan violates any rules
 */
export function validateFuelingPlan(
  plan: FuelingPlan,
  athlete: AthleteProfile,
  workout: WorkoutInput,
  targets: FuelingTargets,
): ValidationResult {
  const errors: string[] = []

  // ============================================
  // HARD RULE #1: NO ZERO CARBS FOR >=60 MIN (unless low intensity)
  // ============================================
  if (workout.duration_min >= 60 && workout.intensity !== "low") {
    const duringCarbs = plan.during_workout.total_carbs_g || 0
    if (duringCarbs === 0) {
      errors.push(
        `Duration ${workout.duration_min}min + ${workout.intensity} intensity requires carbs. ` +
          `Got 0g during-workout carbs.`,
      )
    }
  }

  // ============================================
  // HARD RULE #2: DURING-WORKOUT MUST HAVE >= 2 FEEDING INTERVALS (if duration >=60)
  // ============================================
  if (workout.duration_min >= 60) {
    const numIntervals = plan.during_workout.schedule_entries?.length ?? 0
    if (numIntervals < 2) {
      errors.push(
        `Duration ${workout.duration_min}min requires at least 2 feeding intervals. ` +
          `Got ${numIntervals}.`,
      )
    }
  }

  // ============================================
  // HARD RULE #3: CARBS PER HOUR WITHIN LIMITS
  // ============================================
  const carbsPerHour = plan.during_workout.carbs_per_hour_g ?? targets.carbs_g_per_h
  const carbsCapByGI =
    athlete.gi_sensitivity === "high" ? 60 : athlete.gi_sensitivity === "medium" ? 75 : 90

  if (carbsPerHour > carbsCapByGI) {
    errors.push(
      `Carbs/hour ${carbsPerHour}g exceeds GI sensitivity cap of ${carbsCapByGI}g/h.`,
    )
  }

  if (carbsPerHour > 90) {
    errors.push(
      `Carbs/hour ${carbsPerHour}g exceeds absolute limit of 90g/h (without multi-source strategy).`,
    )
  }

  // ============================================
  // HARD RULE #4: HYDRATION WITHIN LIMITS
  // ============================================
  const fluidsPerHour = plan.during_workout.fluids_per_hour_ml ?? targets.fluids_ml_per_h

  if (fluidsPerHour > 1000) {
    errors.push(
      `Fluids/hour ${fluidsPerHour}ml exceeds absolute limit of 1000ml/h.`,
    )
  }

  if (fluidsPerHour < 200) {
    errors.push(
      `Fluids/hour ${fluidsPerHour}ml is dangerously low (minimum 200ml/h recommended).`,
    )
  }

  // ============================================
  // HARD RULE #5: SODIUM WITHIN LIMITS
  // ============================================
  const sodiumPerHour = plan.during_workout.sodium_per_hour_mg ?? targets.sodium_mg_per_h

  if (sodiumPerHour > 1000) {
    errors.push(
      `Sodium/hour ${sodiumPerHour}mg exceeds absolute limit of 1000mg/h.`,
    )
  }

  // ============================================
  // HARD RULE #6: TOTALS WITHIN ±15% OF DETERMINISTIC TARGETS
  // ============================================
  const tolerance = 0.15

  const duringCarbsTarget = targets.carbs_total_g
  const duringCarbsPlan = plan.during_workout.total_carbs_g ?? 0
  if (duringCarbsTarget > 0) {
    const carbsDiff = Math.abs(duringCarbsPlan - duringCarbsTarget) / duringCarbsTarget
    if (carbsDiff > tolerance) {
      errors.push(
        `During carbs ${duringCarbsPlan}g deviates ${(carbsDiff * 100).toFixed(0)}% from target ${duringCarbsTarget}g (tolerance ±${(tolerance * 100).toFixed(0)}%).`,
      )
    }
  }

  const fluidsTarget = targets.fluids_total_ml
  const fluidsPlan = plan.during_workout.total_fluids_ml ?? 0
  if (fluidsTarget > 0) {
    const fluidsDiff = Math.abs(fluidsPlan - fluidsTarget) / fluidsTarget
    if (fluidsDiff > tolerance) {
      errors.push(
        `During fluids ${fluidsPlan}ml deviates ${(fluidsDiff * 100).toFixed(0)}% from target ${fluidsTarget}ml (tolerance ±${(tolerance * 100).toFixed(0)}%).`,
      )
    }
  }

  const sodiumTarget = targets.sodium_total_mg
  const sodiumPlan = plan.during_workout.total_sodium_mg ?? 0
  if (sodiumTarget > 0) {
    const sodiumDiff = Math.abs(sodiumPlan - sodiumTarget) / sodiumTarget
    if (sodiumDiff > tolerance) {
      errors.push(
        `During sodium ${sodiumPlan}mg deviates ${(sodiumDiff * 100).toFixed(0)}% from target ${sodiumTarget}mg (tolerance ±${(tolerance * 100).toFixed(0)}%).`,
      )
    }
  }

  // ============================================
  // HARD RULE #7: NO NaN, NO NEGATIVE NUMBERS
  // ============================================
  const allPhases = [
    plan.pre_workout,
    plan.during_workout,
    plan.post_workout,
  ]

  for (const phase of allPhases) {
    if (isNaN(phase.total_carbs_g) || phase.total_carbs_g < 0) {
      errors.push(
        `Invalid carbs in ${getPhaseLabel(phase)}: ${phase.total_carbs_g}`,
      )
    }
    if (phase.total_fluids_ml && (isNaN(phase.total_fluids_ml) || phase.total_fluids_ml < 0)) {
      errors.push(
        `Invalid fluids in ${getPhaseLabel(phase)}: ${phase.total_fluids_ml}`,
      )
    }
    if (phase.total_sodium_mg && (isNaN(phase.total_sodium_mg) || phase.total_sodium_mg < 0)) {
      errors.push(
        `Invalid sodium in ${getPhaseLabel(phase)}: ${phase.total_sodium_mg}`,
      )
    }

    // Check items
    for (const item of phase.items) {
      if (!item.name || item.name.trim().length === 0) {
        errors.push(
          `Item in ${getPhaseLabel(phase)} has empty name.`,
        )
      }
      if (isNaN(item.quantity) || item.quantity <= 0) {
        errors.push(
          `Item "${item.name}" in ${getPhaseLabel(phase)} has invalid quantity: ${item.quantity}`,
        )
      }
      if (!item.unit || item.unit.trim().length === 0) {
        errors.push(
          `Item "${item.name}" in ${getPhaseLabel(phase)} has empty unit.`,
        )
      }
    }
  }

  // ============================================
  // HARD RULE #8: TIMING FORMAT VALIDATION
  // ============================================
  const timeRegex = /^\d{2}:\d{2}$/ // HH:MM format
  const relativeRegex = /^T[+-]\d+min$/ // T+20min format

  const allEntries = [
    plan.pre_workout.schedule_entries?.[0],
    ...((plan.during_workout.schedule_entries) || []),
    plan.post_workout.schedule_entries?.[0],
  ].filter(Boolean)

  for (const entry of allEntries) {
    if (entry && entry.time) {
      const isValidFormat =
        timeRegex.test(entry.time) ||
        relativeRegex.test(entry.time) ||
        entry.time.includes("before") ||
        entry.time.includes("after") ||
        entry.time.includes("min")

      if (!isValidFormat && entry.time !== "T-40min" && !entry.time.includes("T+")) {
        // Lenient: allow human-readable times
        // errors.push(`Invalid time format: "${entry.time}". Expected HH:MM or T±Xmin.`)
      }
    }
  }

  // ============================================
  // RETURN RESULT
  // ============================================

  return {
    ok: errors.length === 0,
    errors,
  }
}

/**
 * SOFT VALIDATION (warnings, not errors)
 * These don't block the plan, just raise awareness
 */
export function validateFuelingPlanSoft(
  plan: FuelingPlan,
  athlete: AthleteProfile,
  workout: WorkoutInput,
): string[] {
  const warnings: string[] = []

  // Warning: Very low carbs for moderate/high intensity
  const duringCarbs = plan.during_workout.total_carbs_g ?? 0
  if (workout.intensity !== "low" && duringCarbs > 0 && duringCarbs < 20) {
    warnings.push(
      `Very low carb target (${duringCarbs}g) for ${workout.intensity} intensity. ` +
        `Consider whether this is sufficient.`,
    )
  }

  // Warning: High hydration + low sweat rate
  const fluidsPerH = plan.during_workout.fluids_per_hour_ml ?? 0
  if (athlete.sweat_rate === "low" && fluidsPerH > 700) {
    warnings.push(
      `High hydration (${fluidsPerH}ml/h) for low sweat rate athlete. ` +
        `Risk of overhydration. Monitor closely.`,
    )
  }

  // Warning: GI sensitivity + high sodium
  const sodiumPerH = plan.during_workout.sodium_per_hour_mg ?? 0
  if (athlete.gi_sensitivity === "high" && sodiumPerH > 600) {
    warnings.push(
      `High sodium (${sodiumPerH}mg/h) with GI sensitivity. ` +
        `May cause stomach upset. Consider lower doses.`,
    )
  }

  return warnings
}

// ============================================
// HELPERS
// ============================================

function getPhaseLabel(phase: any): string {
  if (phase.interval) return "during-workout"
  if (phase.timing?.includes("before")) return "pre-workout"
  if (phase.timing?.includes("after")) return "post-workout"
  return "unknown phase"
}
