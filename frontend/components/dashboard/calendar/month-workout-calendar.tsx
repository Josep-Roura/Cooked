"use client"

import { useMemo, useState } from "react"
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameDay,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { Bike, Dumbbell, ChevronLeft, ChevronRight, Bed, Footprints, Waves } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useMealSchedule, useMonthWorkouts } from "@/lib/db/hooks"
import type { MealScheduleItem, TpWorkout } from "@/lib/db/types"

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const workoutColors: Record<string, string> = {
  swim: "bg-cyan-500/10 text-cyan-600",
  bike: "bg-orange-500/10 text-orange-600",
  run: "bg-green-500/10 text-green-600",
  strength: "bg-purple-500/10 text-purple-600",
  rest: "bg-gray-500/10 text-gray-600",
  other: "bg-gray-500/10 text-gray-600",
}

function normalizeWorkoutType(type: string | null) {
  if (!type) return "other"
  const value = type.toLowerCase()
  if (value.includes("swim")) return "swim"
  if (value.includes("bike") || value.includes("cycle")) return "bike"
  if (value.includes("run")) return "run"
  if (value.includes("strength") || value.includes("gym")) return "strength"
  if (value.includes("rest")) return "rest"
  return "other"
}

function WorkoutIcon({ type }: { type: string }) {
  switch (type) {
    case "swim":
      return <Waves className="h-4 w-4" />
    case "bike":
      return <Bike className="h-4 w-4" />
    case "run":
      return <Footprints className="h-4 w-4" />
    case "strength":
      return <Dumbbell className="h-4 w-4" />
    case "rest":
      return <Bed className="h-4 w-4" />
    default:
      return <Footprints className="h-4 w-4" />
  }
}

function formatDuration(hours: number | null) {
  if (!hours || hours <= 0) return null
  const totalMinutes = Math.round(hours * 60)
  if (totalMinutes < 60) {
    return `${totalMinutes}m`
  }
  const hrs = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

function formatDistance(km: number | null) {
  if (!km || km <= 0) return null
  return `${km.toFixed(1)} km`
}

interface MonthWorkoutCalendarProps {
  userId: string | null | undefined
}

export function MonthWorkoutCalendar({ userId }: MonthWorkoutCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedWorkout, setSelectedWorkout] = useState<TpWorkout | null>(null)

  const year = currentDate.getFullYear()
  const monthIndex = currentDate.getMonth() + 1
  const workoutsQuery = useMonthWorkouts(userId, year, monthIndex)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const scheduleQuery = useMealSchedule(
    userId,
    format(calendarStart, "yyyy-MM-dd"),
    format(calendarEnd, "yyyy-MM-dd"),
  )

  const days = useMemo(() => {
    const result: Date[] = []
    let cursor = calendarStart
    while (cursor <= calendarEnd) {
      result.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return result
  }, [calendarStart, calendarEnd])

  const workoutsByDay = useMemo(() => {
    const map = new Map<string, TpWorkout[]>()
    workoutsQuery.data?.forEach((workout) => {
      const dateKey = workout.workout_day
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)?.push(workout)
    })
    return map
  }, [workoutsQuery.data])

  const mealsByDay = useMemo(() => {
    const map = new Map<string, MealScheduleItem[]>()
    scheduleQuery.data?.forEach((meal) => {
      if (!map.has(meal.date)) {
        map.set(meal.date, [])
      }
      map.get(meal.date)?.push(meal)
    })
    map.forEach((items) => items.sort((a, b) => a.slot - b.slot))
    return map
  }, [scheduleQuery.data])

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  if (workoutsQuery.isError || scheduleQuery.isError) {
    return <ErrorState onRetry={() => {
      workoutsQuery.refetch()
      scheduleQuery.refetch()
    }} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} type="button">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{format(currentDate, "MMMM yyyy")}</h1>
          <Button variant="ghost" size="icon" onClick={handleNextMonth} type="button">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <Button variant="outline" className="rounded-full px-4 text-xs" onClick={handleToday} type="button">
          Today
        </Button>
      </div>

      {workoutsQuery.isLoading ? (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-80 w-full" />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {weekDays.map((day) => (
              <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {days.map((date) => {
              const dateKey = format(date, "yyyy-MM-dd")
              const dayWorkouts = workoutsByDay.get(dateKey) ?? []
              const dayMeals = mealsByDay.get(dateKey) ?? []
              const visibleMeals = dayMeals.slice(0, 2)
              const inMonth = isSameMonth(date, currentDate)
              const isToday = isSameDay(date, new Date())
              return (
                <div
                  key={dateKey}
                  className={`border-b border-border/50 border-r border-border/50 p-3 min-h-[160px] flex flex-col gap-2 ${
                    inMonth ? "bg-background" : "bg-muted/20"
                  } ${isToday ? "bg-primary/10" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        inMonth ? "text-foreground" : "text-muted-foreground"
                      } ${isToday ? "text-primary" : ""}`}
                    >
                      {format(date, "d")}
                    </span>
                    {dayWorkouts.length > 0 && (
                      <span className="text-xs text-muted-foreground">{dayWorkouts.length} workouts</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[120px]">
                    {dayWorkouts.map((workout) => {
                      const type = normalizeWorkoutType(workout.workout_type)
                      const duration = formatDuration(workout.actual_hours ?? workout.planned_hours ?? null)
                      const distance = formatDistance(workout.actual_km ?? workout.planned_km ?? null)
                      const metrics = [duration, distance].filter(Boolean).join(" • ")
                      return (
                        <button
                          key={workout.id}
                          type="button"
                          onClick={() => setSelectedWorkout(workout)}
                          className="w-full text-left rounded-lg border border-border bg-background px-3 py-2 hover:bg-muted transition"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            <span className={`rounded-full p-1 ${workoutColors[type]}`}>
                              <WorkoutIcon type={type} />
                            </span>
                            <span className="truncate">{workout.title ?? workout.workout_type ?? "Workout"}</span>
                          </div>
                          {metrics && <div className="text-xs text-muted-foreground mt-1">{metrics}</div>}
                        </button>
                      )
                    })}
                    {visibleMeals.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {visibleMeals.map((meal) => (
                          <span
                            key={meal.id}
                            className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600"
                          >
                            {meal.name}
                          </span>
                        ))}
                        {dayMeals.length > visibleMeals.length && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            +{dayMeals.length - visibleMeals.length} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={Boolean(selectedWorkout)} onOpenChange={(open) => !open && setSelectedWorkout(null)}>
        <DialogContent>
          {selectedWorkout && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedWorkout.title ?? selectedWorkout.workout_type ?? "Workout"}</DialogTitle>
                <DialogDescription>
                  {format(new Date(selectedWorkout.workout_day), "EEEE, MMM d")}{" "}
                  {selectedWorkout.start_time ? `· ${selectedWorkout.start_time}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 text-sm text-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Type:</span>
                  <span>{selectedWorkout.workout_type ?? "Training"}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {formatDuration(selectedWorkout.actual_hours ?? selectedWorkout.planned_hours ?? null) && (
                    <span>Duration: {formatDuration(selectedWorkout.actual_hours ?? selectedWorkout.planned_hours ?? null)}</span>
                  )}
                  {formatDistance(selectedWorkout.actual_km ?? selectedWorkout.planned_km ?? null) && (
                    <span>Distance: {formatDistance(selectedWorkout.actual_km ?? selectedWorkout.planned_km ?? null)}</span>
                  )}
                  {selectedWorkout.tss ? <span>TSS: {Math.round(selectedWorkout.tss)}</span> : null}
                  {selectedWorkout.if ? <span>IF: {selectedWorkout.if.toFixed(2)}</span> : null}
                  {selectedWorkout.hr_avg ? <span>Avg HR: {Math.round(selectedWorkout.hr_avg)}</span> : null}
                  {selectedWorkout.power_avg ? <span>Avg Power: {Math.round(selectedWorkout.power_avg)}</span> : null}
                  {selectedWorkout.rpe ? <span>RPE: {selectedWorkout.rpe}</span> : null}
                </div>
                {selectedWorkout.description && (
                  <p className="text-sm text-muted-foreground">{selectedWorkout.description}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
