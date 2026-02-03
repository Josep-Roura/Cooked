import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const duringWorkoutSchema = z.object({
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
    const { workoutType, durationMinutes, intensity, tss, description, workoutStartTime, workoutEndTime, nearbyMealTimes } = duringWorkoutSchema.parse(body)

    // Create the prompt for during-workout nutrition
    const nearbyMealsInfo = nearbyMealTimes && nearbyMealTimes.length > 0
      ? `\nNearby meals to consider (avoid overlap):\n${nearbyMealTimes.map(m => `- ${m.mealType}: ${m.time}`).join('\n')}`
      : ""

    const timeInfo = workoutStartTime && workoutEndTime
      ? `\nWorkout timing:\n- Start: ${workoutStartTime}\n- End: ${workoutEndTime}`
      : ""

    const prompt = `You are a sports nutrition expert. Based on the following workout details, provide specific nutrition recommendations for DURING the workout.

Workout Details:
- Type: ${workoutType || "General training"}
- Duration: ${durationMinutes} minutes
- Intensity: ${intensity || "moderate"}
- TSS (Training Stress Score): ${tss || "N/A"}
- Description: ${description || "No additional details"}${timeInfo}${nearbyMealsInfo}

IMPORTANT CONSIDERATIONS:
- Recommend timing that doesn't overlap with nearby meals
- If a meal is immediately before or after the workout, adjust carb/fuel amounts accordingly
- Consider the meal timing in your recommendations to avoid digestive issues
- Ensure adequate spacing between fueling during workout and main meals

Provide ONLY the specific nutrition recommendation for DURING the workout in the following format:
- Specific carbohydrate amount (g/hour or total grams) 
- Specific hydration strategy (ml/hour or total)
- When to consume (e.g., start, every 30 min, etc.)
- Electrolyte recommendations if needed
- Any specific food/drink type recommendations
- Timing considerations relative to nearby meals

Keep the response concise and actionable.`

    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("OpenAI API error:", errorData)
      return NextResponse.json(
        { error: "Failed to generate nutrition recommendation" },
        { status: 500 }
      )
    }

    const data = await response.json()
    const nutrition = data.choices?.[0]?.message?.content || "Unable to generate recommendation"

    return NextResponse.json({
      ok: true,
      nutrition,
    })
  } catch (error) {
    console.error("Error in during-workout nutrition:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
