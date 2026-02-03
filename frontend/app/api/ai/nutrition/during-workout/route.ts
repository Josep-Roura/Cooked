import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"

const duringWorkoutSchema = z.object({
  workoutType: z.string().optional(),
  durationMinutes: z.number().positive(),
  intensity: z.string().optional(),
  tss: z.number().optional(),
  description: z.string().optional(),
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
    const { workoutType, durationMinutes, intensity, tss, description } = duringWorkoutSchema.parse(body)

    // Create the prompt for during-workout nutrition
    const prompt = `You are a sports nutrition expert. Based on the following workout details, provide specific nutrition recommendations for DURING the workout.

Workout Details:
- Type: ${workoutType || "General training"}
- Duration: ${durationMinutes} minutes
- Intensity: ${intensity || "moderate"}
- TSS (Training Stress Score): ${tss || "N/A"}
- Description: ${description || "No additional details"}

Provide ONLY the specific nutrition recommendation for DURING the workout in the following format:
- Specific carbohydrate amount (g/hour or total grams)
- Specific hydration strategy (ml/hour or total)
- Electrolyte recommendations if needed
- Any specific food/drink type recommendations

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
