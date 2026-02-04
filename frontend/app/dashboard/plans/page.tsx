"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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

type CalendarItem = {
  id: string
  type: "meal" | "workout"
  date: string
  startTime: string
  durationMin: number
  locked?: boolean
  timeUnknown?: boolean
  manualOverride?: boolean
}

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
      
      // Also generate nutrition plans for workouts
      if (force) {
        const workouts = workoutsQuery.data ?? []
        for (const workout of workouts) {
          // Skip if nutrition already exists
          try {
            const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)
            if (duration > 0) {
              // Generate nutrition plan for this workout
              await fetch("/api/ai/nutrition/during-workout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workoutId: workout.id,
                  workoutDate: workout.workout_day,
                  workoutType: workout.workout_type,
                  durationMinutes: duration,
                  intensity: workout.if ? (parseFloat(workout.if as any) > 1.1 ? "high" : "moderate") : "moderate",
                  tss: workout.tss ?? 0,
                  description: workout.description ?? "",
                  workoutStartTime: workout.start_time ?? "18:00",
                  save: true,
                }),
              })
            }
          } catch (err) {
            console.warn(`Could not generate nutrition for workout ${workout.id}:`, err)
          }
        }
      }
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

  const workoutsByDayDistributed = useMemo(() => {
    const map = new Map<string, { workout: TpWorkout; startTime: string; endTime: string }[]>()
    const workouts = workoutsQuery.data ?? []

    const grouped = new Map<string, TpWorkout[]>()
    workouts.forEach((workout) => {
      if (!grouped.has(workout.workout_day)) {
        grouped.set(workout.workout_day, [])
      }
      grouped.get(workout.workout_day)?.push(workout)
    })

    grouped.forEach((dayWorkouts, day) => {
      const distributed: { workout: TpWorkout; startTime: string; endTime: string }[] = []

      dayWorkouts.forEach((workout) => {
        const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)

        // Always use the start_time from the database
        const fallback = normalizeTime(workout.start_time, "18:00")
        const startTime = fallback.time

        const endTime = addMinutesToTime(startTime, duration)
        distributed.push({ workout, startTime, endTime })
      })

      // Sort by start time
      distributed.sort((a, b) => a.startTime.localeCompare(b.startTime))
      
      map.set(day, distributed)
    })

    return map
  }, [workoutsQuery.data])

  const baseCalendarItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = []

    ;(weekMealsQuery.data ?? []).forEach((meal) => {
      const fallbackTime = getMealFallbackTime(meal.slot)
      const baseTime = normalizeTime(meal.time ?? null, fallbackTime)
      const duration = getMealDurationMinutes(meal.kcal)
      items.push({
        id: meal.id,
        type: "meal",
        date: meal.date,
        startTime: baseTime.time,
        durationMin: duration,
        locked: meal.locked ?? false,
        timeUnknown: baseTime.isUnknown,
        manualOverride: false,
      })
    })

    workoutsByDayDistributed.forEach((dayWorkouts) => {
      dayWorkouts.forEach(({ workout, startTime }) => {
        const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)
        items.push({
          id: `workout-${workout.id}`,
          type: "workout",
          date: workout.workout_day,
          startTime,
          durationMin: duration,
        })
      })
    })

    return items
  }, [weekMealsQuery.data, workoutsByDayDistributed])

  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([])

  useEffect(() => {
    setCalendarItems(baseCalendarItems)
  }, [baseCalendarItems])

  const calendarById = useMemo(() => {
    const map = new Map<string, CalendarItem>()
    calendarItems.forEach((item) => map.set(item.id, item))
    return map
  }, [calendarItems])

  const workoutsById = useMemo(() => {
    const map = new Map<number, TpWorkout>()
    ;(workoutsQuery.data ?? []).forEach((workout) => map.set(workout.id, workout))
    return map
  }, [workoutsQuery.data])

  const workoutsByDayForRender = useMemo(() => {
    const map = new Map<string, { workout: TpWorkout; startTime: string; endTime: string; duration: number }[]>()
    calendarItems.forEach((item) => {
      if (item.type !== "workout") return
      const workoutId = Number(item.id.replace("workout-", ""))
      const workout = workoutsById.get(workoutId)
      if (!workout) return
      const endTime = addMinutesToTime(item.startTime, item.durationMin)
      if (!map.has(item.date)) {
        map.set(item.date, [])
      }
      map.get(item.date)?.push({ workout, startTime: item.startTime, endTime, duration: item.durationMin })
    })
    map.forEach((entries) => {
      entries.sort((a, b) => a.startTime.localeCompare(b.startTime))
    })
    return map
  }, [calendarItems, workoutsById])

  const handleDragEnd = useCallback(async (item: ScheduleItem, newDate: string, newStartTime: string) => {
    if (!item.source || item.locked) {
      console.warn(`[handleDragEnd] Drag rejected: no source or locked`, {
        hasSource: !!item.source,
        isLocked: item.locked,
      })
      return
    }
    if (item.date === newDate && item.startTime === newStartTime) {
      console.log(`[handleDragEnd] No position change, skipping`)
      return
    }

    console.log(`[handleDragEnd] Updating ${item.source.type}:`, {
      title: item.title,
      fromDate: item.date,
      fromTime: item.startTime,
      toDate: newDate,
      toTime: newStartTime,
    })

    const previousItems = calendarItems
    setCalendarItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              date: newDate,
              startTime: newStartTime,
              timeUnknown: item.source?.type === "meal" ? false : entry.timeUnknown,
              manualOverride: item.source?.type === "meal" ? true : entry.manualOverride,
            }
          : entry,
      ),
    )

    // Check if item actually moved
    try {
      if (!item.source) {
        console.warn(`[handleDragEnd] Item has no source:`, item)
        throw new Error("Item source not defined")
      }
      
      const payload = {
        itemId: item.source.sourceId,
        itemType: item.source.type,
        sourceTable: item.source.sourceTable,
        newDate,
        newStartTime,
      }
      console.log(`[handleDragEnd] Sending request:`, payload)
      
      const response = await fetch("/api/v1/plans/update-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let errorData
        const text = await response.text()
        console.log(`[handleDragEnd] Response text (${response.status}):`, text)
        try {
          errorData = JSON.parse(text)
        } catch {
          errorData = { error: text || `HTTP ${response.status}` }
        }
        console.error(
          `[handleDragEnd] API error (${response.status}):`,
          JSON.stringify(errorData),
          "parsed object:",
          errorData
        )
        const errorMessage = errorData?.error || errorData?.message || `Failed to update item (${response.status})`
        console.error(`[handleDragEnd] Will throw error:`, errorMessage)
        throw new Error(errorMessage)
      }
      const result = await response.json().catch(() => null)
      console.log(`[handleDragEnd] API success:`, result)

      toast({
        title: "Item moved",
        description: `${item.title} moved to ${format(new Date(newDate), "EEEE")} at ${newStartTime}`,
      })
    } catch (error) {
      setCalendarItems(previousItems)
      toast({
        title: "Failed to move item",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
      return
    }
    await queryClient.invalidateQueries({ queryKey: ["db", "plan-week"] })
    await queryClient.invalidateQueries({ queryKey: ["db", "workouts-range"] })
  }, [calendarItems, queryClient, toast])

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

    ;(weekMealsQuery.data ?? []).forEach((meal) => {
      const fallbackTime = getMealFallbackTime(meal.slot)
      const baseTime = normalizeTime(meal.time ?? null, fallbackTime)
      const calendarItem = calendarById.get(meal.id)
      const duration = calendarItem?.durationMin ?? getMealDurationMinutes(meal.kcal)
      const mealType = meal.meal_type?.toLowerCase() ?? ""
      const startTime = calendarItem?.startTime ?? baseTime.time
      const mealDate = calendarItem?.date ?? meal.date
      const dayWorkouts = workoutsByDayForRender.get(mealDate) ?? []
      const primaryWorkout = dayWorkouts[0]

      let itemStartTime = startTime
      let endTime = addMinutesToTime(startTime, duration)
      const isPreMeal = mealType.includes("pre")
      const isPostMeal = mealType.includes("post")
      let type: ScheduleItem["type"] = isPreMeal ? "nutrition_pre" : isPostMeal ? "nutrition_post" : "meal"

      const allowAutoOffset = !calendarItem?.manualOverride

      if (primaryWorkout && isPreMeal && allowAutoOffset) {
        itemStartTime = addMinutesToTime(primaryWorkout.startTime, -45)
        endTime = addMinutesToTime(itemStartTime, 20)
      }
      if (primaryWorkout && isPostMeal && allowAutoOffset) {
        itemStartTime = addMinutesToTime(primaryWorkout.endTime, 10)
        endTime = addMinutesToTime(itemStartTime, 20)
      }

      items.push({
        id: meal.id,
        type,
        date: mealDate,
        startTime: itemStartTime,
        endTime,
        title: meal.recipe?.title ?? meal.name,
        emoji: meal.emoji ?? "🥗",
        kcal: meal.kcal,
        macros: {
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
        },
        timeUnknown: calendarItem?.timeUnknown ?? baseTime.isUnknown,
        locked: meal.locked ?? false,
        source: {
          type: "meal",
          sourceTable: "nutrition_meals",
          sourceId: meal.id,
        },
        meta: { meal },
      })
    })

    // Add distributed workouts
    workoutsByDayForRender.forEach((dayWorkouts, day) => {
      dayWorkouts.forEach(({ workout, startTime, endTime, duration }) => {
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
        
        const workoutDuration = duration

        items.push({
          id: `workout-${workout.id}`,
          type: "workout",
          date: day,
          startTime,
          endTime,
          title,
          emoji,
          detail: `${workoutDuration} min`,
          timeUnknown: false,
          locked: false, // Workouts are not locked by default
          source: {
            type: "workout",
            sourceTable: "tp_workouts",
            sourceId: String(workout.id),
          },
          meta: { workout },
        })

        // Note: Intra-workout fuel display is now shown in the nutrition strategy
        // within the workout details modal instead of as calendar items
        // const intraFuel = planRowsByDay.get(day)
        // if (intraFuel && intraFuel > 0) {
        //   items.push({...})
        // }
      })
    })

    return items
  }, [calendarById, planRowsByDay, weekMealsQuery.data, workoutsByDayForRender])

  return (
    <main className="flex-1 p-8 overflow-hidden flex flex-col">
      <WeeklyPlanHeader
        weekLabel={weekLabel}
        onPrevWeek={() => setAnchorDate(addWeeks(anchorDate, -1))}
        onNextWeek={() => setAnchorDate(addWeeks(anchorDate, 1))}
        onThisWeek={() => setAnchorDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        onRegenerateWeek={handleRegenerateWeek}
        onResetWeek={handleResetWeek}
        isGenerating={isGenerating}
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl space-y-6 mt-6">
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
      </div>

      <div className="flex-shrink-0">
        <div className="max-w-6xl mx-auto bg-card border border-border rounded-full px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm mt-8">
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
      <WorkoutDetailsModal
        open={workoutDetailsOpen}
        onOpenChange={setWorkoutDetailsOpen}
        workout={selectedWorkout}
        nearbyMeals={selectedWorkout ? (weekMealsQuery.data ?? [])
          .filter(m => m.date === selectedWorkout.workout_day)
          .map(m => ({
            type: m.meal_type || "Meal",
            time: m.time || "Unknown",
            date: m.date,
          })) : undefined}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["db", "workouts-range"] })
        }}
      />
    </main>
  )
}
