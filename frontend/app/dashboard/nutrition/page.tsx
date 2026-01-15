"use client"

import { useMemo, useState } from "react"
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { NutritionOverview } from "@/components/dashboard/nutrition/nutrition-overview"
import { MealCards } from "@/components/dashboard/nutrition/meal-cards"
import { MacroChart } from "@/components/dashboard/nutrition/macro-chart"
import { DateRangeSelector } from "@/components/dashboard/widgets/date-range-selector"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { useNutritionRange, useNutritionSummary, useProfile } from "@/lib/db/hooks"
import type { DateRangeOption, NutritionDayPlan } from "@/lib/db/types"
import { useSession } from "@/hooks/use-session"

export default function NutritionPage() {
  const { user } = useSession()
  const profileQuery = useProfile(user?.id)
  const [range, setRange] = useState<DateRangeOption>("week")
  const [search, setSearch] = useState("")
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [isGenerating, setIsGenerating] = useState(false)
  const [rangeStart, setRangeStart] = useState(() => format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"))
  const [rangeEnd, setRangeEnd] = useState(() => format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"))
  const queryClient = useQueryClient()

  const nutritionQuery = useNutritionSummary(user?.id, range)
  const nutritionRangeQuery = useNutritionRange(user?.id, rangeStart, rangeEnd)

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

  const handleGenerateRange = async (start: string, end: string, regenerate: boolean) => {
    if (!start || !end) return
    setIsGenerating(true)
    try {
      const response = await fetch("/api/v1/nutrition/generate-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start, end, regenerate }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to generate nutrition plan range")
      }

      await Promise.all([
        nutritionQuery.refetch(),
        nutritionRangeQuery.refetch(),
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["db", "calendar-events"] }),
      ])
    } catch (error) {
      console.error("Failed to generate nutrition plan", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const selectedDayPlan: NutritionDayPlan | null = (() => {
    const mealsEntry = nutritionRangeQuery.data?.meals_by_date?.[selectedDate]
    const row = nutritionRangeQuery.data?.rows?.find((item) => item.date === selectedDate)
    if (!mealsEntry && !row) return null
    const dayType = mealsEntry?.day_type === "high" || mealsEntry?.day_type === "rest" ? mealsEntry.day_type : row?.day_type ?? "training"
    const macros = mealsEntry?.macros
      ?? (row
        ? {
            kcal: row.kcal,
            protein_g: row.protein_g,
            carbs_g: row.carbs_g,
            fat_g: row.fat_g,
            intra_cho_g_per_h: row.intra_cho_g_per_h,
          }
        : null)
    if (!macros) return null

    return {
      plan_id: row?.plan_id ?? null,
      date: selectedDate,
      day_type: dayType,
      macros,
      meals_per_day: mealsEntry?.meals_per_day ?? profileQuery.data?.meals_per_day ?? 4,
      meals: mealsEntry?.meals ?? [],
    }
  })()

  const rangeDays = useMemo(() => {
    const rows = nutritionRangeQuery.data?.rows ?? []
    const mealsByDate = nutritionRangeQuery.data?.meals_by_date ?? {}
    return rows.map((row) => ({
      date: row.date,
      day_type: row.day_type,
      macros: {
        kcal: row.kcal,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fat_g: row.fat_g,
      },
      meals: mealsByDate[row.date]?.meals ?? [],
    }))
  }, [nutritionRangeQuery.data?.meals_by_date, nutritionRangeQuery.data?.rows])

  const handleGenerateWeek = (regenerate: boolean) => {
    const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
    const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
    setRangeStart(start)
    setRangeEnd(end)
    void handleGenerateRange(start, end, regenerate)
  }

  const handleGenerateMonth = (regenerate: boolean) => {
    const start = format(startOfMonth(new Date()), "yyyy-MM-dd")
    const end = format(endOfMonth(new Date()), "yyyy-MM-dd")
    setRangeStart(start)
    setRangeEnd(end)
    void handleGenerateRange(start, end, regenerate)
  }

  const handleGenerateCustom = (regenerate: boolean) => {
    void handleGenerateRange(rangeStart, rangeEnd, regenerate)
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
              onClick={() => handleGenerateWeek(false)}
              disabled={isGenerating}
              className="h-9 rounded-full px-4 text-xs"
              type="button"
            >
              Generate this week
            </Button>
            <Button
              onClick={() => handleGenerateMonth(false)}
              disabled={isGenerating}
              variant="outline"
              className="h-9 rounded-full px-4 text-xs"
              type="button"
            >
              Generate this month
            </Button>
            <Button
              onClick={() => handleGenerateCustom(false)}
              disabled={isGenerating}
              variant="outline"
              className="h-9 rounded-full px-4 text-xs"
              type="button"
            >
              Generate custom range
            </Button>
            <Button
              onClick={() => handleGenerateCustom(true)}
              disabled={isGenerating}
              variant="outline"
              className="h-9 rounded-full px-4 text-xs"
              type="button"
            >
              Regenerate range
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {chartData && <MacroChart weeklyData={chartData} />}
          <MealCards
            rows={filteredRows}
            dayPlan={selectedDayPlan}
            selectedDate={selectedDate}
            search={search}
          />
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold text-foreground">Weekly plan</h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={rangeStart}
                onChange={(event) => setRangeStart(event.target.value)}
                className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
              />
              <input
                type="date"
                value={rangeEnd}
                onChange={(event) => setRangeEnd(event.target.value)}
                className="h-9 rounded-full border border-border bg-transparent px-4 text-xs text-muted-foreground"
              />
            </div>
          </div>
          <div className="space-y-3">
            {rangeDays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nutrition days found for this range.</p>
            ) : (
              rangeDays.map((day) => (
                <div key={day.date} className="flex flex-col gap-2 border border-border rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{day.date}</span>
                    <span className="capitalize">{day.day_type}</span>
                    <span>{day.macros.kcal} kcal</span>
                    <span>P: {day.macros.protein_g}g</span>
                    <span>C: {day.macros.carbs_g}g</span>
                    <span>F: {day.macros.fat_g}g</span>
                  </div>
                  {day.meals.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {day.meals.map((meal) => (
                        <span key={`${day.date}-${meal.slot}`} className="rounded-full border border-border px-2 py-1">
                          {meal.time} {meal.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
