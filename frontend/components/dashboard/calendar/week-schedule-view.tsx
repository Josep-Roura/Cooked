"use client"

import { useMemo } from "react"
import { addWeeks, eachDayOfInterval, endOfWeek, format, startOfWeek } from "date-fns"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { WeeklyTimeGrid } from "@/components/dashboard/schedule/weekly-time-grid"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import { minutesToTime, timeToMinutes } from "@/components/dashboard/schedule/utils"
import { getMealEmoji } from "@/lib/utils/mealEmoji"
import { useNutritionMealsRange, useTrainingSessions, useUserEvents } from "@/lib/db/hooks"
import type { NutritionMeal } from "@/lib/db/types"

interface WeekScheduleViewProps {
  userId: string | null | undefined
  anchorDate: Date
  onAnchorChange: (date: Date) => void
}

function defaultMealTime(meal: NutritionMeal) {
  if (meal.time) return meal.time
  const label = meal.name.toLowerCase()
  if (label.includes("breakfast")) return "07:30"
  if (label.includes("lunch")) return "12:30"
  if (label.includes("dinner")) return "19:00"
  if (label.includes("snack")) return "16:00"
  return "12:00"
}

export function WeekScheduleView({ userId, anchorDate, onAnchorChange }: WeekScheduleViewProps) {
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekStartKey = format(weekStart, "yyyy-MM-dd")
  const weekEndKey = format(weekEnd, "yyyy-MM-dd")

  const mealsQuery = useNutritionMealsRange(userId, weekStartKey, weekEndKey)
  const workoutsQuery = useTrainingSessions(userId, weekStartKey, weekEndKey)
  const eventsQuery = useUserEvents(userId, weekStartKey, weekEndKey)

  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd])

  const scheduleItems = useMemo(() => {
    const mealItems = (mealsQuery.data ?? []).map((meal) => {
      const startTime = defaultMealTime(meal)
      const startMinutes = timeToMinutes(startTime)
      const duration = meal.name.toLowerCase().includes("snack") ? 20 : 35
      return {
        id: `meal-${meal.id}`,
        type: "meal",
        date: meal.date,
        startTime,
        endTime: minutesToTime(startMinutes + duration),
        title: meal.name,
        emoji: getMealEmoji(meal.name, null),
        kcal: meal.kcal ?? 0,
        protein_g: meal.protein_g ?? 0,
        carbs_g: meal.carbs_g ?? 0,
        fat_g: meal.fat_g ?? 0,
        meta: { meal },
      } as ScheduleItem
    })

    const workoutItems = (workoutsQuery.data ?? []).map((session) => {
      const startTime = session.time ?? "18:00"
      const startMinutes = timeToMinutes(startTime)
      return {
        id: `workout-${session.id}`,
        type: "workout",
        date: session.date,
        startTime,
        endTime: minutesToTime(startMinutes + Math.max(session.durationMinutes, 30)),
        title: session.title,
        emoji: session.type === "run" ? "🏃" : session.type === "bike" ? "🚴" : session.type === "swim" ? "🏊" : "💪",
        meta: { session },
      } as ScheduleItem
    })

    const eventItems = (eventsQuery.data ?? []).map((event) => {
      const startTime = event.time ?? "12:00"
      const startMinutes = timeToMinutes(startTime)
      return {
        id: `event-${event.id}`,
        type: "event",
        date: event.date,
        startTime,
        endTime: minutesToTime(startMinutes + 30),
        title: event.title,
        emoji: "📌",
        meta: { event },
      } as ScheduleItem
    })

    return [...mealItems, ...workoutItems, ...eventItems]
  }, [eventsQuery.data, mealsQuery.data, workoutsQuery.data])

  if (mealsQuery.isError || workoutsQuery.isError || eventsQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          mealsQuery.refetch()
          workoutsQuery.refetch()
          eventsQuery.refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onAnchorChange(addWeeks(anchorDate, -1))}>
            Prev week
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAnchorChange(new Date())}>
            This week
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAnchorChange(addWeeks(anchorDate, 1))}>
            Next week
          </Button>
        </div>
      </div>

      {mealsQuery.isLoading || workoutsQuery.isLoading ? (
        <Skeleton className="h-[720px] w-full" />
      ) : (
        <WeeklyTimeGrid days={days} items={scheduleItems} />
      )}
    </div>
  )
}
