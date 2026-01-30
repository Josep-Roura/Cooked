"use client"

import { useMemo, useState } from "react"
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CalendarMonthGrid, type CalendarMonthItem } from "@/components/dashboard/calendar/calendar-month-grid"
import { WeeklyTimeGrid } from "@/components/dashboard/schedule/weekly-time-grid"
import { NotionModal } from "@/components/ui/notion-modal"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import {
  addMinutesToTime,
  getMealDurationMinutes,
  getMealFallbackTime,
  getWorkoutDurationMinutes,
  normalizeTime,
} from "@/components/dashboard/schedule/utils"
import { useSession } from "@/hooks/use-session"
import { useNutritionMealsRange, useUserEvents, useWorkoutsRange } from "@/lib/db/hooks"

export default function CalendarPage() {
  const { user } = useSession()
  const [view, setView] = useState<"month" | "week">("month")
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)
  const [selectedMonthItem, setSelectedMonthItem] = useState<CalendarMonthItem | null>(null)

  const rangeStart = view === "month"
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    : startOfWeek(currentDate, { weekStartsOn: 1 })
  const rangeEnd = view === "month"
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    : endOfWeek(currentDate, { weekStartsOn: 1 })

  const rangeStartKey = format(rangeStart, "yyyy-MM-dd")
  const rangeEndKey = format(rangeEnd, "yyyy-MM-dd")

  const workoutsQuery = useWorkoutsRange(user?.id, rangeStartKey, rangeEndKey)
  const mealsQuery = useNutritionMealsRange(user?.id, rangeStartKey, rangeEndKey)
  const eventsQuery = useUserEvents(user?.id, rangeStartKey, rangeEndKey)

  const calendarDays = useMemo(() => {
    const days: Date[] = []
    let cursor = rangeStart
    while (cursor <= rangeEnd) {
      days.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return days
  }, [rangeStart, rangeEnd])

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [currentDate])

  const monthItems = useMemo<CalendarMonthItem[]>(() => {
    const items: CalendarMonthItem[] = []

    ;(workoutsQuery.data ?? []).forEach((workout) => {
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
        date: workout.workout_day,
        label: `${emoji} ${workout.title ?? workout.workout_type ?? "Workout"}`,
        tone: "workout",
      })
    })

    ;(eventsQuery.data ?? []).forEach((event) => {
      items.push({
        id: `event-${event.id}`,
        date: event.date,
        label: `📌 ${event.title}`,
        tone: "event",
      })
    })

    ;(mealsQuery.data ?? []).forEach((meal) => {
      items.push({
        id: `meal-${meal.id}`,
        date: meal.date,
        label: `🥗 ${meal.name}`,
        tone: "meal",
      })
    })

    return items
  }, [workoutsQuery.data, eventsQuery.data, mealsQuery.data])

  const scheduleItems = useMemo<ScheduleItem[]>(() => {
    const items: ScheduleItem[] = []

    ;(mealsQuery.data ?? []).forEach((meal) => {
      const fallback = normalizeTime(meal.time ?? null, getMealFallbackTime(meal.slot))
      const duration = getMealDurationMinutes(meal.macros?.kcal ?? meal.kcal ?? null)
      const endTime = addMinutesToTime(fallback.time, duration)
      items.push({
        id: `meal-${meal.id}`,
        type: "meal",
        date: meal.date,
        startTime: fallback.time,
        endTime,
        title: meal.name,
        emoji: "🥗",
        kcal: meal.macros?.kcal ?? meal.kcal ?? null,
        macros: {
          protein_g: meal.macros?.protein_g ?? meal.protein_g ?? null,
          carbs_g: meal.macros?.carbs_g ?? meal.carbs_g ?? null,
          fat_g: meal.macros?.fat_g ?? meal.fat_g ?? null,
        },
        timeUnknown: fallback.isUnknown,
        meta: { meal },
      })
    })

    ;(workoutsQuery.data ?? []).forEach((workout) => {
      const fallback = normalizeTime(workout.start_time, "18:00")
      const duration = getWorkoutDurationMinutes(workout.actual_hours ?? workout.planned_hours ?? null)
      const endTime = addMinutesToTime(fallback.time, duration)
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
        title: workout.title ?? workout.workout_type ?? "Workout",
        emoji,
        detail: `${duration} min`,
        timeUnknown: fallback.isUnknown,
        meta: { workout },
      })
    })

    ;(eventsQuery.data ?? []).forEach((event) => {
      const fallback = normalizeTime(event.time, "12:00")
      const endTime = addMinutesToTime(fallback.time, 60)
      items.push({
        id: `event-${event.id}`,
        type: "event",
        date: event.date,
        startTime: fallback.time,
        endTime,
        title: event.title,
        emoji: "📌",
        timeUnknown: fallback.isUnknown,
        meta: { event },
      })
    })

    return items
  }, [mealsQuery.data, workoutsQuery.data, eventsQuery.data])

  const selectedDetails = useMemo(() => {
    if (selectedItem) {
      const detailLines: string[] = []
      if (selectedItem.kcal) {
        detailLines.push(`${selectedItem.kcal} kcal`)
      }
      if (selectedItem.macros?.protein_g || selectedItem.macros?.carbs_g || selectedItem.macros?.fat_g) {
        const macros = [
          selectedItem.macros?.protein_g ? `P ${selectedItem.macros.protein_g}g` : null,
          selectedItem.macros?.carbs_g ? `C ${selectedItem.macros.carbs_g}g` : null,
          selectedItem.macros?.fat_g ? `F ${selectedItem.macros.fat_g}g` : null,
        ]
          .filter(Boolean)
          .join(" · ")
        if (macros) detailLines.push(macros)
      }
      return {
        title: selectedItem.title,
        subtitle: `${selectedItem.date} · ${selectedItem.startTime}–${selectedItem.endTime}`,
        details: detailLines,
      }
    }
    if (selectedMonthItem) {
      return {
        title: selectedMonthItem.label,
        subtitle: selectedMonthItem.date,
        details: [],
      }
    }
    return null
  }, [selectedItem, selectedMonthItem])

  const handlePrev = () => {
    if (view === "month") {
      setCurrentDate((prev) => addMonths(prev, -1))
    } else {
      setCurrentDate((prev) => addWeeks(prev, -1))
    }
  }

  const handleNext = () => {
    if (view === "month") {
      setCurrentDate((prev) => addMonths(prev, 1))
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1))
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  if (workoutsQuery.isError || mealsQuery.isError || eventsQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          workoutsQuery.refetch()
          mealsQuery.refetch()
          eventsQuery.refetch()
        }}
      />
    )
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 bg-background/95 py-2 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={handlePrev} type="button">
              <span className="sr-only">Previous</span>
              <span className="text-lg">‹</span>
            </Button>
            <h1 className="text-2xl font-bold text-foreground">
              {view === "month"
                ? format(currentDate, "MMMM yyyy")
                : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(
                    endOfWeek(currentDate, { weekStartsOn: 1 }),
                    "MMM d",
                  )}`}
            </h1>
            <Button variant="outline" size="icon" onClick={handleNext} type="button">
              <span className="sr-only">Next</span>
              <span className="text-lg">›</span>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => value && setView(value as "month" | "week")}
              className="rounded-full border border-border/60 bg-muted/30 p-1"
            >
              <ToggleGroupItem value="month" className="rounded-full px-3 text-xs">
                Month
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="rounded-full px-3 text-xs">
                Week
              </ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={handleToday} type="button">
              Today
            </Button>
          </div>
        </div>

        {workoutsQuery.isLoading || mealsQuery.isLoading || eventsQuery.isLoading ? (
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <Skeleton className="h-[520px] w-full" />
          </div>
        ) : view === "month" ? (
          <CalendarMonthGrid
            days={calendarDays}
            currentDate={currentDate}
            items={monthItems}
            onSelectItem={(item) => {
              setSelectedItem(null)
              setSelectedMonthItem(item)
            }}
          />
        ) : (
          <WeeklyTimeGrid
            days={weekDays}
            items={scheduleItems}
            onSelectItem={(item) => {
              setSelectedMonthItem(null)
              setSelectedItem(item)
            }}
          />
        )}
      </div>

      <NotionModal
        open={Boolean(selectedDetails)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null)
            setSelectedMonthItem(null)
          }
        }}
        title={selectedDetails?.title ?? "Schedule item"}
        description={selectedDetails?.subtitle}
      >
        {selectedDetails?.details?.length ? (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {selectedDetails.details.map((detail) => (
              <span key={detail} className="rounded-full bg-muted px-3 py-1">
                {detail}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No additional details available.</p>
        )}
      </NotionModal>
    </main>
  )
}
