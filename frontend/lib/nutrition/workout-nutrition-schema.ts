import { z } from "zod"
import { 
  generatePersonalizedNutritionPlan,
  type AthleteProfile,
  type WorkoutProfile,
  type NutritionPlan,
} from "./sports-nutrition-calculator"

/**
 * Nutrition item with specific product and timing
 */
export const NutritionItemSchema = z.object({
  id: z.string().optional(),
  time: z.string(), // HH:MM format or "Start", "Every 30 min", etc
  product: z.string(), // Specific product name (e.g., "Gatorade Orange 500ml")
  quantity: z.number(), // Amount to consume
  unit: z.string(), // ml, g, tabs, bars, etc
  carbs: z.number().optional(), // grams
  protein: z.number().optional(), // grams
  sodium: z.number().optional(), // mg
  notes: z.string().optional(),
})

export type NutritionItem = z.infer<typeof NutritionItemSchema>

/**
 * Complete structured workout nutrition plan
 */
export const WorkoutNutritionPlanSchema = z.object({
  workoutType: z.string(), // Run, Bike, Swim, etc
  workoutDurationMinutes: z.number(),
  workoutIntensity: z.enum(["low", "moderate", "high", "very-high"]),
  
  // Pre-workout (2-3 hours before)
  preWorkout: z.object({
    timing: z.string(), // "2-3 hours before" or "Start - 120 min"
    items: z.array(NutritionItemSchema),
    totalCarbs: z.number(),
    totalProtein: z.number(),
    totalCalories: z.number(),
    notes: z.string().optional(),
  }),
  
  // During workout
  duringWorkout: z.object({
    timing: z.string(), // "During workout"
    interval: z.number(), // Every X minutes
    items: z.array(NutritionItemSchema), // What to take every interval
    totalCarbs: z.number(), // Per hour
    totalHydration: z.number(), // ml per hour
    totalSodium: z.number(), // mg per hour
    notes: z.string().optional(),
  }),
  
  // Post-workout (within 30-60 min)
  postWorkout: z.object({
    timing: z.string(), // "Within 30 min after" or similar
    items: z.array(NutritionItemSchema),
    totalCarbs: z.number(),
    totalProtein: z.number(),
    totalCalories: z.number(),
    notes: z.string().optional(),
  }),
  
  metadata: z.object({
    recommendations: z.string(), // Text summary for display
    generatedAt: z.date().optional(),
  }),
})

export type WorkoutNutritionPlan = z.infer<typeof WorkoutNutritionPlanSchema>

/**
 * Example: 2-hour cycling at moderate intensity
 */
export const NUTRITION_PLAN_EXAMPLE: WorkoutNutritionPlan = {
  workoutType: "Cycling",
  workoutDurationMinutes: 120,
  workoutIntensity: "moderate",
  
  preWorkout: {
    timing: "2-3 hours before",
    items: [
      {
        product: "Oatmeal with banana and honey",
        quantity: 200,
        unit: "g",
        carbs: 45,
        protein: 8,
        sodium: 0,
        time: "-180 min",
      },
      {
        product: "Water",
        quantity: 500,
        unit: "ml",
        carbs: 0,
        time: "-120 min",
      },
    ],
    totalCarbs: 45,
    totalProtein: 8,
    totalCalories: 240,
    notes: "Light, easily digestible meal to avoid GI issues",
  },
  
  duringWorkout: {
    timing: "During workout",
    interval: 45, // Every 45 minutes
    items: [
      {
        product: "Gatorade Orange (or similar sports drink)",
        quantity: 250,
        unit: "ml",
        carbs: 15,
        sodium: 200,
        time: "Every 45 min",
      },
      {
        product: "Clif Bar (Chocolate Chip)",
        quantity: 1,
        unit: "bar",
        carbs: 42,
        protein: 10,
        sodium: 210,
        time: "At 45 min mark",
      },
    ],
    totalCarbs: 60, // 15+42+3 (from water absorbed)
    totalHydration: 500, // 250ml every 45 min ≈ 333ml/hour
    totalSodium: 410, // Per serving
    notes: "Take with water to aid absorption and prevent cramping",
  },
  
  postWorkout: {
    timing: "Within 30 minutes after workout",
    items: [
      {
        product: "Chocolate Milk (whole milk, 2%)",
        quantity: 500,
        unit: "ml",
        carbs: 56,
        protein: 16,
        sodium: 180,
        time: "Immediately (within 15 min)",
      },
      {
        product: "Banana",
        quantity: 1,
        unit: "medium",
        carbs: 27,
        protein: 1,
        sodium: 1,
        time: "+20 min",
      },
    ],
    totalCarbs: 83,
    totalProtein: 17,
    totalCalories: 420,
    notes: "High carb:protein ratio (3:1) to maximize recovery. Include some sodium for fluid retention.",
  },
  
  metadata: {
    recommendations: "For a 2-hour moderate cycling session: consume 45g carbs pre-workout, 60g carbs during (every 45 min), and 83g carbs post-workout with 16g protein for optimal recovery.",
  },
}

/**
 * Get nutrition plan based on workout parameters
 */
export function generateNutritionPrompt(
  workoutType: string,
  durationMinutes: number,
  intensity: string,
  description?: string
): string {
  return `You are an expert sports nutritionist. Create a DETAILED, SPECIFIC workout nutrition plan.

WORKOUT DETAILS:
- Type: ${workoutType}
- Duration: ${durationMinutes} minutes
- Intensity: ${intensity}
- Description: ${description || "General training"}

GENERATE A STRUCTURED JSON RESPONSE with this EXACT format (no markdown, pure JSON):
{
  "preWorkout": {
    "timing": "When to eat (e.g., '2-3 hours before' or 'Start - 180 min')",
    "items": [
      {
        "time": "Specific time relative to start (e.g., '-180 min', '-60 min')",
        "product": "SPECIFIC product name (brand if possible)",
        "quantity": NUMBER,
        "unit": "ml/g/bars/tabs",
        "carbs": NUMBER,
        "protein": NUMBER,
        "sodium": NUMBER,
        "notes": "Why this product/when to consume"
      }
    ],
    "totalCarbs": NUMBER,
    "totalProtein": NUMBER,
    "totalCalories": NUMBER
  },
  "duringWorkout": {
    "timing": "During workout",
    "interval": NUMBER_minutes,
    "items": [
      {
        "time": "Every X min OR at specific mark",
        "product": "SPECIFIC product (e.g., 'Gatorade Orange 500ml')",
        "quantity": NUMBER,
        "unit": "ml/g/bars",
        "carbs": NUMBER,
        "sodium": NUMBER,
        "notes": "When and how to consume"
      }
    ],
    "totalCarbs": NUMBER_per_hour,
    "totalHydration": NUMBER_ml_per_hour,
    "totalSodium": NUMBER_mg_per_hour
  },
  "postWorkout": {
    "timing": "Within X minutes after",
    "items": [
      {
        "time": "Specific timing post-workout",
        "product": "SPECIFIC product",
        "quantity": NUMBER,
        "unit": "ml/g",
        "carbs": NUMBER,
        "protein": NUMBER,
        "sodium": NUMBER,
        "notes": "Why and when"
      }
    ],
    "totalCarbs": NUMBER,
    "totalProtein": NUMBER,
    "totalCalories": NUMBER
  },
  "recommendations": "1-2 sentence summary of the complete plan"
}

REQUIREMENTS:
1. Use SPECIFIC PRODUCTS with brands (Gatorade, Clif Bar, Hammer Nutrition, etc)
2. Include EXACT quantities (not ranges)
3. Include SODIUM amounts (critical for performance)
4. Provide TIMING for everything (every 30 min, every hour, etc)
5. For ${durationMinutes} min workout, adjust carb amounts appropriately
6. For HIGH intensity: more carbs, more sodium, more frequent intake
7. For LONG workouts (>90 min): must include during-workout nutrition
8. Include practical tips in notes

Return ONLY valid JSON, no markdown backticks.`
}

/**
 * Generate nutrition plan using scientific calculator (replaces AI)
 * Returns plan formatted in the WorkoutNutritionPlan schema
 */
export function generateNutritionPlanFromCalculator(
  athleteProfile: AthleteProfile,
  workoutProfile: WorkoutProfile
): WorkoutNutritionPlan {
  const scientificPlan = generatePersonalizedNutritionPlan(athleteProfile, workoutProfile)

  // Convert scientific plan to schema format
  return {
    workoutType: workoutProfile.type.charAt(0).toUpperCase() + workoutProfile.type.slice(1),
    workoutDurationMinutes: workoutProfile.duration_minutes,
    workoutIntensity: workoutProfile.intensity as any,
    
    preWorkout: {
      timing: `${scientificPlan.preWorkout.timing_minutes} minutes before`,
      items: scientificPlan.preWorkout.items.map((item) => ({
        time: `-${scientificPlan.preWorkout.timing_minutes} min`,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        carbs: item.carbs_g,
        protein: item.protein_g,
        sodium: item.sodium_mg || 0,
        notes: item.notes,
      })),
      totalCarbs: scientificPlan.preWorkout.carbs_g,
      totalProtein: scientificPlan.preWorkout.protein_g,
      totalCalories: Math.round(
        (scientificPlan.preWorkout.carbs_g * 4) +
        (scientificPlan.preWorkout.protein_g * 4) +
        (scientificPlan.preWorkout.fat_g * 9)
      ),
    },
    
    duringWorkout: {
      timing: "During workout",
      interval: scientificPlan.duringWorkout.interval_minutes,
      items: scientificPlan.duringWorkout.items.map((item) => ({
        time: `Every ${scientificPlan.duringWorkout.interval_minutes} min`,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        carbs: item.carbs_g,
        protein: item.protein_g,
        sodium: item.sodium_mg || 0,
        notes: item.notes,
      })),
      totalCarbs: scientificPlan.duringWorkout.carbs_per_hour_g,
      totalHydration: scientificPlan.duringWorkout.hydration_per_hour_ml,
      totalSodium: scientificPlan.duringWorkout.sodium_per_hour_mg,
    },
    
    postWorkout: {
      timing: `Within ${scientificPlan.postWorkout.timing_minutes} minutes after`,
      items: scientificPlan.postWorkout.items.map((item) => ({
        time: `+${scientificPlan.postWorkout.timing_minutes} min`,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        carbs: item.carbs_g,
        protein: item.protein_g,
        sodium: item.sodium_mg || 0,
        notes: item.notes,
      })),
      totalCarbs: scientificPlan.postWorkout.carbs_g,
      totalProtein: scientificPlan.postWorkout.protein_g,
      totalCalories: Math.round(
        (scientificPlan.postWorkout.carbs_g * 4) +
        (scientificPlan.postWorkout.protein_g * 4) +
        (scientificPlan.postWorkout.fat_g * 9)
      ),
    },
    
    metadata: {
      recommendations: scientificPlan.rationale,
      generatedAt: new Date(),
    },
  }
}
