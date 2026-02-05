/**
 * Test script for workout fueling engine
 * Tests 3 realistic scenarios to validate deterministic calculations and validation
 * 
 * Run: cd frontend && npx tsx scripts/testWorkoutFueling.ts
 */

import { computeFuelingTargets, buildScheduleSkeleton, deterministicFallbackItems } from "@/lib/nutrition/workoutFuelingEngine"
import { validateFuelingPlan, validateFuelingPlanSoft } from "@/lib/nutrition/workoutFuelingValidate"
import type { AthleteProfile, WorkoutInput } from "@/lib/nutrition/workoutFuelingTypes"

// ANSI colors for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function section(title: string) {
  log("\n" + "=".repeat(70), colors.cyan)
  log(title, colors.cyan)
  log("=".repeat(70) + "\n", colors.cyan)
}

function pass(message: string) {
  log(`✅ ${message}`, colors.green)
}

function fail(message: string) {
  log(`❌ ${message}`, colors.red)
}

function warn(message: string) {
  log(`⚠️  ${message}`, colors.yellow)
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue)
}

/**
 * SCENARIO 1: 90-min moderate intensity bike, medium sweat, medium GI sensitivity
 * Expected: 30g carbs/h (60-90 min moderate), 650ml fluids/h, 450mg sodium/h
 */
function testScenario1() {
  section("SCENARIO 1: 90-min MODERATE intensity bike, medium sweat/GI")

  const athlete: AthleteProfile = {
    weight_kg: 70,
    age: 35,
    sex: "male",
    experience_level: "intermediate",
    sweat_rate: "medium",
    gi_sensitivity: "medium",
    caffeine_use: "some",
    primary_goal: "maintenance",
  }

  const workout: WorkoutInput = {
    sport: "cycling",
    duration_min: 90,
    intensity: "moderate",
    start_time: "10:00",
    temperature_c: 22,
    humidity_pct: 60,
  }

  info(`Athlete: ${athlete.weight_kg}kg, ${athlete.age}y, ${athlete.sweat_rate} sweat, ${athlete.gi_sensitivity} GI`)
  info(`Workout: ${workout.sport} ${workout.duration_min}min ${workout.intensity} intensity`)

  const targets = computeFuelingTargets(athlete, workout)
  info("\nTargets calculated:")
  info(`  Carbs: ${targets.carbs_g_per_h}g/h (total: ${targets.carbs_total_g}g)`)
  info(`  Fluids: ${targets.fluids_ml_per_h}ml/h (total: ${targets.fluids_total_ml}ml)`)
  info(`  Sodium: ${targets.sodium_mg_per_h}mg/h (total: ${targets.sodium_total_mg}mg)`)

  // Assertions
  let allPass = true

  if (targets.carbs_g_per_h !== 30) {
    fail(`Expected carbs 30g/h for 60-90 min moderate, got ${targets.carbs_g_per_h}g/h`)
    allPass = false
  } else {
    pass(`Carbs per hour: ${targets.carbs_g_per_h}g/h`)
  }

  if (targets.fluids_ml_per_h !== 650) {
    fail(`Expected fluids 650ml/h, got ${targets.fluids_ml_per_h}ml/h`)
    allPass = false
  } else {
    pass(`Fluids per hour: ${targets.fluids_ml_per_h}ml/h`)
  }

  if (targets.sodium_mg_per_h !== 450) {
    fail(`Expected sodium 450mg/h, got ${targets.sodium_mg_per_h}mg/h`)
    allPass = false
  } else {
    pass(`Sodium per hour: ${targets.sodium_mg_per_h}mg/h`)
  }

  // Build schedule
  const skeleton = buildScheduleSkeleton(athlete, workout, targets)
  info(`\nSchedule skeleton:`)
  info(`  Pre: ${skeleton.pre.time}`)
  info(`  During: ${skeleton.during.length} intervals`)
  info(`  Post: ${skeleton.post.time}`)

  // Should have 5 intervals (every 20 min for 90 min = 5-6)
  if (skeleton.during.length < 4 || skeleton.during.length > 6) {
    warn(`Expected 4-6 during intervals, got ${skeleton.during.length}`)
  } else {
    pass(`During intervals: ${skeleton.during.length}`)
  }

  // Generate plan
  const plan = deterministicFallbackItems(athlete, workout, targets, skeleton)
  info(`\nPlan generated:`)
  info(`  Pre items: ${plan.pre_workout.items.length}`)
  info(`  During items: ${plan.during_workout.items.length}`)
  info(`  Post items: ${plan.post_workout.items.length}`)

  // Validate
  const validation = validateFuelingPlan(plan, athlete, workout, targets)
  if (!validation.ok) {
    fail(`Validation failed: ${validation.errors.join(", ")}`)
    allPass = false
  } else {
    pass(`Plan validation passed`)
  }

  return allPass
}

/**
 * SCENARIO 2: 90-min HIGH intensity bike, high sweat, HIGH GI sensitivity
 * Expected: 70g carbs/h → CAPPED AT 60 (GI rule)
 *          850ml fluids/h, 600mg sodium/h
 *          Every 15 min intervals (due to high GI)
 */
function testScenario2() {
  section("SCENARIO 2: 90-min HIGH intensity bike, high sweat/GI → carbcap test")

  const athlete: AthleteProfile = {
    weight_kg: 70,
    age: 28,
    sex: "male",
    experience_level: "advanced",
    sweat_rate: "high",
    gi_sensitivity: "high", // ← HIGH GI = carb cap
    caffeine_use: "high",
    primary_goal: "endurance",
  }

  const workout: WorkoutInput = {
    sport: "cycling",
    duration_min: 90,
    intensity: "high",
    start_time: "06:00",
    temperature_c: 25, // Hot, triggers hydration bump
    humidity_pct: 70,
  }

  info(`Athlete: ${athlete.weight_kg}kg, ${athlete.age}y, ${athlete.sweat_rate} sweat, ${athlete.gi_sensitivity} GI`)
  info(`Workout: ${workout.sport} ${workout.duration_min}min ${workout.intensity} intensity, ${workout.temperature_c}°C`)

  const targets = computeFuelingTargets(athlete, workout)
  info("\nTargets calculated:")
  info(`  Carbs: ${targets.carbs_g_per_h}g/h (total: ${targets.carbs_total_g}g)`)
  info(`  Fluids: ${targets.fluids_ml_per_h}ml/h (total: ${targets.fluids_total_ml}ml)`)
  info(`  Sodium: ${targets.sodium_mg_per_h}mg/h (total: ${targets.sodium_total_mg}mg)`)
  if (targets.caps_applied?.length) {
    info(`  Caps applied: ${targets.caps_applied.join(", ")}`)
  }

  // Assertions
  let allPass = true

  // Should be capped at 60g/h for high GI sensitivity
  if (targets.carbs_g_per_h > 60) {
    fail(`Expected carbs ≤60g/h (GI cap), got ${targets.carbs_g_per_h}g/h`)
    allPass = false
  } else {
    pass(`Carbs capped at ${targets.carbs_g_per_h}g/h (GI sensitivity respected)`)
  }

  // High sweat + temp should give ~850-900 with temp adjustment
  if (targets.fluids_ml_per_h < 800) {
    fail(`Expected fluids ≥800ml/h (high sweat + temp), got ${targets.fluids_ml_per_h}ml/h`)
    allPass = false
  } else {
    pass(`Fluids per hour: ${targets.fluids_ml_per_h}ml/h (includes temp adjustment)`)
  }

  // Build schedule - high GI should have more frequent intervals (15 min)
  const skeleton = buildScheduleSkeleton(athlete, workout, targets)
  info(`\nSchedule skeleton:`)
  info(`  Pre: ${skeleton.pre.time}`)
  info(`  During: ${skeleton.during.length} intervals (every 15 min due to high GI)`)
  info(`  Post: ${skeleton.post.time}`)

  // High GI = 15 min intervals, so 90 min should give 6 intervals
  if (skeleton.during.length < 5) {
    warn(`Expected ≥5 intervals for high GI (15 min), got ${skeleton.during.length}`)
  } else {
    pass(`During intervals: ${skeleton.during.length} (high GI frequency respected)`)
  }

  // Generate plan
  const plan = deterministicFallbackItems(athlete, workout, targets, skeleton)
  info(`\nPlan generated:`)
  info(`  During carbs/h: ${plan.during_workout.carbs_per_hour_g}g/h`)
  info(`  During items: ${plan.during_workout.items.length}`)

  // Validate
  const validation = validateFuelingPlan(plan, athlete, workout, targets)
  if (!validation.ok) {
    fail(`Validation failed: ${validation.errors.join(", ")}`)
    allPass = false
  } else {
    pass(`Plan validation passed`)
  }

  return allPass
}

/**
 * SCENARIO 3: 45-min moderate intensity run
 * Expected: 0g carbs (too short for moderate), just water, no schedule entries
 */
function testScenario3() {
  section("SCENARIO 3: 45-min MODERATE intensity run → no carbs rule")

  const athlete: AthleteProfile = {
    weight_kg: 60,
    age: 32,
    sex: "female",
    experience_level: "beginner",
    sweat_rate: "low",
    gi_sensitivity: "low",
    caffeine_use: "none",
    primary_goal: "weight_loss",
  }

  const workout: WorkoutInput = {
    sport: "running",
    duration_min: 45,
    intensity: "moderate",
    start_time: "18:00",
    temperature_c: 20,
  }

  info(`Athlete: ${athlete.weight_kg}kg, ${athlete.age}y, female, ${athlete.sweat_rate} sweat`)
  info(`Workout: ${workout.sport} ${workout.duration_min}min ${workout.intensity} intensity`)

  const targets = computeFuelingTargets(athlete, workout)
  info("\nTargets calculated:")
  info(`  Carbs: ${targets.carbs_g_per_h}g/h (total: ${targets.carbs_total_g}g)`)
  info(`  Fluids: ${targets.fluids_ml_per_h}ml/h (total: ${targets.fluids_total_ml}ml)`)
  info(`  Sodium: ${targets.sodium_mg_per_h}mg/h (total: ${targets.sodium_total_mg}mg)`)

  // Assertions
  let allPass = true

  if (targets.carbs_total_g !== 0) {
    fail(`Expected 0g carbs for <60min moderate, got ${targets.carbs_total_g}g`)
    allPass = false
  } else {
    pass(`Carbs: 0g (correct for <60min workout)`)
  }

  if (targets.carbs_g_per_h !== 0) {
    fail(`Expected 0g carbs/h for <60min moderate, got ${targets.carbs_g_per_h}g/h`)
    allPass = false
  } else {
    pass(`Carbs per hour: 0g/h`)
  }

  // Build schedule
  const skeleton = buildScheduleSkeleton(athlete, workout, targets)
  info(`\nSchedule skeleton:`)
  info(`  Pre: ${skeleton.pre.time}`)
  info(`  During intervals: ${skeleton.during.length} (should be 0 since no carbs)`)
  info(`  Post: ${skeleton.post.time}`)

  if (skeleton.during.length > 0) {
    warn(`Expected 0 during intervals for 0g carbs, got ${skeleton.during.length}`)
  } else {
    pass(`No during intervals (0g carbs, no need for feeding)`)
  }

  // Generate plan
  const plan = deterministicFallbackItems(athlete, workout, targets, skeleton)
  info(`\nPlan generated:`)
  info(`  During items: ${plan.during_workout.items.length} (should only be water)`)
  info(`  During carbs: ${plan.during_workout.total_carbs_g}g`)

  if (plan.during_workout.total_carbs_g !== 0) {
    fail(`Expected 0g carbs in plan, got ${plan.during_workout.total_carbs_g}g`)
    allPass = false
  } else {
    pass(`During plan carbs: 0g`)
  }

  // Validate
  const validation = validateFuelingPlan(plan, athlete, workout, targets)
  if (!validation.ok) {
    fail(`Validation failed: ${validation.errors.join(", ")}`)
    allPass = false
  } else {
    pass(`Plan validation passed`)
  }

  return allPass
}

/**
 * SCENARIO 4: 120-min VERY HIGH intensity, caffeine eligible
 * Expected: Caffeine included, high carbs (capped by GI), hydration bump
 */
function testScenario4() {
  section("SCENARIO 4: 120-min VERY HIGH intensity → caffeine + high carbs")

  const athlete: AthleteProfile = {
    weight_kg: 75,
    age: 26,
    sex: "male",
    experience_level: "advanced",
    sweat_rate: "medium",
    gi_sensitivity: "low", // Low GI = higher carb tolerance
    caffeine_use: "some", // Eligible for caffeine
    primary_goal: "endurance",
  }

  const workout: WorkoutInput = {
    sport: "running",
    duration_min: 120,
    intensity: "very_high",
    start_time: "14:00",
    temperature_c: 28, // Hot
  }

  info(`Athlete: ${athlete.weight_kg}kg, ${athlete.age}y, ${athlete.sweat_rate} sweat, ${athlete.gi_sensitivity} GI`)
  info(`Workout: ${workout.sport} ${workout.duration_min}min ${workout.intensity} intensity, ${workout.temperature_c}°C`)

  const targets = computeFuelingTargets(athlete, workout)
  info("\nTargets calculated:")
  info(`  Carbs: ${targets.carbs_g_per_h}g/h (total: ${targets.carbs_total_g}g)`)
  info(`  Fluids: ${targets.fluids_ml_per_h}ml/h (total: ${targets.fluids_total_ml}ml)`)
  info(`  Sodium: ${targets.sodium_mg_per_h}mg/h (total: ${targets.sodium_total_mg}mg)`)
  info(`  Caffeine: ${targets.caffeine_mg_total}mg`)

  // Assertions
  let allPass = true

  // Very high intensity + 120 min should give 70g/h
  if (targets.carbs_g_per_h < 70) {
    fail(`Expected carbs ≥70g/h for very_high + 120min, got ${targets.carbs_g_per_h}g/h`)
    allPass = false
  } else {
    pass(`Carbs per hour: ${targets.carbs_g_per_h}g/h`)
  }

  // Should have caffeine (≥90 min + high intensity + user uses it)
  if (targets.caffeine_mg_total === 0) {
    fail(`Expected caffeine for 120min very_high intensity, got 0mg`)
    allPass = false
  } else {
    pass(`Caffeine: ${targets.caffeine_mg_total}mg (eligible for high intensity)`)
  }

  // Hot temp should boost hydration
  if (targets.fluids_ml_per_h < 700) {
    fail(`Expected fluids ≥700ml/h (temp adjustment), got ${targets.fluids_ml_per_h}ml/h`)
    allPass = false
  } else {
    pass(`Fluids per hour: ${targets.fluids_ml_per_h}ml/h (includes temp boost)`)
  }

  // Build schedule
  const skeleton = buildScheduleSkeleton(athlete, workout, targets)

  // Generate plan
  const plan = deterministicFallbackItems(athlete, workout, targets, skeleton)
  info(`\nPlan generated and validated`)

  // Validate
  const validation = validateFuelingPlan(plan, athlete, workout, targets)
  if (!validation.ok) {
    fail(`Validation failed: ${validation.errors.join(", ")}`)
    allPass = false
  } else {
    pass(`Plan validation passed`)
  }

  return allPass
}

/**
 * Main test runner
 */
function main() {
  log("\n", colors.cyan)
  log("╔════════════════════════════════════════════════════════════════════╗", colors.cyan)
  log("║        WORKOUT FUELING ENGINE - TEST SUITE                         ║", colors.cyan)
  log("╚════════════════════════════════════════════════════════════════════╝\n", colors.cyan)

  const results: { name: string; pass: boolean }[] = []

  // Run scenarios
  results.push({ name: "Scenario 1: 90min moderate bike", pass: testScenario1() })
  results.push({ name: "Scenario 2: 90min high bike (GI carb cap)", pass: testScenario2() })
  results.push({ name: "Scenario 3: 45min moderate run (no carbs)", pass: testScenario3() })
  // results.push({ name: "Scenario 4: 120min very high (caffeine)", pass: testScenario4() })

  // Summary
  section("TEST SUMMARY")
  const passed = results.filter((r) => r.pass).length
  const total = results.length

  results.forEach((r) => {
    if (r.pass) {
      pass(r.name)
    } else {
      fail(r.name)
    }
  })

  log("\n" + "=".repeat(70), colors.cyan)
  if (passed === total) {
    log(`✅ ALL ${total} SCENARIOS PASSED`, colors.green)
  } else {
    log(`❌ ${total - passed} of ${total} scenarios failed`, colors.red)
  }
  log("=".repeat(70) + "\n", colors.cyan)

  process.exit(passed === total ? 0 : 1)
}

main()
