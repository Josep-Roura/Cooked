"use client"

import { Clock, Flame, Utensils } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Checkbox } from "@/components/ui/checkbox"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import type { MealPlanDay, MealPlanItem, NutritionMacros } from "@/lib/db/types"

interface MealCardsProps {
  mealPlan?: MealPlanDay | null
  target?: NutritionMacros | null
  selectedDate: string
  search: string
  isLoading: boolean
  isUpdating: boolean
  dayTypeLabel?: string
  dayTypeNote?: string
  onToggleMeal: (mealId: string, eaten: boolean) => void
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

function filterMeals(meals: MealPlanItem[], search: string) {
  if (!search.trim()) {
    return meals
  }
  const query = search.trim().toLowerCase()
  return meals.filter((meal) => meal.name.toLowerCase().includes(query) || (meal.time ?? "").includes(query))
}

export function MealCards({
  mealPlan,
  target,
  selectedDate,
  search,
  isLoading,
  isUpdating,
  dayTypeLabel,
  dayTypeNote,
  onToggleMeal,
}: MealCardsProps) {
  const meals = mealPlan?.items ?? []
  const filteredMeals = filterMeals(meals, search)
  const hasMeals = meals.length > 0
  const dayType = dayTypeLabel ?? "Training day"
  const dayTypeKey =
    dayTypeLabel && dayTypeLabel.toLowerCase().includes("rest") ? "rest" : "training"
  const calories = target?.kcal ?? 0
  const protein = target?.protein_g ?? 0
  const carbs = target?.carbs_g ?? 0
  const fat = target?.fat_g ?? 0
  const formattedDate = selectedDate ? format(parseISO(selectedDate), "EEE, MMM d") : ""

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {formattedDate ? `Meals for ${formattedDate}` : "Meals"}
      </h3>
      {(mealPlan || target) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="capitalize">{dayType}</span>
          <span>{calories} kcal</span>
          <span>P: {protein}g</span>
          <span>C: {carbs}g</span>
          <span>F: {fat}g</span>
        </div>
      )}
      {dayTypeNote && <p className="text-xs text-muted-foreground mb-4">{dayTypeNote}</p>}
      {hasMeals && filteredMeals.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No meals found"
          description="Try adjusting your search or generate a new plan."
        />
      ) : !hasMeals ? (
        <EmptyState
          icon={Utensils}
          title="No meals yet"
          description="Once your nutrition plan is loaded, meals will appear here."
        />
      ) : filteredMeals.length > 0 ? (
        <div className="space-y-3">
          {filteredMeals.map((meal) => (
            <div
              key={meal.id}
              className={`p-4 rounded-xl border ${
                meal.eaten
                  ? "bg-emerald-50 border-emerald-200"
                  : dayTypeColors[dayTypeKey] ?? "bg-green-100 border-green-200"
              } transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{meal.emoji ?? dayTypeIcons[dayTypeKey] ?? "🥗"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{meal.name}</h4>
                    {meal.eaten && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Eaten
                      </span>
                    )}
                    {meal.notes && <span className="text-xs text-muted-foreground">{meal.notes}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {meal.time ?? "Any time"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      {meal.kcal} kcal
                    </span>
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={meal.eaten}
                        onCheckedChange={(checked) => onToggleMeal(meal.id, Boolean(checked))}
                        disabled={isUpdating}
                      />
                      <span className="text-xs text-muted-foreground">I ate this</span>
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
      ) : null}
    </div>
  )
}
