"use client"

import { useState, useCallback, useEffect } from "react"
import { Loader } from "lucide-react"
import { WorkoutNutritionTimeline } from "@/components/nutrition/workout-nutrition-timeline"
import type { TpWorkout } from "@/lib/db/types"

interface SessionNutritionToggleProps {
  sessionId: string
  date: string
  workout?: TpWorkout | null
}

export function SessionNutritionToggle({
  sessionId,
  date,
  workout,
}: SessionNutritionToggleProps) {
  const [nutritionPlan, setNutritionPlan] = useState<any>(null)
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false)

  // Load or generate nutrition plan
  const loadNutritionPlan = useCallback(async () => {
    if (!workout) {
      console.log("[SessionNutritionToggle] No workout provided")
      return
    }

    console.log("[SessionNutritionToggle] Loading nutrition for workout:", workout.id, "date:", date)
    setIsLoadingNutrition(true)
    
    try {
      // First try to load existing nutrition plan from database
      const response = await fetch(
        `/api/v1/nutrition/during-workout?startDate=${date}&endDate=${date}&limit=50`,
        { method: "GET" }
      )

      console.log("[SessionNutritionToggle] API response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        const records = data.records ?? []
        console.log("[SessionNutritionToggle] Found records:", records.length)

        // Find matching record by workout_id
        const matchingRecord = records.find((r: any) =>
          String(r.workout_id) === String(workout.id)
        )

        console.log("[SessionNutritionToggle] Matching record:", matchingRecord)

        if (matchingRecord) {
          // Try nutrition_plan_json first
          if (matchingRecord.nutrition_plan_json) {
            try {
              const plan = typeof matchingRecord.nutrition_plan_json === "string"
                ? JSON.parse(matchingRecord.nutrition_plan_json)
                : matchingRecord.nutrition_plan_json
              console.log("[SessionNutritionToggle] Loaded nutrition_plan_json:", plan)
              setNutritionPlan(plan)
              setIsLoadingNutrition(false)
              return
            } catch (e) {
              console.warn("Failed to parse nutrition_plan_json:", e)
            }
          }

          // Try during_workout_recommendation as fallback
          if (matchingRecord.during_workout_recommendation) {
            try {
              const plan = typeof matchingRecord.during_workout_recommendation === "string"
                ? JSON.parse(matchingRecord.during_workout_recommendation)
                : matchingRecord.during_workout_recommendation
              console.log("[SessionNutritionToggle] Loaded during_workout_recommendation:", plan)
              setNutritionPlan(plan)
              setIsLoadingNutrition(false)
              return
            } catch (e) {
              console.warn("Failed to parse during_workout_recommendation:", e)
            }
          }
        }
      }

      // If no existing plan found, try to generate one
      console.log("[SessionNutritionToggle] No existing plan found, attempting to generate...")
      const generateResponse = await fetch("/api/ai/nutrition/during-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutId: workout.id,
          workoutDate: date,
          workoutType: workout.workout_type,
          durationMinutes: workout.actual_hours
            ? Math.round(workout.actual_hours * 60)
            : workout.planned_hours
            ? Math.round(workout.planned_hours * 60)
            : 60,
          workoutStartTime: workout.start_time || "06:00",
          intensity: "moderate",
          save: true, // Save to database
        }),
      })

      if (generateResponse.ok) {
        const generateData = await generateResponse.json()
        console.log("[SessionNutritionToggle] Generated plan response:", generateData)
        
        // The API returns the plan in either 'plan' or 'nutrition' field
        const plan = generateData.plan || generateData.nutrition
        
        if (plan) {
          console.log("[SessionNutritionToggle] Set generated plan:", plan)
          setNutritionPlan(plan)
        } else {
          console.warn("[SessionNutritionToggle] No plan in response:", generateData)
        }
      } else {
        console.warn("[SessionNutritionToggle] Failed to generate plan, status:", generateResponse.status)
        const errorData = await generateResponse.json().catch(() => ({}))
        console.warn("[SessionNutritionToggle] Error response:", errorData)
      }
    } catch (error) {
      console.error("Error loading nutrition plan:", error)
    } finally {
      setIsLoadingNutrition(false)
    }
  }, [workout, date])

  // Load nutrition when component mounts
  useEffect(() => {
    if (!nutritionPlan && !isLoadingNutrition && workout) {
      loadNutritionPlan()
    }
  }, [nutritionPlan, isLoadingNutrition, loadNutritionPlan, workout])

  if (!workout) {
    return null
  }

  if (isLoadingNutrition) {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading nutrition plan...</span>
        </div>
      </div>
    )
  }

  if (!nutritionPlan) {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="text-xs text-muted-foreground">No nutrition plan available</div>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      {/* Temporarily removed scale-90 to debug visibility */}
      <div className="">
        <WorkoutNutritionTimeline
          plan={nutritionPlan}
          workoutDuration={
            workout.actual_hours
              ? Math.round(workout.actual_hours * 60)
              : workout.planned_hours
              ? Math.round(workout.planned_hours * 60)
              : 60
          }
          workoutStartTime={workout.start_time ?? "06:00"}
        />
      </div>
    </div>
  )
}
