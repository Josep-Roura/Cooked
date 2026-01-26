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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMonthWorkouts, useNutritionMealsRange } from "@/lib/db/hooks"
import type { NutritionMeal, TpWorkout } from "@/lib/db/types"

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
  const [today] = useState(() => new Date())
  const [selectedWorkout, setSelectedWorkout] = useState<TpWorkout | null>(null)

  const year = currentDate.getFullYear()
  const monthIndex = currentDate.getMonth() + 1
  const workoutsQuery = useMonthWorkouts(userId, year, monthIndex)
  const rangeStartKey = format(startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }), "yyyy-MM-dd")
  const rangeEndKey = format(endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }), "yyyy-MM-dd")
  const mealsQuery = useNutritionMealsRange(userId, rangeStartKey, rangeEndKey)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
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
    const map = new Map<string, NutritionMeal[]>()
    mealsQuery.data?.forEach((meal) => {
      const dateKey = meal.date
      if (!map.has(dateKey)) {
        map.set(dateKey, [])
      }
      map.get(dateKey)?.push(meal)
    })
    map.forEach((items) => items.sort((a, b) => a.slot - b.slot))
    return map
  }, [mealsQuery.data])


  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  if (workoutsQuery.isError || mealsQuery.isError) {
    return <ErrorState onRetry={() => {
      workoutsQuery.refetch()
      mealsQuery.refetch()
    }} />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 bg-background/95 py-2 backdrop-blur">
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

      {workoutsQuery.isLoading || mealsQuery.isLoading ? (
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
          <TooltipProvider>
            <div className="grid grid-cols-7 auto-rows-[minmax(180px,1fr)]">
            {days.map((date) => {
              const dateKey = format(date, "yyyy-MM-dd")
              const dayWorkouts = workoutsByDay.get(dateKey) ?? []
              const visibleWorkouts = dayWorkouts.slice(0, 2)
              const dayMeals = mealsByDay.get(dateKey) ?? []
              const visibleMeals = dayMeals.slice(0, 2)
              const inMonth = isSameMonth(date, currentDate)
              const isToday = isSameDay(date, today)
              return (
                <div
                  key={dateKey}
                  className={`border-b border-border/50 border-r border-border/50 p-3 min-h-[180px] flex flex-col gap-2 ${
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
                    {(dayWorkouts.length > 0 || dayMeals.length > 0) && (
                      <span className="text-xs text-muted-foreground">
                        {dayWorkouts.length} workouts · {dayMeals.length} meals
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 overflow-y-auto pr-1 max-h-[130px]">
                    {visibleWorkouts.map((workout) => {
                      const type = normalizeWorkoutType(workout.workout_type)
                      const duration = formatDuration(workout.actual_hours ?? workout.planned_hours ?? null)
                      const distance = formatDistance(workout.actual_km ?? workout.planned_km ?? null)
                      const metrics = [duration, distance].filter(Boolean).join(" • ")
                      return (
                        <Tooltip key={workout.id}>
                          <TooltipTrigger asChild>
                            <button
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
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            <div className="font-semibold">{workout.title ?? workout.workout_type ?? "Workout"}</div>
                            {metrics && <div className="text-muted-foreground">{metrics}</div>}
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                    {dayWorkouts.length > visibleWorkouts.length && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground w-fit">
                        +{dayWorkouts.length - visibleWorkouts.length} more
                      </span>
                    )}
                    {visibleMeals.map((meal) => (
                      <div
                        key={`${meal.date}-${meal.slot}`}
                        className="w-full rounded-lg border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-left"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                          <span className="truncate">🥗 {meal.name}</span>
                          <span>{meal.macros?.kcal ?? 0} kcal</span>
                        </div>
                        <div className="text-[10px] text-emerald-700/80 mt-1">
                          {meal.time ? `Time: ${meal.time}` : "Meal planned"}
                        </div>
                      </div>
                    ))}
                    {dayMeals.length > visibleMeals.length && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 w-fit">
                        +{dayMeals.length - visibleMeals.length} meals
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          </TooltipProvider>
        </div>
      )}

      <Sheet open={Boolean(selectedWorkout)} onOpenChange={(open) => !open && setSelectedWorkout(null)}>
        <SheetContent>
          {selectedWorkout && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedWorkout.title ?? selectedWorkout.workout_type ?? "Workout"}</SheetTitle>
                <SheetDescription>
                  {format(new Date(selectedWorkout.workout_day), "EEEE, MMM d")}{" "}
                  {selectedWorkout.start_time ? `· ${selectedWorkout.start_time}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-3 text-sm text-foreground mt-6">
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
                {selectedWorkout.coach_comments && (
                  <p className="text-sm text-muted-foreground">{selectedWorkout.coach_comments}</p>
                )}
                {selectedWorkout.athlete_comments && (
                  <p className="text-sm text-muted-foreground">{selectedWorkout.athlete_comments}</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
