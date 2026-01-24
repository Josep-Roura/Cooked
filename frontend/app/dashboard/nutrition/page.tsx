"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { NutritionOverview } from "@/components/dashboard/nutrition/nutrition-overview"
import { MealCards } from "@/components/dashboard/nutrition/meal-cards"
import { MacroChart } from "@/components/dashboard/nutrition/macro-chart"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useToast } from "@/components/ui/use-toast"
import { useEnsureMealPlans, useMacrosDay, useMealPlanDay, useNutritionSummary, useProfile } from "@/lib/db/hooks"
import type { DateRangeOption } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"
import { ensureNutritionPlanRange, useEnsureNutritionPlan } from "@/lib/nutrition/ensure"

export default function NutritionPage() {
  const { user } = useSession()
  const { toast } = useToast()
  const profileQuery = useProfile(user?.id)
  const [range, setRange] = useState<DateRangeOption>("week")
  const [search, setSearch] = useState("")
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [isGenerating, setIsGenerating] = useState(false)
  const queryClient = useQueryClient()

  const nutritionQuery = useNutritionSummary(user?.id, range)
  const mealPlanQuery = useMealPlanDay(user?.id, selectedDate)
  const macrosQuery = useMacrosDay(user?.id, selectedDate)
  const ensureMealsMutation = useEnsureMealPlans()
  const ensuredDateRef = useRef<string | null>(null)

  useEnsureNutritionPlan({ userId: user?.id, range })

  useEffect(() => {
    if (!user?.id) return
    const ensureKey = `${user.id}:${selectedDate}`
    if (ensuredDateRef.current === ensureKey) return
    ensuredDateRef.current = ensureKey
    ensureMealsMutation.mutate({ start: selectedDate, end: selectedDate })
  }, [ensureMealsMutation, selectedDate, user?.id])

  if (nutritionQuery.isError) {
    return <ErrorState onRetry={() => nutritionQuery.refetch()} />
  }

  const filteredRows = useMemo(() => {
    const rows = nutritionQuery.data?.rows ?? []
    if (!search.trim()) {
      return rows
    }
    const query = search.trim().toLowerCase()
    return rows.filter((row) => row.day_type.toLowerCase().includes(query) || row.date.includes(query))
  }, [nutritionQuery.data?.rows, search])

  const summary = nutritionQuery.data?.summary
  const chartData = summary
    ? {
        targetCalories: summary.targetCalories,
        dailyData: summary.dailyData.map((day) => ({
          dayLabel: day.dayLabel,
          kcal: day.kcal,
        })),
      }
    : null

  const handleGenerate = async (regenerate: boolean) => {
    if (!selectedDate) return
    setIsGenerating(true)
    try {
      await ensureNutritionPlanRange({ start: selectedDate, end: selectedDate, force: regenerate })
      await ensureMealsMutation.mutateAsync({ start: selectedDate, end: selectedDate })

      await Promise.all([
        nutritionQuery.refetch(),
        mealPlanQuery.refetch(),
        macrosQuery.refetch(),
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
          <DateRangeSelector value={range} onChange={setRange} />
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

        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <NutritionOverview weeklyData={summary} />
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Meals</h2>
          <div className="flex items-center gap-2">
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
          {chartData && <MacroChart weeklyData={chartData} />}
          <MealCards
            rows={filteredRows}
            mealPlan={mealPlanQuery.data ?? null}
            macros={macrosQuery.data ?? null}
            selectedDate={selectedDate}
            search={search}
          />
        </div>
      </div>
    </main>
  )
}
