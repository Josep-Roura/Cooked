/**
 * Advanced Sports Nutrition Calculator
 * Based on ACSM, ISSN, and IOC guidelines
 * 
 * Calculates personalized nutrition for athletes based on:
 * - Body weight
 * - Training type and duration
 * - Intensity level
 * - Goal (endurance, strength, weight loss, etc.)
 * - Experience level
 * - GI sensitivity
 * - Sweat rate
 */

export interface AthleteProfile {
  // Basic
  weight_kg: number
  age: number
  sex: 'male' | 'female'
  
  // Experience
  experience_level: 'beginner' | 'intermediate' | 'advanced'
  
  // Metrics
  sweat_rate: 'low' | 'medium' | 'high'
  gi_sensitivity: 'low' | 'medium' | 'high'
  caffeine_use: 'none' | 'some' | 'high'
  
  // Goals
  primary_goal: 'endurance' | 'strength' | 'weight_loss' | 'maintenance' | 'hypertrophy'
  activity_level: 'low' | 'medium' | 'high'
}

export interface WorkoutProfile {
  type: 'cycling' | 'running' | 'swimming' | 'triathlon' | 'strength' | 'mixed'
  duration_minutes: number
  intensity: 'low' | 'moderate' | 'high' | 'very_high'
  power_tss?: number // TrainingPeaks TSS
  distance_km?: number
  elevation_gain_m?: number
}

export interface NutritionPlan {
  preWorkout: PhaseNutrition
  duringWorkout: DuringNutrition
  postWorkout: PostWorkoutNutrition
  rationale: string
  warnings: string[]
}

export interface PhaseNutrition {
  timing_minutes: number // How many minutes before workout
  carbs_g: number
  protein_g: number
  fat_g: number
  fiber_g: number
  caffeine_mg: number
  hydration_ml: number
  items: NutritionItem[]
  rationale: string
}

export interface DuringNutrition {
  carbs_per_hour_g: number
  hydration_per_hour_ml: number
  sodium_per_hour_mg: number
  caffeine_mg: number
  interval_minutes: number // Consume every X minutes
  items: NutritionItem[]
  rationale: string
  warnings: string[]
}

export interface PostWorkoutNutrition {
  timing_minutes: number // Within X minutes of finish
  carbs_g: number
  protein_g: number
  fat_g: number
  hydration_ml: number
  sodium_mg: number
  items: NutritionItem[]
  rationale: string
}

export interface NutritionItem {
  product: string
  quantity: number
  unit: string
  carbs_g?: number
  protein_g?: number
  fat_g?: number
  fiber_g?: number
  sodium_mg?: number
  caffeine_mg?: number
  notes?: string
}

interface AthleteProfile {
  // Basic
  weight_kg: number
  age: number
  sex: 'male' | 'female'
  
  // Experience
  experience_level: 'beginner' | 'intermediate' | 'advanced'
  
  // Metrics
  sweat_rate: 'low' | 'medium' | 'high'
  gi_sensitivity: 'low' | 'medium' | 'high'
  caffeine_use: 'none' | 'some' | 'high'
  
  // Goals
  primary_goal: 'endurance' | 'strength' | 'weight_loss' | 'maintenance' | 'hypertrophy'
  activity_level: 'low' | 'medium' | 'high'
}

interface WorkoutProfile {
  type: 'cycling' | 'running' | 'swimming' | 'triathlon' | 'strength' | 'mixed'
  duration_minutes: number
  intensity: 'low' | 'moderate' | 'high' | 'very_high'
  power_tss?: number // TrainingPeaks TSS
  distance_km?: number
  elevation_gain_m?: number
}

interface NutritionPlan {
  preWorkout: PhaseNutrition
  duringWorkout: DuringNutrition
  postWorkout: PostWorkoutNutrition
  rationale: string
  warnings: string[]
}

interface PhaseNutrition {
  timing_minutes: number // How many minutes before workout
  carbs_g: number
  protein_g: number
  fat_g: number
  fiber_g: number
  caffeine_mg: number
  hydration_ml: number
  items: NutritionItem[]
  rationale: string
}

interface DuringNutrition {
  carbs_per_hour_g: number
  hydration_per_hour_ml: number
  sodium_per_hour_mg: number
  caffeine_mg: number
  interval_minutes: number // Consume every X minutes
  items: NutritionItem[]
  rationale: string
  warnings: string[]
}

interface PostWorkoutNutrition {
  timing_minutes: number // Within X minutes of finish
  carbs_g: number
  protein_g: number
  fat_g: number
  hydration_ml: number
  sodium_mg: number
  items: NutritionItem[]
  rationale: string
}

interface NutritionItem {
  product: string
  quantity: number
  unit: string
  carbs_g?: number
  protein_g?: number
  fat_g?: number
  fiber_g?: number
  sodium_mg?: number
  caffeine_mg?: number
  notes?: string
}

/**
 * Calculate total energy expenditure during workout
 * Estimation based on work type, duration, intensity, and body weight
 */
export function estimateWorkoutCalories(
  workout: WorkoutProfile,
  weight_kg: number
): number {
  // MET values by activity and intensity
  const met_values: Record<string, Record<string, number>> = {
    cycling: { low: 5, moderate: 7, high: 10, very_high: 14 },
    running: { low: 6, moderate: 10, high: 12.3, very_high: 16 },
    swimming: { low: 4, moderate: 8, high: 11, very_high: 14 },
    triathlon: { low: 7, moderate: 10, high: 12, very_high: 14 },
    strength: { low: 3, moderate: 5, high: 8, very_high: 10 },
    mixed: { low: 5, moderate: 7, high: 9, very_high: 12 },
  }

  const met = met_values[workout.type]?.[workout.intensity] || 7
  const hours = workout.duration_minutes / 60
  const calories = met * weight_kg * hours

  return Math.round(calories)
}

/**
 * PRE-WORKOUT NUTRITION
 * Guidelines: IOC, ACSM, ISSN
 * 
 * Timing: 2-4 hours before (depending on digestion)
 * Goal: Fill glycogen stores, hydrate, settle stomach
 */
export function calculatePreWorkoutNutrition(
  athlete: AthleteProfile,
  workout: WorkoutProfile
): PhaseNutrition {
  const { weight_kg, experience_level, gi_sensitivity, primary_goal } = athlete
  const { duration_minutes, intensity, type } = workout

  // Determine timing based on meal size and GI sensitivity
  const timing_minutes =
    gi_sensitivity === 'high' ? 240 : gi_sensitivity === 'medium' ? 180 : 120

  // Carb recommendation: 1-4g per kg body weight (depending on duration)
  // For workouts > 90 min: 3-4 g/kg
  // For workouts 60-90 min: 2-3 g/kg
  // For workouts < 60 min: 1-2 g/kg
  const duration_category =
    duration_minutes > 90 ? 'long' : duration_minutes > 60 ? 'medium' : 'short'

  const carb_multipliers: Record<string, number> = {
    long: 4,
    medium: 2.5,
    short: 1.5,
  }

  const carbs_g = Math.round(weight_kg * carb_multipliers[duration_category])

  // Protein: 0.25-0.4g per kg (helps with satiety and recovery)
  const protein_g = Math.round(weight_kg * 0.3)

  // Fat: 0.5-1.5g per kg (be moderate to avoid GI issues)
  const fat_g = Math.round(weight_kg * 0.5)

  // Fiber: limit if GI sensitive
  const fiber_g = gi_sensitivity === 'high' ? 2 : 5

  // Caffeine: 3-6mg/kg body weight for endurance (1-2 hours before)
  const caffeine_mg =
    intensity === 'very_high' && duration_minutes > 90 && experience_level === 'advanced'
      ? Math.round(weight_kg * 4)
      : 0

  // Hydration: 400-600ml (individual sweat rate based)
  const hydration_ml = athlete.sweat_rate === 'high' ? 600 : 500

  const items = generatePreWorkoutItems(
    carbs_g,
    protein_g,
    fat_g,
    fiber_g,
    caffeine_mg,
    gi_sensitivity
  )

  return {
    timing_minutes,
    carbs_g,
    protein_g,
    fat_g,
    fiber_g,
    caffeine_mg,
    hydration_ml,
    items,
    rationale: `Pre-workout meal for ${duration_minutes}min ${type} at ${intensity} intensity. 
      ${carbs_g}g carbs fill glycogen stores. 
      ${protein_g}g protein for satiety. 
      ${hydration_ml}ml fluid for hydration.`,
  }
}

/**
 * DURING-WORKOUT NUTRITION
 * Guidelines: ACSM, ISSN, IOC
 * 
 * Key principle: Fuel based on carb oxidation rate and workout duration
 * - Workouts < 60 min: Usually just water
 * - Workouts 60-90 min: 30-60g carbs/hour
 * - Workouts 90-180 min: 60g carbs/hour (single source)
 * - Workouts > 180 min: 60-90g carbs/hour (multiple sources)
 */
export function calculateDuringWorkoutNutrition(
  athlete: AthleteProfile,
  workout: WorkoutProfile
): DuringNutrition {
  const { weight_kg, sweat_rate, gi_sensitivity, experience_level } = athlete
  const { duration_minutes, intensity, type } = workout

  // ===== CARBOHYDRATE STRATEGY =====
  let carbs_per_hour_g = 0
  let interval_minutes = 30

  if (duration_minutes < 60) {
    // No fuel needed, just water
    carbs_per_hour_g = 0
  } else if (duration_minutes <= 90) {
    // 30-60g/hour (single carb source or water + gel)
    carbs_per_hour_g = 45
    interval_minutes = 45
  } else if (duration_minutes <= 180) {
    // 60g/hour (single carb source)
    // For cyclists especially, 60g is the max absorption rate for one source
    carbs_per_hour_g = 60
    interval_minutes = 30
  } else {
    // > 180 min: use multiple carb sources (fructose + glucose)
    // Can absorb 90g/hour with proper combination
    carbs_per_hour_g = 90
    interval_minutes = 20
  }

  // ===== HYDRATION STRATEGY =====
  // Goal: Replace 50-100% of fluid losses (avoid >2% body weight loss)
  // Sweat rate calculations
  const sweat_rate_ml_per_hour: Record<string, number> = {
    low: 400,
    medium: 600,
    high: 800,
  }

  const athlete_sweat_rate = sweat_rate_ml_per_hour[sweat_rate]
  
  // Account for intensity
  const intensity_multiplier: Record<string, number> = {
    low: 0.7,
    moderate: 1,
    high: 1.2,
    very_high: 1.4,
  }

  const hydration_per_hour_ml = Math.round(
    athlete_sweat_rate * intensity_multiplier[intensity]
  )

  // Cap at 800-1000ml/hour (what gut can absorb)
  const hydration_capped = Math.min(hydration_per_hour_ml, 1000)

  // ===== SODIUM STRATEGY =====
  // 300-700mg per liter (helps with hydration absorption and prevents hyponatremia)
  // More sodium in hot conditions or for heavy sweaters
  let sodium_per_hour_mg = 500
  if (sweat_rate === 'high') sodium_per_hour_mg = 700
  if (sweat_rate === 'low') sodium_per_hour_mg = 300

  // ===== CAFFEINE (OPTIONAL) =====
  // Only for high intensity, experienced athletes, no GI sensitivity
  let caffeine_mg = 0
  if (
    intensity === 'high' &&
    experience_level === 'advanced' &&
    gi_sensitivity !== 'high' &&
    duration_minutes >= 120
  ) {
    caffeine_mg = Math.round(weight_kg * 2) // 2mg/kg near end of workout
  }

  const items = generateDuringWorkoutItems(
    carbs_per_hour_g,
    hydration_capped,
    sodium_per_hour_mg,
    caffeine_mg,
    interval_minutes,
    gi_sensitivity,
    type,
    duration_minutes
  )

  // Generate warnings
  const warnings: string[] = []
  if (gi_sensitivity === 'high' && carbs_per_hour_g > 60) {
    warnings.push('⚠️ High carb rate may cause GI distress. Start conservatively.')
  }
  if (hydration_per_hour_ml > 1000) {
    warnings.push('⚠️ Sweat rate very high. Limit fluids to 800-1000ml/hour to avoid hyponatremia.')
  }
  if (duration_minutes > 120 && carbs_per_hour_g === 0) {
    warnings.push('⚠️ Long workout without fuel. Risk of bonking.')
  }

  const rationale = `During ${duration_minutes}min ${type} at ${intensity} intensity:
    - ${carbs_per_hour_g}g carbs/hour (based on workout duration and carb oxidation capacity)
    - ${hydration_capped}ml fluid/hour (based on ${sweat_rate} sweat rate and ${intensity} intensity)
    - ${sodium_per_hour_mg}mg sodium/hour (maintains osmolarity and reduces hyponatremia risk)
    - Every ${interval_minutes}min: drink + eat to match absorption rate
    - Consume ${Math.round((carbs_per_hour_g / interval_minutes) * 30)}g carbs per interval`

  return {
    carbs_per_hour_g,
    hydration_per_hour_ml: hydration_capped,
    sodium_per_hour_mg,
    caffeine_mg,
    interval_minutes,
    items,
    rationale,
    warnings,
  }
}

/**
 * POST-WORKOUT RECOVERY NUTRITION
 * Guidelines: ACSM, ISSN, IOC
 * 
 * Goals:
 * 1. Replenish glycogen (depleted during workout)
 * 2. Provide amino acids for protein synthesis
 * 3. Rehydrate and replace electrolytes
 */
export function calculatePostWorkoutNutrition(
  athlete: AthleteProfile,
  workout: WorkoutProfile
): PostWorkoutNutrition {
  const { weight_kg, primary_goal, sweat_rate } = athlete
  const { duration_minutes, intensity, type } = workout

  // Determine timing based on workout type
  // Endurance: ASAP (within 30 min) - glycogen synthesis window
  // Strength: 0-120 min window acceptable - protein synthesis window
  const timing_minutes = duration_minutes > 90 ? 30 : 60

  // ===== CARBOHYDRATE REPLENISHMENT =====
  // Goal: 1.2g per kg per HOUR for 4-6 hours for full glycogen recovery
  // Immediate post-workout: 1-1.2g per kg
  const carbs_g = Math.round(weight_kg * 1.2)

  // ===== PROTEIN FOR RECOVERY =====
  // ISSN guideline: 20-40g per meal for optimal protein synthesis
  // Higher for: strength goals, higher body weight, older athletes
  let protein_g = 30
  if (primary_goal === 'hypertrophy' || weight_kg > 80) protein_g = 40
  if (primary_goal === 'weight_loss') protein_g = 25

  // ===== FAT =====
  // Not critical immediately, but 10-15g is typical
  const fat_g = 12

  // ===== HYDRATION & SODIUM =====
  // Rehydrate 150% of fluid lost (accounts for ongoing sweat loss)
  const sweat_rate_ml_per_hour: Record<string, number> = {
    low: 400,
    medium: 600,
    high: 800,
  }

  const estimated_fluid_loss = (sweat_rate_ml_per_hour[sweat_rate] * duration_minutes) / 60
  const rehydration_ml = Math.round(estimated_fluid_loss * 1.5)

  // Sodium: 500-700mg (helps with fluid retention and osmolarity)
  const sodium_mg = 600

  const items = generatePostWorkoutItems(
    carbs_g,
    protein_g,
    fat_g,
    sodium_mg,
    type,
    workout.intensity
  )

  return {
    timing_minutes,
    carbs_g,
    protein_g,
    fat_g,
    hydration_ml: rehydration_ml,
    sodium_mg,
    items,
    rationale: `Post-workout recovery within ${timing_minutes}min:
      - ${carbs_g}g carbs to replenish glycogen (depleted during ${duration_minutes}min workout)
      - ${protein_g}g protein to stimulate muscle protein synthesis
      - ${rehydration_ml}ml fluid to replace losses (150% of sweat loss)
      - ${sodium_mg}mg sodium to aid fluid retention`,
  }
}

// ===== HELPER FUNCTIONS TO GENERATE SPECIFIC ITEMS =====

function generatePreWorkoutItems(
  carbs: number,
  protein: number,
  fat: number,
  fiber: number,
  caffeine: number,
  gi_sensitivity: string
): NutritionItem[] {
  const items: NutritionItem[] = []

  // Low GI carbs for sustained energy
  if (gi_sensitivity === 'low') {
    items.push({
      product: 'Oatmeal with banana',
      quantity: 150,
      unit: 'g',
      carbs_g: 45,
      protein_g: 5,
      fiber_g: 3,
      notes: 'Slow-release carbs, easily digestible',
    })
    items.push({
      product: 'Honey',
      quantity: 20,
      unit: 'g',
      carbs_g: 17,
      notes: 'Quick-release carbs',
    })
  } else {
    items.push({
      product: 'White bread with jam',
      quantity: 100,
      unit: 'g',
      carbs_g: 50,
      fiber_g: 1,
      notes: 'Easy to digest',
    })
  }

  items.push({
    product: 'Banana',
    quantity: 1,
    unit: 'piece',
    carbs_g: 25,
    protein_g: 1,
    notes: 'Potassium, portable',
  })

  if (protein > 0) {
    items.push({
      product: 'Greek yogurt',
      quantity: 100,
      unit: 'g',
      protein_g: 10,
      carbs_g: 5,
    })
  }

  if (caffeine > 0) {
    items.push({
      product: 'Espresso',
      quantity: 1,
      unit: 'shot',
      caffeine_mg: caffeine,
      notes: '90-180 min before workout',
    })
  }

  return items
}

function generateDuringWorkoutItems(
  carbs_per_hour: number,
  hydration_ml: number,
  sodium_mg: number,
  caffeine_mg: number,
  interval_min: number,
  gi_sensitivity: string,
  type: string,
  duration: number
): NutritionItem[] {
  const items: NutritionItem[] = []

  if (carbs_per_hour === 0) {
    items.push({
      product: 'Water',
      quantity: hydration_ml,
      unit: 'ml',
      notes: 'Workout too short for fuel',
    })
    return items
  }

  const carbs_per_interval = Math.round((carbs_per_hour / 60) * interval_min)

  // Sports drinks (primary hydration + carbs)
  if (hydration_ml > 0) {
    items.push({
      product: 'Sports drink (6-8% carbs)',
      quantity: hydration_ml,
      unit: 'ml',
      carbs_g: carbs_per_interval * 0.7,
      sodium_mg: Math.round(sodium_mg * (interval_min / 60)),
      notes: `Every ${interval_min}min. 6-8% = optimal carb concentration`,
    })
  }

  // Additional carbs if needed
  if (carbs_per_hour > 60 || (type === 'cycling' && duration > 180)) {
    items.push({
      product: 'Energy gel or bar',
      quantity: 1,
      unit: 'packet/bar',
      carbs_g: Math.round(carbs_per_interval * 0.3),
      notes: `Every ${interval_min * 2}min. Alternate with drink.`,
    })
  }

  if (caffeine_mg > 0) {
    items.push({
      product: 'Caffeine gel or tablet',
      quantity: 1,
      unit: 'dose',
      caffeine_mg,
      notes: 'In final 60 minutes of long efforts',
    })
  }

  return items
}

function generatePostWorkoutItems(
  carbs: number,
  protein: number,
  fat: number,
  sodium: number,
  type: string,
  intensity: string
): NutritionItem[] {
  const items: NutritionItem[] = []

  // Primary recovery meal
  items.push({
    product: 'Rice + Chicken',
    quantity: 200,
    unit: 'g',
    carbs_g: 60,
    protein_g: 35,
    notes: 'Complete meal with high carb:protein ratio (3:1)',
  })

  // Recovery drink (faster absorption)
  items.push({
    product: 'Chocolate milk',
    quantity: 500,
    unit: 'ml',
    carbs_g: carbs - 60,
    protein_g: protein - 35,
    notes: 'Quick absorption, 4:1 carb:protein ratio',
  })

  return items
}

/**
 * Main function to generate complete personalized nutrition plan
 */
export function generatePersonalizedNutritionPlan(
  athlete: AthleteProfile,
  workout: WorkoutProfile
): NutritionPlan {
  const preWorkout = calculatePreWorkoutNutrition(athlete, workout)
  const duringWorkout = calculateDuringWorkoutNutrition(athlete, workout)
  const postWorkout = calculatePostWorkoutNutrition(athlete, workout)

  const totalCalories = estimateWorkoutCalories(workout, athlete.weight_kg)

  const warnings: string[] = []

  if (duringWorkout.warnings.length > 0) {
    warnings.push(...duringWorkout.warnings)
  }

  if (athlete.gi_sensitivity === 'high') {
    warnings.push('GI sensitive: Start conservatively with amounts and practice during training')
  }

  return {
    preWorkout,
    duringWorkout,
    postWorkout,
    rationale: `
      Personalized nutrition for ${workout.type} athlete (${athlete.weight_kg}kg, ${athlete.experience_level}):
      
      Workout Analysis:
      - Duration: ${workout.duration_minutes} minutes
      - Intensity: ${workout.intensity}
      - Type: ${workout.type}
      - Estimated calorie burn: ${totalCalories} kcal
      
      Nutrition Strategy:
      - Pre-workout: Fill glycogen, settle stomach
      - During: Fuel based on carb oxidation rate and fluid losses
      - Post-workout: Replenish glycogen and stimulate protein synthesis
    `,
    warnings,
  }
}
