"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays, addWeeks, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { MealCards } from "@/components/dashboard/nutrition/meal-cards"
import { WeeklyCaloriesChart } from "@/components/dashboard/nutrition/weekly-calories-chart"
import { DailyMacroCards } from "@/components/dashboard/nutrition/daily-macro-cards"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import { DayNavigator } from "@/components/dashboard/widgets/day-navigator"
import {
  useMealPlanDay,
  useNutritionDayPlan,
  useProfile,
  useTrainingSessions,
  useUpdateNutritionDay,
  useUpdateMealPlanItem,
  useWeekRange,
  useWeeklyNutrition,
} from "@/lib/db/hooks"
import { useSession } from "@/hooks/use-session"
import { ensureNutritionPlanRange } from "@/lib/nutrition/ensure"
import { useDashboardDate } from "@/components/dashboard/dashboard-date-provider"

export default function NutritionPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const profileQuery = useProfile(user?.id)
  const { selectedDate, selectedDateKey, nextDay, prevDay, setSelectedDate } = useDashboardDate()
  const [search, setSearch] = useState("")
  const queryClient = useQueryClient()
  const generateLockRef = useRef<string | null>(null)

  const { start: weekStart, end: weekEnd, startKey: weekStartKey, endKey: weekEndKey } = useWeekRange(selectedDate)
  const weeklyNutritionQuery = useWeeklyNutrition(user?.id, weekStartKey, weekEndKey)
  const mealPlanQuery = useMealPlanDay(user?.id, selectedDateKey)
  const dayPlanQuery = useNutritionDayPlan(user?.id, selectedDateKey)
  const trainingWeekQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)
  const updateMealMutation = useUpdateMealPlanItem()
  const updateNutritionDay = useUpdateNutritionDay(user?.id)
  const fuelEnsureRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    if (trainingWeekQuery.isLoading || weeklyNutritionQuery.isLoading) return
    const workouts = trainingWeekQuery.data ?? []
    if (workouts.length === 0) return
    const days = weeklyNutritionQuery.data ?? []
    const missing = days.some((day) => !day.target)
    if (!missing) return
    const lockKey = `${user.id}:${weekStartKey}:${weekEndKey}`
    if (generateLockRef.current === lockKey) return
    generateLockRef.current = lockKey
    ensureNutritionPlanRange({ start: weekStartKey, end: weekEndKey })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["db", "nutrition-week", user.id, weekStartKey, weekEndKey] })
        queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day", user.id, selectedDateKey] })
      })
      .catch((error) => {
        generateLockRef.current = null
        toast({
          title: "Nutrition update failed",
          description: error instanceof Error ? error.message : "Unable to update nutrition plan.",
          variant: "destructive",
        })
      })
  }, [queryClient, selectedDateKey, toast, trainingWeekQuery.data, trainingWeekQuery.isLoading, user?.id, weekEndKey, weekStartKey, weeklyNutritionQuery.data, weeklyNutritionQuery.isLoading])

  if (weeklyNutritionQuery.isError) {
    return <ErrorState onRetry={() => weeklyNutritionQuery.refetch()} />
  }

  const selectedDay = (weeklyNutritionQuery.data ?? []).find((day) => day.date === selectedDateKey) ?? {
    date: selectedDateKey,
    consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 },
    target: null,
    locked: false,
  }

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`

  const dayType = useMemo(() => {
    const aiDayType = dayPlanQuery.data?.day_type
    if (aiDayType === "high") return "High-load day"
    if (aiDayType === "training") return "Training day"
    if (aiDayType === "rest") return "Rest day"
    const sessions = trainingWeekQuery.data ?? []
    const hasTraining = sessions.some((session) => session.date === selectedDateKey)
    return hasTraining ? "Training day" : "Rest day"
  }, [dayPlanQuery.data?.day_type, selectedDateKey, trainingWeekQuery.data])

  const carbNote = dayType === "Training day" || dayType === "High-load day"
    ? "Carbs are higher today to fuel training sessions and recovery."
    : "Carbs ease off to match recovery needs on rest days."
  const dayRationale = dayPlanQuery.data?.rationale ?? null

  const dayOffset = differenceInCalendarDays(selectedDate, weekStart)
  const handlePrevWeek = () => setSelectedDate(addDays(addWeeks(weekStart, -1), dayOffset))
  const handleNextWeek = () => setSelectedDate(addDays(addWeeks(weekStart, 1), dayOffset))
  const handleThisWeek = () => {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    setSelectedDate(addDays(thisWeekStart, dayOffset))
  }

  const selectedWorkouts = (trainingWeekQuery.data ?? []).filter((session) => session.date === selectedDateKey)

  const buildFuelItems = () => {
    if (selectedWorkouts.length === 0) return []
    const baseSlot = (mealPlanQuery.data?.items ?? []).reduce((max, item) => Math.max(max, item.slot), 0)
    let slotCounter = baseSlot + 1
    const items: Array<{
      slot: number
      name: string
      time: string | null
      kcal: number
      protein_g: number
      carbs_g: number
      fat_g: number
    }> = []

    const addFuel = (name: string, time: string | null, carbs: number, protein: number, fat: number) => {
      const kcal = Math.round(carbs * 4 + protein * 4 + fat * 9)
      items.push({
        slot: slotCounter++,
        name,
        time,
        kcal,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      })
    }

    selectedWorkouts.forEach((session) => {
      const workoutLabel = session.title ?? "Workout"
      const preTime = session.time ?? null
      if (session.durationMinutes >= 60) {
        addFuel(`Fuel: Pre · ${workoutLabel}`, preTime, 30, 5, 2)
      }
      if (session.durationMinutes >= 75 && ["run", "bike", "swim"].includes(session.type)) {
        const intraCarbs = session.durationMinutes >= 90 ? 45 : 30
        addFuel(`Fuel: During · ${workoutLabel}`, session.time ?? null, intraCarbs, 0, 0)
      }
      if (session.intensity === "high" || (session.type === "strength" && session.durationMinutes >= 45)) {
        addFuel(`Fuel: Post · ${workoutLabel}`, session.time ?? null, 35, 25, 4)
      }
    })

    return items
  }

  useEffect(() => {
    if (!selectedDateKey || selectedWorkouts.length === 0) return
    if (mealPlanQuery.isLoading) return
    const existing = mealPlanQuery.data?.items ?? []
    const existingFuelNames = new Set(existing.filter((item) => item.name.startsWith("Fuel:")).map((item) => item.name))
    const desiredFuel = buildFuelItems().filter((item) => !existingFuelNames.has(item.name))
    if (desiredFuel.length === 0) return
    const ensureKey = `${selectedDateKey}:${desiredFuel.map((item) => item.name).join("|")}`
    if (fuelEnsureRef.current === ensureKey) return
    fuelEnsureRef.current = ensureKey
    updateNutritionDay
      .mutateAsync({ date: selectedDateKey, meals: desiredFuel })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day", user?.id, selectedDateKey] })
        queryClient.invalidateQueries({ queryKey: ["db", "nutrition-week", user?.id, weekStartKey, weekEndKey] })
      })
      .catch((error) => {
        console.error("Failed to add fueling items", error)
        fuelEnsureRef.current = null
      })
  }, [mealPlanQuery.data?.items, mealPlanQuery.isLoading, queryClient, selectedDateKey, selectedWorkouts, updateNutritionDay, user?.id, weekEndKey, weekStartKey])

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Nutrition</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev week
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-4 text-xs"
              onClick={handleThisWeek}
            >
              This week
            </Button>
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={handleNextWeek}>
              Next week <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <span className="text-sm text-muted-foreground">{weekLabel}</span>
          </div>
        </div>

        {profileQuery.data && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-2xl">🥗</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nutrition plan for</p>
              <p className="font-semibold text-foreground">
                {profileQuery.data.full_name || profileQuery.data.name || "Athlete"}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <DailyMacroCards
            consumed={selectedDay.consumed}
            target={selectedDay.target}
            isLoading={weeklyNutritionQuery.isLoading}
          />
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Meals</h2>
          <div className="flex flex-wrap items-center gap-2">
            <DayNavigator
              date={selectedDate}
              onPreviousDay={prevDay}
              onNextDay={nextDay}
              onSelectDate={setSelectedDate}
              onToday={() => setSelectedDate(new Date())}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meals"
              className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <WeeklyCaloriesChart
            days={weeklyNutritionQuery.data ?? []}
            selectedDate={selectedDateKey}
            isLoading={weeklyNutritionQuery.isLoading}
            onSelectDate={(dateKey) => setSelectedDate(parseISO(dateKey))}
          />
          <MealCards
            mealPlan={mealPlanQuery.data ?? null}
            target={selectedDay.target}
            selectedDate={selectedDateKey}
            search={search}
            isLoading={mealPlanQuery.isLoading || weeklyNutritionQuery.isLoading}
            isUpdating={updateMealMutation.isPending}
            dayTypeLabel={dayType}
            dayTypeNote={dayRationale ?? carbNote}
            onToggleMeal={(mealId, eaten) => updateMealMutation.mutate({ id: mealId, payload: { eaten } })}
          />
        </div>
      </div>
    </main>
  )
}
