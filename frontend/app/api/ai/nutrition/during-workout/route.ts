import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { generateNutritionPrompt } from "@/lib/nutrition/workout-nutrition-schema"

const duringWorkoutSchema = z.object({
  workoutId: z.string().optional(),
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

const OPENAI_URL = "https://api.openai.com/v1/chat/completions"
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"

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

    // Generate detailed prompt for structured nutrition plan
    const prompt = generateNutritionPrompt(
      workoutType || "General training",
      durationMinutes,
      intensity || "moderate",
      description
    )

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000, // Increased for detailed JSON response
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API error:", errorData)
      return NextResponse.json(
        { error: "Failed to generate nutrition recommendation" },
        { status: 500 }
      )
    }

    const data = await response.json()
    let aiResponse = data.choices?.[0]?.message?.content || "Unable to generate recommendation"

    // Try to parse as JSON for structured data
    let parsedPlan = null
    try {
      // Remove markdown code blocks if present
      let jsonStr = aiResponse.trim()
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\n?/, "").replace(/\n?```$/, "")
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\n?/, "").replace(/\n?```$/, "")
      }
      
      parsedPlan = JSON.parse(jsonStr)
      aiResponse = jsonStr // Use cleaned JSON as response
    } catch (parseError) {
      console.warn("Could not parse nutrition plan as JSON:", parseError)
      // Still return the raw text if JSON parsing fails
    }

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
          
          // Structured data if available
          during_carbs_g_per_hour: parsedPlan?.duringWorkout?.totalCarbs || null,
          during_hydration_ml_per_hour: parsedPlan?.duringWorkout?.totalHydration || null,
          during_electrolytes_mg: parsedPlan?.duringWorkout?.totalSodium || null,
          
          // Full recommendation text
          during_workout_recommendation: aiResponse,
          pre_workout_recommendation: parsedPlan?.preWorkout ? JSON.stringify(parsedPlan.preWorkout) : null,
          post_workout_recommendation: parsedPlan?.postWorkout ? JSON.stringify(parsedPlan.postWorkout) : null,
          
          // Raw AI response
          ai_response: aiResponse,
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
      nutrition: aiResponse,
      plan: parsedPlan,
      saved: !!savedId,
      recordId: savedId,
    })
  } catch (error) {
    console.error("Error in during-workout nutrition:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
