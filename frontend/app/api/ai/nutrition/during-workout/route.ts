import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient } from "@/lib/supabase/server"
import { getCountryCode, getCountryProducts, formatProductsForPrompt, getCountryName } from "@/lib/nutrition/country-products"
import { computeFuelingTargets, buildScheduleSkeleton, deterministicFallbackItems } from "@/lib/nutrition/workoutFuelingEngine"
import { validateFuelingPlan } from "@/lib/nutrition/workoutFuelingValidate"
import { createWorkoutFuelingPrompt, parseFuelingPlanResponse, looksLikeValidJson } from "@/lib/nutrition/workoutFuelingPrompt"
import type { AthleteProfile, WorkoutInput, FuelingPlan } from "@/lib/nutrition/workoutFuelingTypes"

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
  sport: z.string().optional(), // e.g., "cycling", "running"
  temperature_c: z.number().optional(),
  humidity_pct: z.number().optional(),
  nearbyMealTimes: z.array(z.object({
    mealType: z.string(),
    time: z.string(), // HH:MM format
  })).optional(),
  save: z.boolean().optional().default(true), // Whether to save to DB
})

/**
 * Convert athlete profile from DB to our type
 */
function mapDbProfileToAthleteProfile(profile: any): AthleteProfile {
  return {
    weight_kg: profile.weight_kg || 70,
    age: profile.age || 30,
    sex: profile.sex || "male",
    experience_level: profile.experience_level || "intermediate",
    sweat_rate: profile.sweat_rate || "medium",
    gi_sensitivity: profile.gi_sensitivity || "low",
    caffeine_use: profile.caffeine_use || "some",
    primary_goal: profile.primary_goal || "maintenance",
  }
}

/**
 * Normalize intensity string to standard format
 */
function normalizeIntensity(intensity?: string): "low" | "moderate" | "high" | "very_high" {
  if (!intensity) return "moderate"
  const normalized = intensity.toLowerCase().replace("-", "_")
  if (["low", "moderate", "high", "very_high"].includes(normalized)) {
    return normalized as any
  }
  return "moderate"
}

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
      sport,
      temperature_c,
      humidity_pct,
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

    // Convert profile to athlete profile
    const athlete = mapDbProfileToAthleteProfile(profile)

    // Normalize intensity
    const normalizedIntensity = normalizeIntensity(intensity)

    // Build workout input
    const workout: WorkoutInput = {
      sport: sport || workoutType || "mixed",
      duration_min: durationMinutes,
      intensity: normalizedIntensity,
      start_time: workoutStartTime,
      temperature_c,
      humidity_pct,
    }

    console.log(`[${requestId}] Workout: ${workout.sport} ${workout.duration_min}min ${workout.intensity} intensity`)

    // ============================================
    // STEP 1: DETERMINISTIC ENGINE
    // ============================================
    console.log(`[${requestId}] Running deterministic fueling engine...`)

    const targets = computeFuelingTargets(athlete, workout)
    console.log(`[${requestId}] Targets: ${targets.carbs_g_per_h}g carbs/h, ${targets.fluids_ml_per_h}ml fluids/h, ${targets.sodium_mg_per_h}mg sodium/h`)

    const skeleton = buildScheduleSkeleton(athlete, workout, targets)
    console.log(`[${requestId}] Schedule: pre=${skeleton.pre.time}, during=${skeleton.during.length} intervals, post=${skeleton.post.time}`)

    let basePlan = deterministicFallbackItems(athlete, workout, targets, skeleton)
    console.log(`[${requestId}] Generated fallback plan with ${basePlan.pre_workout.items.length} pre, ${basePlan.during_workout.items.length} during, ${basePlan.post_workout.items.length} post items`)

    // Validate fallback plan
    const fallbackValidation = validateFuelingPlan(basePlan, athlete, workout, targets)
    if (!fallbackValidation.ok) {
      console.error(`[${requestId}] ⚠️ Fallback plan validation failed:`, fallbackValidation.errors)
      // This should not happen if engine is correct, but return error if it does
      return NextResponse.json(
        { error: "Internal validation error in deterministic engine", details: fallbackValidation.errors },
        { status: 500 }
      )
    }
    console.log(`[${requestId}] ✅ Fallback plan validated`)

    // ============================================
    // STEP 2: AI ENHANCEMENT (OPTIONAL)
    // ============================================
    let finalPlan = basePlan
    let usedFallback = true

    if (process.env.OPENAI_API_KEY) {
      console.log(`[${requestId}] OpenAI API available, attempting AI enhancement...`)

      // Get country-specific products
      const userCountry = profile.country || "OTHER"
      const countryCode = getCountryCode(userCountry)
      const countryProducts = getCountryProducts(countryCode)
      const formattedProducts = formatProductsForPrompt(countryProducts)

      // Create prompt
      const { system: systemPrompt, user: userMessage } = createWorkoutFuelingPrompt(
        athlete,
        workout,
        targets,
        skeleton,
        formattedProducts,
        profile.language || "en"
      )

      try {
        console.log(`[${requestId}] Calling OpenAI GPT-4o-mini...`)

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
                content: systemPrompt,
              },
              {
                role: "user",
                content: userMessage,
              },
            ],
            temperature: 0.7,
            max_tokens: 3000,
          }),
        })

        if (!openaiResponse.ok) {
          const errorData = await openaiResponse.json().catch(() => ({}))
          console.error(`[${requestId}] OpenAI error:`, errorData)
          console.log(`[${requestId}] Falling back to deterministic plan`)
        } else {
          const openaiData = await openaiResponse.json()
          const aiContent = openaiData.choices?.[0]?.message?.content || ""

          console.log(`[${requestId}] OpenAI response received (${aiContent.length} chars)`)

          // Parse AI response
          if (looksLikeValidJson(aiContent)) {
            const candidatePlan = parseFuelingPlanResponse(aiContent)

            if (candidatePlan) {
              console.log(`[${requestId}] AI response parsed as JSON`)

              // Validate AI plan
              const aiValidation = validateFuelingPlan(candidatePlan, athlete, workout, targets)
              if (aiValidation.ok) {
                finalPlan = candidatePlan
                usedFallback = false
                console.log(`[${requestId}] ✅ AI plan validated, using enhanced plan`)

                // Log AI request to database
                try {
                  const latency = Date.now() - requestStartTime
                  await supabase.from("ai_requests").insert({
                    user_id: user.id,
                    provider: "openai",
                    model: "gpt-4o-mini",
                    response_json: candidatePlan,
                    status: "success",
                    latency_ms: latency,
                    tokens: openaiData.usage?.total_tokens || null,
                  })
                } catch (logError) {
                  console.warn(`[${requestId}] Failed to log AI request:`, logError)
                }
              } else {
                console.warn(`[${requestId}] ⚠️ AI plan validation failed:`, aiValidation.errors)
                console.log(`[${requestId}] Falling back to deterministic plan`)
              }
            } else {
              console.warn(`[${requestId}] Failed to parse AI response as FuelingPlan`)
              console.log(`[${requestId}] Falling back to deterministic plan`)
            }
          } else {
            console.warn(`[${requestId}] AI response does not look like valid JSON`)
            console.log(`[${requestId}] Falling back to deterministic plan`)
          }
        }
      } catch (aiError) {
        console.error(`[${requestId}] AI enhancement failed:`, aiError)
        console.log(`[${requestId}] Falling back to deterministic plan`)
      }
    } else {
      console.log(`[${requestId}] No OpenAI API key, using deterministic plan only`)
    }

    // ============================================
    // STEP 3: SAVE TO DATABASE (OPTIONAL)
    // ============================================
    let savedId = null
    let saveError = null

    if (save) {
      try {
        const nutritionData = {
          user_id: user.id,
          workout_id: workoutId || null,
          workout_date: workoutDate || new Date().toISOString().split("T")[0],
          workout_start_time: workoutStartTime || null,
          workout_duration_min: durationMinutes,
          workout_type: workoutType || sport || "mixed",

          // Store deterministic targets
          during_carbs_g_per_hour: targets.carbs_g_per_h,
          during_hydration_ml_per_hour: targets.fluids_ml_per_h,
          during_electrolytes_mg: targets.sodium_mg_per_h,

          // Full plan
          nutrition_plan_json: JSON.stringify(finalPlan),

          // Metadata
          used_ai_enhancement: !usedFallback,
        }

        const { data: savedRecord, error: dbError } = await supabase
          .from("workout_nutrition")
          .insert(nutritionData)
          .select("id")
          .single()

        if (dbError) {
          console.error(`[${requestId}] Failed to save nutrition plan:`, dbError)
          saveError = dbError.message
        } else if (savedRecord) {
          savedId = savedRecord.id
          console.log(`[${requestId}] Nutrition plan saved: ${savedId}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[${requestId}] Error saving nutrition plan:`, error)
        saveError = errorMessage
      }
    }

    if (save && saveError) {
      console.error(`[${requestId}] Aborting response due to save failure: ${saveError}`)
      return NextResponse.json(
        { error: `Failed to save nutrition plan: ${saveError}` },
        { status: 500 }
      )
    }

    // ============================================
    // STEP 4: RETURN RESPONSE
    // ============================================
    const latency = Date.now() - requestStartTime

    console.log(`[${requestId}] Request complete in ${latency}ms, returning response`)

    return NextResponse.json({
      ok: true,
      plan: finalPlan,
      targets,
      used_fallback: usedFallback,
      saved: !!savedId,
      recordId: savedId,
      generated_at: new Date().toISOString(),
      duration_min: durationMinutes,
      intensity: normalizedIntensity,
      requestId,
      latency_ms: latency,
    })
  } catch (error) {
    console.error(`[${requestId}] Error in nutrition endpoint:`, error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
