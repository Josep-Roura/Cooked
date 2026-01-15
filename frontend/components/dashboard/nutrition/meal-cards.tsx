"use client"

import { Clock, Flame, Utensils } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import type { Meal, NutritionDayPlan, NutritionPlanRow } from "@/lib/db/types"

interface MealCardsProps {
  rows: NutritionPlanRow[]
  dayPlan?: NutritionDayPlan | null
  selectedDate: string
  search: string
}

const dayTypeIcons: Record<string, string> = {
  training: "🏊",
  rest: "🧘",
  recovery: "🧘",
  high: "⚡",
}

const dayTypeColors: Record<string, string> = {
  training: "bg-amber-100 border-amber-200",
  rest: "bg-indigo-100 border-indigo-200",
  recovery: "bg-indigo-100 border-indigo-200",
  high: "bg-red-100 border-red-200",
}

function filterMeals(meals: Meal[], search: string) {
  if (!search.trim()) {
    return meals
  }
  const query = search.trim().toLowerCase()
  return meals.filter((meal) => meal.name.toLowerCase().includes(query) || meal.time.includes(query))
}

export function MealCards({ rows, dayPlan, selectedDate, search }: MealCardsProps) {
  const meals = dayPlan?.meals ?? []
  const filteredMeals = filterMeals(meals, search)
  const hasMeals = meals.length > 0
  const selectedRow = rows.find((row) => row.date === selectedDate)
  const dayType = dayPlan?.day_type ?? selectedRow?.day_type ?? "training"
  const calories = dayPlan?.macros.kcal ?? selectedRow?.kcal ?? 0
  const protein = dayPlan?.macros.protein_g ?? selectedRow?.protein_g ?? 0
  const carbs = dayPlan?.macros.carbs_g ?? selectedRow?.carbs_g ?? 0
  const fat = dayPlan?.macros.fat_g ?? selectedRow?.fat_g ?? 0

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Today's Meals</h3>
      {(dayPlan || selectedRow) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="capitalize">{dayType} day</span>
          <span>{calories} kcal</span>
          <span>P: {protein}g</span>
          <span>C: {carbs}g</span>
          <span>F: {fat}g</span>
        </div>
      )}
      {hasMeals && filteredMeals.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No meals found"
          description="Try adjusting your search or generate a new plan."
        />
      ) : !hasMeals && rows.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No meals yet"
          description="Once your nutrition plan is loaded, meals will appear here."
        />
      ) : filteredMeals.length > 0 ? (
        <div className="space-y-3">
          {filteredMeals.map((meal) => (
            <div
              key={`${selectedDate}-${meal.slot}`}
              className={`p-4 rounded-xl border ${dayTypeColors[dayType] ?? "bg-green-100 border-green-200"} transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{dayTypeIcons[dayType] ?? "🥗"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{meal.name}</h4>
                    {meal.notes && <span className="text-xs text-muted-foreground">{meal.notes}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {meal.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      {meal.kcal} kcal
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-700 rounded-full">
                      P: {meal.protein_g}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-700 rounded-full">
                      C: {meal.carbs_g}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 rounded-full">
                      F: {meal.fat_g}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`p-4 rounded-xl border ${dayTypeColors[row.day_type] ?? "bg-green-100 border-green-200"} transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{dayTypeIcons[row.day_type] ?? "🥗"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{row.day_type} plan</h4>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {row.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      {row.kcal} kcal
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-700 rounded-full">
                      P: {row.protein_g}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-700 rounded-full">
                      C: {row.carbs_g}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 rounded-full">
                      F: {row.fat_g}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
