"use client"

import { useMemo, useState } from "react"
import { addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { PlanDetailsModal } from "@/components/dashboard/plans/plan-details-modal"
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
import type { PlanWeekMeal } from "@/lib/db/types"

export default function PlansPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedMeal, setSelectedMeal] = useState<PlanWeekMeal | null>(null)
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

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = []
    const workouts = workoutsQuery.data ?? []

    ;(weekMealsQuery.data ?? []).forEach((meal) => {
      const fallbackTime = getMealFallbackTime(meal.slot)
      const baseTime = normalizeTime(meal.time ?? null, fallbackTime)
      const duration = getMealDurationMinutes(meal.kcal)
      const mealType = meal.meal_type?.toLowerCase() ?? ""
      const dayWorkouts = workoutsByDay.get(meal.date) ?? []
      const primaryWorkout = dayWorkouts[0]

      let startTime = baseTime.time
      let endTime = addMinutesToTime(baseTime.time, duration)
      let type: ScheduleItem["type"] = "meal"

      if (primaryWorkout && mealType.includes("pre")) {
        type = "nutrition_pre"
        startTime = addMinutesToTime(primaryWorkout.start, -45)
        endTime = addMinutesToTime(startTime, 20)
      }
      if (primaryWorkout && mealType.includes("post")) {
        type = "nutrition_post"
        startTime = addMinutesToTime(primaryWorkout.end, 10)
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
        meta: { meal },
      })
    })

    workouts.forEach((workout) => {
      const fallback = normalizeTime(workout.start_time, "18:00")
      const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)
      const endTime = addMinutesToTime(fallback.time, duration)
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

      items.push({
        id: `workout-${workout.id}`,
        type: "workout",
        date: workout.workout_day,
        startTime: fallback.time,
        endTime,
        title,
        emoji,
        detail: workout.planned_hours || workout.actual_hours ? `${duration} min` : null,
        timeUnknown: fallback.isUnknown,
        meta: { workout },
      })

      const intraFuel = planRowsByDay.get(workout.workout_day)
      if (intraFuel && intraFuel > 0) {
        items.push({
          id: `fuel-${workout.id}`,
          type: "nutrition_during",
          date: workout.workout_day,
          startTime: fallback.time,
          endTime: addMinutesToTime(fallback.time, Math.min(duration, 15)),
          title: `Fuel ${intraFuel}g/hr`,
          emoji: "⚡",
          timeUnknown: fallback.isUnknown,
          meta: { workout },
        })
      }
    })

    return items
  }, [weekMealsQuery.data, workoutsQuery.data, workoutsByDay, planRowsByDay])

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
              }
            }}
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
    </main>
  )
}
