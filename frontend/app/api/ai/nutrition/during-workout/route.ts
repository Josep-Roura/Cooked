import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { generateSportsNutritionistPrompt, type NutritionistContext } from "@/lib/nutrition/ai-nutritionist-prompt"

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
  let requestId = crypto.randomUUID()
  const requestStartTime = Date.now()
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
      console.error(`[${requestId}] Failed to fetch user profile:`, profileError)
      return NextResponse.json(
        { error: "Failed to fetch user profile" },
        { status: 500 }
      )
    }

    console.log(`[${requestId}] User profile loaded: ${profile.weight_kg}kg, ${profile.experience_level}`)

    // Map intensity to standard format
    const normalizedIntensity = intensity?.toLowerCase() === "high intensity" 
      ? "high" 
      : intensity?.toLowerCase() === "very high" || intensity?.toLowerCase() === "very-high"
      ? "very_high"
      : intensity?.toLowerCase() === "low"
      ? "low"
      : "moderate" as const

    // Build nutritionist context
    const nutritionistContext: NutritionistContext = {
      athleteName: profile.full_name,
      weight_kg: profile.weight_kg || 70,
      age: profile.age || 30,
      sex: profile.sex || "male",
      experience_level: (profile.experience_level || "intermediate") as any,
      sweat_rate: (profile.sweat_rate || "medium") as any,
      gi_sensitivity: (profile.gi_sensitivity || "low") as any,
      caffeine_use: (profile.caffeine_use || "some") as any,
      primary_goal: (profile.primary_goal || "maintenance") as any,
      workoutType: workoutType || "mixed",
      durationMinutes,
      intensity: normalizedIntensity,
      description,
    }

    console.log(`[${requestId}] Generating sports nutritionist prompt...`)

    // Generate professional sports nutritionist prompt
    const prompt = generateSportsNutritionistPrompt(nutritionistContext)

    console.log(`[${requestId}] Calling OpenAI GPT-4o-mini...`)

    // Call OpenAI with professional prompt
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Eres un nutricionista deportivo experto. Responde ÚNICAMENTE con JSON válido. Sin explicaciones adicionales.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}))
      console.error(`[${requestId}] OpenAI error:`, errorData)
      return NextResponse.json(
        { error: "Failed to generate nutrition recommendation" },
        { status: 500 }
      )
    }

    const openaiData = await openaiResponse.json()
    const aiContent = openaiData.choices?.[0]?.message?.content || ""

    console.log(`[${requestId}] OpenAI response received, parsing JSON...`)

    // Parse AI response as JSON
    let nutritionPlan = null
    try {
      let jsonStr = aiContent.trim()
      // Remove markdown code blocks if present
      if (jsonStr.startsWith("```json")) {
        jsonStr = jsonStr.replace(/^```json\n?/, "").replace(/\n?```$/, "")
      } else if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```\n?/, "").replace(/\n?```$/, "")
      }
      
      nutritionPlan = JSON.parse(jsonStr)
      console.log(`[${requestId}] JSON parsed successfully`)
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse AI response as JSON:`, parseError)
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      )
    }

    // Log AI request to database if table exists
    try {
      const latency = Date.now() - requestStartTime
      await supabase.from("ai_requests").insert({
        user_id: user.id,
        provider: "openai",
        model: "gpt-4o-mini",
        response_json: nutritionPlan,
        status: "success",
        latency_ms: latency,
        tokens_used: openaiData.usage?.total_tokens || null,
      })
      console.log(`[${requestId}] AI request logged to database (${latency}ms)`)
    } catch (logError) {
      console.warn(`[${requestId}] Failed to log AI request:`, logError)
      // Don't fail the request if logging fails
    }

    // Save nutrition plan to database if requested
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
          
          // Store AI response
          during_carbs_g_per_hour: nutritionPlan?.durante_entrenamiento?.carbohidratos_por_hora_g,
          during_hydration_ml_per_hour: nutritionPlan?.durante_entrenamiento?.hidratacion_por_hora_ml,
          during_electrolytes_mg: nutritionPlan?.durante_entrenamiento?.sodio_por_hora_mg,
          
          // Full AI recommendations
          during_workout_recommendation: JSON.stringify(nutritionPlan?.durante_entrenamiento),
          pre_workout_recommendation: JSON.stringify(nutritionPlan?.pre_entrenamiento),
          post_workout_recommendation: JSON.stringify(nutritionPlan?.post_entrenamiento),
          
          // Complete plan
          nutrition_plan_json: JSON.stringify(nutritionPlan),
        }

        const { data: savedRecord, error: saveError } = await supabase
          .from("workout_nutrition")
          .insert(nutritionData)
          .select("id")
          .single()

        if (saveError) {
          console.error(`[${requestId}] Failed to save nutrition plan:`, saveError)
        } else if (savedRecord) {
          savedId = savedRecord.id
          console.log(`[${requestId}] Nutrition plan saved: ${savedId}`)
        }
      } catch (error) {
        console.error(`[${requestId}] Error saving nutrition plan:`, error)
        // Don't fail the request if saving fails
      }
    }

    console.log(`[${requestId}] Request complete, returning response`)

    return NextResponse.json({
      ok: true,
      nutrition: nutritionPlan,
      plan: nutritionPlan,
      saved: !!savedId,
      recordId: savedId,
      source: "sports_nutritionist_ai",
      model: "gpt-4o-mini",
      requestId,
    })
  } catch (error) {
    console.error(`[${requestId}] Error in nutrition endpoint:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
