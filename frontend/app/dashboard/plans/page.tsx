"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { PlanDetailsModal } from "@/components/dashboard/plans/plan-details-modal"
import { WorkoutDetailsModal } from "@/components/dashboard/plans/workout-details-modal"
import { WeeklyPlanHeader } from "@/components/dashboard/plans/weekly-plan-header"
import { WeeklyTimeGrid } from "@/components/dashboard/schedule/weekly-time-grid"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import {
  addMinutesToTime,
  getMealDurationMinutes,
  getMealFallbackTime,
  getWorkoutDurationMinutes,
  normalizeTime,
} from "@/components/dashboard/schedule/utils"
import { useSession } from "@/hooks/use-session"
import {
  useNutritionPlanRowsRange,
  usePlanWeek,
  useWorkoutsRange,
} from "@/lib/db/hooks"
import { ensureNutritionPlanRange, useEnsureNutritionPlanRange } from "@/lib/nutrition/ensure"
import type { PlanWeekMeal, TpWorkout } from "@/lib/db/types"

export default function PlansPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<PlanWeekMeal | null>(null)
  const [workoutDetailsOpen, setWorkoutDetailsOpen] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<TpWorkout | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)


  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`

  const weekMealsQuery = usePlanWeek(user?.id, weekStartKey, weekEndKey)
  const workoutsQuery = useWorkoutsRange(user?.id, weekStartKey, weekEndKey)
  const planRowsQuery = useNutritionPlanRowsRange(user?.id, weekStartKey, weekEndKey)
  useEnsureNutritionPlanRange({ userId: user?.id, start: weekStartKey, end: weekEndKey, enabled: Boolean(user?.id) })

  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const workoutsByDay = useMemo(() => {
    const map = new Map<string, { start: string; end: string }[]>()
    ;(workoutsQuery.data ?? []).forEach((workout) => {
      const fallback = normalizeTime(workout.start_time, "18:00")
      const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)
      const endTime = addMinutesToTime(fallback.time, duration)
      if (!map.has(workout.workout_day)) {
        map.set(workout.workout_day, [])
      }
      map.get(workout.workout_day)?.push({ start: fallback.time, end: endTime })
    })
    return map
  }, [workoutsQuery.data])

  const planRowsByDay = useMemo(() => {
    const map = new Map<string, number>()
    ;(planRowsQuery.data ?? []).forEach((row) => map.set(row.date, row.intra_cho_g_per_h ?? 0))
    return map
  }, [planRowsQuery.data])

  const weeklyTotals = useMemo(() => {
    return (weekMealsQuery.data ?? []).reduce(
      (acc, meal) => {
        acc.kcal += meal.kcal ?? 0
        acc.protein += meal.protein_g ?? 0
        acc.carbs += meal.carbs_g ?? 0
        acc.fat += meal.fat_g ?? 0
        return acc
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    )
  }, [weekMealsQuery.data])

  const handleGenerateWeek = async (resetLocks = false, force = true) => {
    setIsGenerating(true)
    try {
      await ensureNutritionPlanRange({ start: weekStartKey, end: weekEndKey, force, resetLocks })
      await weekMealsQuery.refetch()
    } catch (error) {
      toast({
        title: "Plan generation failed",
        description: error instanceof Error ? error.message : "Unable to generate plan.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerateWeek = () => handleGenerateWeek(false, true)
  const handleResetWeek = () => handleGenerateWeek(true, true)

  const openMealDetails = (meal: PlanWeekMeal) => {
    setSelectedMeal(meal)
    setDetailsOpen(true)
  }

  const openWorkoutDetails = (workout: TpWorkout) => {
    setSelectedWorkout(workout)
    setWorkoutDetailsOpen(true)
  }

  const handleDragEnd = async (item: ScheduleItem, newDate: string, newStartTime: string) => {
    // Check if item actually moved
    if (item.date === newDate && item.startTime === newStartTime) {
      console.log("Item didn't move, skipping update")
      return
    }

    console.log(`Moving item ${item.id} (${item.type}) to ${newDate} at ${newStartTime}`)

    try {
      const response = await fetch("/api/v1/plans/update-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          itemType: item.type === "workout" ? "workout" : "meal",
          newDate,
          newStartTime,
        }),
      })

      console.log("API response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("API error:", errorData)
        throw new Error(errorData.error || `Failed to update item (${response.status})`)
      }

      const result = await response.json()
      console.log("API success:", result)

      // Invalidate queries to force fresh data fetch
      console.log("Invalidating queries...")
      await queryClient.invalidateQueries({ queryKey: ["db", "plan-week"] })
      await queryClient.invalidateQueries({ queryKey: ["db", "workouts-range"] })
      console.log("Queries invalidated successfully")

      toast({
        title: "Item moved",
        description: `${item.title} moved to ${format(new Date(newDate), "EEEE")} at ${newStartTime}`,
      })
    } catch (error) {
      console.error("Drag error:", error)
      toast({
        title: "Failed to move item",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    }
  }

  if (weekMealsQuery.isError || workoutsQuery.isError || planRowsQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          weekMealsQuery.refetch()
          workoutsQuery.refetch()
          planRowsQuery.refetch()
        }}
      />
    )
  }

  // Group workouts by day and distribute them (morning/afternoon)
  const workoutsByDayDistributed = useMemo(() => {
    const map = new Map<string, { workout: typeof workouts[0]; startTime: string; endTime: string }[]>()
    const workouts = workoutsQuery.data ?? []
    
    // Group by day first
    const grouped = new Map<string, typeof workouts>()
    workouts.forEach((workout) => {
      if (!grouped.has(workout.workout_day)) {
        grouped.set(workout.workout_day, [])
      }
      grouped.get(workout.workout_day)?.push(workout)
    })
    
    // Distribute workouts within each day
    grouped.forEach((dayWorkouts, day) => {
      const distributed: { workout: typeof workouts[0]; startTime: string; endTime: string }[] = []
      
      dayWorkouts.forEach((workout, index) => {
        const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)
        
        // If multiple workouts, distribute: first morning (08:00), second afternoon (17:00)
        let startTime: string
        if (dayWorkouts.length > 1) {
          if (index === 0) {
            startTime = "08:00" // Morning workout
          } else if (index === 1) {
            startTime = "17:00" // Afternoon workout
          } else {
            // Additional workouts spaced by 3 hours
            startTime = `${8 + index * 3}:00`.padStart(5, "0")
          }
        } else {
          // Single workout - use original time or default to 18:00
          const fallback = normalizeTime(workout.start_time, "18:00")
          startTime = fallback.time
        }
        
        const endTime = addMinutesToTime(startTime, duration)
        distributed.push({ workout, startTime, endTime })
      })
      
      map.set(day, distributed)
    })
    
    return map
  }, [workoutsQuery.data])

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = []

    ;(weekMealsQuery.data ?? []).forEach((meal) => {
      const fallbackTime = getMealFallbackTime(meal.slot)
      const baseTime = normalizeTime(meal.time ?? null, fallbackTime)
      const duration = getMealDurationMinutes(meal.kcal)
      const mealType = meal.meal_type?.toLowerCase() ?? ""
      const dayWorkouts = workoutsByDayDistributed.get(meal.date) ?? []
      const primaryWorkout = dayWorkouts[0]

      let startTime = baseTime.time
      let endTime = addMinutesToTime(baseTime.time, duration)
      let type: ScheduleItem["type"] = "meal"

      if (primaryWorkout && mealType.includes("pre")) {
        type = "nutrition_pre"
        startTime = addMinutesToTime(primaryWorkout.startTime, -45)
        endTime = addMinutesToTime(startTime, 20)
      }
      if (primaryWorkout && mealType.includes("post")) {
        type = "nutrition_post"
        startTime = addMinutesToTime(primaryWorkout.endTime, 10)
        endTime = addMinutesToTime(startTime, 20)
      }

      items.push({
        id: meal.id,
        type,
        date: meal.date,
        startTime,
        endTime,
        title: meal.recipe?.title ?? meal.name,
        emoji: meal.emoji ?? "🥗",
        kcal: meal.kcal,
        macros: {
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
        },
        timeUnknown: baseTime.isUnknown,
        locked: meal.locked ?? false,
        meta: { meal },
      })
    })

    // Add distributed workouts
    workoutsByDayDistributed.forEach((dayWorkouts) => {
      dayWorkouts.forEach(({ workout, startTime, endTime }) => {
        const title = workout.title ?? workout.workout_type ?? "Workout"
        const workoutType = workout.workout_type?.toLowerCase() ?? ""
        const emoji = workoutType.includes("swim")
          ? "🏊"
          : workoutType.includes("bike") || workoutType.includes("cycle")
            ? "🚴"
            : workoutType.includes("run")
              ? "🏃"
              : workoutType.includes("strength")
                ? "🏋️"
                : workoutType.includes("rest")
                  ? "🛌"
                  : "🏅"
        
        const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)

        items.push({
          id: `workout-${workout.id}`,
          type: "workout",
          date: workout.workout_day,
          startTime,
          endTime,
          title,
          emoji,
          detail: `${duration} min`,
          timeUnknown: false,
          locked: false, // Workouts are not locked by default
          meta: { workout },
        })

        const intraFuel = planRowsByDay.get(workout.workout_day)
        if (intraFuel && intraFuel > 0) {
          items.push({
            id: `fuel-${workout.id}`,
            type: "nutrition_during",
            date: workout.workout_day,
            startTime,
            endTime: addMinutesToTime(startTime, Math.min(duration, 15)),
            title: `Fuel ${intraFuel}g/hr`,
            emoji: "⚡",
            timeUnknown: false,
            locked: false,
            meta: { workout },
          })
        }
      })
    })

    return items
  }, [weekMealsQuery.data, workoutsByDayDistributed, planRowsByDay])

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl space-y-6">
        <WeeklyPlanHeader
          weekLabel={weekLabel}
          onPrevWeek={() => setAnchorDate(addWeeks(anchorDate, -1))}
          onNextWeek={() => setAnchorDate(addWeeks(anchorDate, 1))}
          onThisWeek={() => setAnchorDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          onRegenerateWeek={handleRegenerateWeek}
          onResetWeek={handleResetWeek}
          isGenerating={isGenerating}
        />

        {weekMealsQuery.isLoading || workoutsQuery.isLoading || planRowsQuery.isLoading ? (
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <Skeleton className="h-[520px] w-full" />
          </div>
        ) : (weekMealsQuery.data ?? []).length === 0 && (workoutsQuery.data ?? []).length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No meals planned for this week yet.</p>
            <Button
              variant="outline"
              className="rounded-full text-xs"
              onClick={() => handleGenerateWeek(false, true)}
              disabled={isGenerating}
            >
              Generate plan
            </Button>
          </div>
        ) : (
          <WeeklyTimeGrid
            days={days}
            items={scheduleItems}
            onSelectItem={(item) => {
              if (item.type === "meal" || item.type.startsWith("nutrition_")) {
                const meal = item.meta?.meal as PlanWeekMeal | undefined
                if (meal) {
                  openMealDetails(meal)
                }
              } else if (item.type === "workout") {
                const workout = item.meta?.workout as TpWorkout | undefined
                if (workout) {
                  openWorkoutDetails(workout)
                }
              }
            }}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>

      <div className="sticky bottom-6 mt-8">
        <div className="max-w-6xl mx-auto bg-card border border-border rounded-full px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="text-xs text-muted-foreground">Weekly totals</div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge variant="secondary">{weeklyTotals.kcal} kcal</Badge>
            <Badge variant="secondary">P {weeklyTotals.protein}g</Badge>
            <Badge variant="secondary">C {weeklyTotals.carbs}g</Badge>
            <Badge variant="secondary">F {weeklyTotals.fat}g</Badge>
          </div>
        </div>
      </div>

      <PlanDetailsModal open={detailsOpen} onOpenChange={setDetailsOpen} meal={selectedMeal} />
      <WorkoutDetailsModal open={workoutDetailsOpen} onOpenChange={setWorkoutDetailsOpen} workout={selectedWorkout} />
    </main>
  )
}
