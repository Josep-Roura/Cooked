"use client"

import { useState, useCallback, useEffect } from "react"
import { ChevronDown, Loader } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { WorkoutNutritionTimeline } from "@/components/nutrition/workout-nutrition-timeline"
import type { TpWorkout } from "@/lib/db/types"

interface SessionNutritionToggleProps {
  sessionId: string
  date: string
  workout?: TpWorkout | null
  isLoading?: boolean
}

export function SessionNutritionToggle({
  sessionId,
  date,
  workout,
  isLoading = false,
}: SessionNutritionToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [nutritionPlan, setNutritionPlan] = useState<any>(null)
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false)
  const { toast } = useToast()

  // Load nutrition plan from existing record in DB
  const loadNutritionPlan = useCallback(async () => {
    if (!workout) return

    setIsLoadingNutrition(true)
    try {
      // Load nutrition plan from database
      const response = await fetch(
        `/api/v1/nutrition/during-workout?startDate=${date}&endDate=${date}&limit=50`,
        { method: "GET" }
      )

      if (response.ok) {
        const data = await response.json()
        const records = data.records ?? []

        // Find matching record by workout_id
        const matchingRecord = records.find((r: any) =>
          String(r.workout_id) === String(workout.id)
        )

        if (matchingRecord) {
          // Try nutrition_plan_json first
          if (matchingRecord.nutrition_plan_json) {
            try {
              const plan = typeof matchingRecord.nutrition_plan_json === "string"
                ? JSON.parse(matchingRecord.nutrition_plan_json)
                : matchingRecord.nutrition_plan_json
              setNutritionPlan(plan)
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
              setNutritionPlan(plan)
              return
            } catch (e) {
              console.warn("Failed to parse during_workout_recommendation:", e)
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading nutrition plan:", error)
    } finally {
      setIsLoadingNutrition(false)
    }
  }, [workout, date])

  // Load nutrition when component mounts or when expanded
  useEffect(() => {
    if (isExpanded && !nutritionPlan && !isLoadingNutrition && workout) {
      loadNutritionPlan()
    }
  }, [isExpanded, nutritionPlan, isLoadingNutrition, loadNutritionPlan, workout])

  if (isLoading || !workout) {
    return null
  }

  return (
    <div className="pt-3 border-t border-border/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 px-0 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded transition-colors"
      >
        <span>⚡ Nutrition</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          {isLoadingNutrition ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading nutrition plan...</span>
            </div>
          ) : nutritionPlan ? (
            <div className="scale-95 origin-top-left">
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
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              No nutrition plan available
            </div>
          )}
        </div>
      )}
    </div>
  )
}
