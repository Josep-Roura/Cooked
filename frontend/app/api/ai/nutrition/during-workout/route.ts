import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { 
  generatePersonalizedNutritionPlan,
  type AthleteProfile,
  type WorkoutProfile,
} from "@/lib/nutrition/sports-nutrition-calculator"

const duringWorkoutSchema = z.object({
  workoutId: z.union([z.string(), z.number()]).optional().transform(val => val ? String(val) : undefined),
  workoutDate: z.string().optional(), // YYYY-MM-DD format
  workoutType: z.string().optional(),
  durationMinutes: z.number().positive(),
  intensity: z.string().optional(),
  tss: z.number().optional(),
  description: z.string().optional(),
  workoutStartTime: z.string().optional(), // HH:MM format
  workoutEndTime: z.string().optional(),   // HH:MM format
  nearbyMealTimes: z.array(z.object({
    mealType: z.string(),
    time: z.string(), // HH:MM format
  })).optional(),
  save: z.boolean().optional().default(true), // Whether to save to DB
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      workoutId, 
      workoutDate, 
      workoutType, 
      durationMinutes, 
      intensity, 
      tss, 
      description, 
      workoutStartTime, 
      workoutEndTime, 
      nearbyMealTimes,
      save,
    } = duringWorkoutSchema.parse(body)

    // Fetch user profile from database
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.error("Failed to fetch user profile:", profileError)
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      )
    }

    // Map intensity string to standardized format
    const normalizedIntensity = intensity?.toLowerCase() === "high intensity" 
      ? "high" 
      : intensity?.toLowerCase() === "very high" || intensity?.toLowerCase() === "very-high"
      ? "very_high"
      : intensity?.toLowerCase() === "low"
      ? "low"
      : "moderate" as const

    // Build athlete profile from user data
    const athleteProfile: AthleteProfile = {
      weight_kg: profile.weight_kg || 70,
      age: profile.age || 30,
      sex: profile.sex || "male",
      experience_level: (profile.experience_level || "intermediate") as "beginner" | "intermediate" | "advanced",
      sweat_rate: (profile.sweat_rate || "medium") as "low" | "medium" | "high",
      gi_sensitivity: (profile.gi_sensitivity || "low") as "low" | "medium" | "high",
      caffeine_use: (profile.caffeine_use || "some") as "none" | "some" | "high",
      primary_goal: (profile.primary_goal || "maintenance") as "endurance" | "strength" | "weight_loss" | "maintenance" | "hypertrophy",
      activity_level: "high" as const,
    }

    // Build workout profile
    const workoutProfile: WorkoutProfile = {
      type: (workoutType?.toLowerCase().replace(" ", "_") || "mixed") as any,
      duration_minutes: durationMinutes,
      intensity: normalizedIntensity,
      power_tss: tss,
      distance_km: undefined,
      elevation_gain_m: undefined,
    }

    // Generate personalized nutrition plan using scientific calculator
    const nutritionPlan = generatePersonalizedNutritionPlan(athleteProfile, workoutProfile)

    // Save to database if requested
    let savedId = null
    if (save) {
      try {
        const nutritionData = {
          user_id: user.id,
          workout_id: workoutId || null,
          workout_date: workoutDate || new Date().toISOString().split('T')[0],
          workout_start_time: workoutStartTime || null,
          workout_duration_min: durationMinutes,
          workout_type: workoutType || null,
          
          // Structured data from calculator
          during_carbs_g_per_hour: nutritionPlan.duringWorkout.carbs_per_hour_g,
          during_hydration_ml_per_hour: nutritionPlan.duringWorkout.hydration_per_hour_ml,
          during_electrolytes_mg: nutritionPlan.duringWorkout.sodium_per_hour_mg,
          
          // Full recommendations
          during_workout_recommendation: JSON.stringify(nutritionPlan.duringWorkout),
          pre_workout_recommendation: JSON.stringify(nutritionPlan.preWorkout),
          post_workout_recommendation: JSON.stringify(nutritionPlan.postWorkout),
          
          // Store the complete plan for reference
          nutrition_plan_json: JSON.stringify(nutritionPlan),
        }

        const { data: savedRecord, error: saveError } = await supabase
          .from("workout_nutrition")
          .insert(nutritionData)
          .select("id")
          .single()

        if (saveError) {
          console.error("Failed to save workout nutrition:", saveError)
        } else if (savedRecord) {
          savedId = savedRecord.id
        }
      } catch (error) {
        console.error("Error saving workout nutrition:", error)
        // Don't fail the request if saving fails
      }
    }

    return NextResponse.json({
      ok: true,
      nutrition: nutritionPlan,
      plan: nutritionPlan,
      saved: !!savedId,
      recordId: savedId,
      source: "scientific_calculator",
    })
  } catch (error) {
    console.error("Error in during-workout nutrition:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
