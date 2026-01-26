"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addWeeks, format, isWithinInterval, parseISO, startOfWeek } from "date-fns"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { MealCards } from "@/components/dashboard/nutrition/meal-cards"
import { WeeklyCaloriesChart } from "@/components/dashboard/nutrition/weekly-calories-chart"
import { DailyMacroCards } from "@/components/dashboard/nutrition/daily-macro-cards"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import {
  useMealPlanDay,
  useProfile,
  useTrainingSessions,
  useUpdateMealPlanItem,
  useWeekRange,
  useWeeklyNutrition,
} from "@/lib/db/hooks"
import { useSession } from "@/hooks/use-session"
import { generatePlanWithOpenAI } from "@/lib/ai/generatePlanWithOpenAI"
import { ensureMealPlanDay } from "@/lib/nutrition/ensure"

export default function NutritionPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const profileQuery = useProfile(user?.id)
  const [search, setSearch] = useState("")
  const [now] = useState(() => new Date())
  const [anchorDate, setAnchorDate] = useState(() => startOfWeek(now, { weekStartsOn: 1 }))
  const [selectedDate, setSelectedDate] = useState(() => format(now, "yyyy-MM-dd"))
  const [isGenerating, setIsGenerating] = useState(false)
  const queryClient = useQueryClient()

  const { start: weekStart, end: weekEnd, startKey: weekStartKey, endKey: weekEndKey } = useWeekRange(anchorDate)
  const weeklyNutritionQuery = useWeeklyNutrition(user?.id, weekStartKey, weekEndKey)
  const mealPlanQuery = useMealPlanDay(user?.id, selectedDate)
  const trainingWeekQuery = useTrainingSessions(user?.id, weekStartKey, weekEndKey)
  const updateMealMutation = useUpdateMealPlanItem()
  const lastSyncedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedDate) return
    const selectedDateObj = parseISO(selectedDate)
    if (!isWithinInterval(selectedDateObj, { start: weekStart, end: weekEnd })) {
      setSelectedDate(format(weekStart, "yyyy-MM-dd"))
    }
  }, [selectedDate, weekStart, weekEnd])

  useEffect(() => {
    const urlDate = searchParams.get("date")
    const urlWeek = searchParams.get("weekStart")
    if (urlDate) {
      setSelectedDate(urlDate)
    }
    if (urlWeek) {
      const parsed = parseISO(urlWeek)
      if (!Number.isNaN(parsed.getTime())) {
        setAnchorDate(startOfWeek(parsed, { weekStartsOn: 1 }))
      }
    }
  }, [searchParams])

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", selectedDate)
    params.set("weekStart", format(weekStart, "yyyy-MM-dd"))
    const nextQuery = params.toString()
    if (lastSyncedRef.current === nextQuery) return
    lastSyncedRef.current = nextQuery
    if (nextQuery !== searchParams.toString()) {
      router.replace(`/dashboard/nutrition?${nextQuery}`)
    }
  }, [router, searchParams, selectedDate, weekStart])

  if (weeklyNutritionQuery.isError) {
    return <ErrorState onRetry={() => weeklyNutritionQuery.refetch()} />
  }

  const selectedDay = (weeklyNutritionQuery.data ?? []).find((day) => day.date === selectedDate) ?? {
    date: selectedDate,
    consumed: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, intra_cho_g_per_h: 0 },
    target: null,
  }

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`

  const dayType = useMemo(() => {
    const sessions = trainingWeekQuery.data ?? []
    const hasTraining = sessions.some((session) => session.date === selectedDate)
    return hasTraining ? "Training day" : "Rest day"
  }, [selectedDate, trainingWeekQuery.data])

  const carbNote = dayType === "Training day"
    ? "Carbs are higher today to fuel training sessions and recovery."
    : "Carbs ease off to match recovery needs on rest days."

  const handleGenerate = async (regenerate: boolean) => {
    if (!selectedDate) return
    setIsGenerating(true)
    try {
      if (regenerate) {
        await generatePlanWithOpenAI({ date: selectedDate, force: true })
      } else {
        await ensureMealPlanDay(selectedDate)
      }
      await Promise.all([
        weeklyNutritionQuery.refetch(),
        mealPlanQuery.refetch(),
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["db", "calendar-events"] }),
      ])
    } catch (error) {
      console.error("Failed to generate nutrition plan", error)
      toast({
        title: "Nutrition update failed",
        description: error instanceof Error ? error.message : "Unable to update nutrition plan.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="flex-1 p-8 overflow-auto">
      <div className="max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Nutrition</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={() => setAnchorDate(addWeeks(anchorDate, -1))}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev week
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-4 text-xs"
              onClick={() => setAnchorDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            >
              This week
            </Button>
            <Button variant="outline" className="rounded-full px-4 text-xs" onClick={() => setAnchorDate(addWeeks(anchorDate, 1))}>
              Next week <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <span className="text-sm text-muted-foreground">{weekLabel}</span>
          </div>
        </div>

        {/* Training Link Banner */}
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
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">Units</p>
              <p className="font-semibold text-primary">{profileQuery.data.units ?? "metric"}</p>
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
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search meals"
              className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
            />
            <Button
              onClick={() => handleGenerate(false)}
              disabled={isGenerating}
              className="h-9 rounded-full px-4 text-xs"
              type="button"
            >
              Generate today&apos;s plan
            </Button>
            <Button
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              variant="outline"
              className="h-9 rounded-full px-4 text-xs"
              type="button"
            >
              Regenerate
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <WeeklyCaloriesChart
            days={weeklyNutritionQuery.data ?? []}
            selectedDate={selectedDate}
            isLoading={weeklyNutritionQuery.isLoading}
            onSelectDate={setSelectedDate}
          />
          <MealCards
            mealPlan={mealPlanQuery.data ?? null}
            target={selectedDay.target}
            selectedDate={selectedDate}
            search={search}
            isLoading={mealPlanQuery.isLoading || weeklyNutritionQuery.isLoading}
            isUpdating={updateMealMutation.isPending}
            dayTypeLabel={dayType}
            dayTypeNote={carbNote}
            onToggleMeal={(mealId, eaten) => updateMealMutation.mutate({ id: mealId, payload: { eaten } })}
          />
        </div>
      </div>
    </main>
  )
}
