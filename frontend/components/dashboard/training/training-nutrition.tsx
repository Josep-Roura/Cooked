"use client"

import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { Flame, Clock, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import type { MealPlanDay, MealPlanItem, NutritionMacros } from "@/lib/db/types"

interface TrainingNutritionProps {
  mealPlan?: MealPlanDay | null
  target?: NutritionMacros | null
  selectedDate: string
  isLoading: boolean
  sessions?: Array<{ type: string; durationMinutes: number }>
}

function getMealEmoji(meal: MealPlanItem) {
  if (meal.emoji) return meal.emoji
  const label = meal.name.toLowerCase()
  if (label.includes("fuel")) return "⚡"
  if (label.includes("shake") || label.includes("protein")) return "🥤"
  if (label.includes("breakfast")) return "🍳"
  if (label.includes("snack")) return "🍌"
  if (label.includes("lunch")) return "🥗"
  if (label.includes("dinner")) return "🍝"
  return "🍽️"
}

function getWorkoutContext(meal: MealPlanItem) {
  // Extract workout info from meal name like "Fuel: Pre · 6km Run"
  if (meal.name.startsWith("Fuel:")) {
    const parts = meal.name.split("·")
    if (parts.length > 1) {
      return parts[1].trim()
    }
  }
  return null
}

export function TrainingNutrition({
  mealPlan,
  target,
  selectedDate,
  isLoading,
  sessions = [],
}: TrainingNutritionProps) {
  const meals = mealPlan?.items ?? []
  
  const mealsByTiming = useMemo(() => {
    const fuelMeals = meals.filter((meal) => meal.name.startsWith("Fuel:"))
    const regularMeals = meals.filter((meal) => !meal.name.startsWith("Fuel:"))

    return {
      preFuel: fuelMeals.filter((m) => m.name.includes("Pre")),
      duringFuel: fuelMeals.filter((m) => m.name.includes("During")),
      postFuel: fuelMeals.filter((m) => m.name.includes("Post")),
      regular: regularMeals,
    }
  }, [meals])

  const totalMacros = useMemo(() => {
    return meals.reduce(
      (acc, meal) => ({
        kcal: acc.kcal + (meal.kcal || 0),
        protein_g: acc.protein_g + (meal.protein_g || 0),
        carbs_g: acc.carbs_g + (meal.carbs_g || 0),
        fat_g: acc.fat_g + (meal.fat_g || 0),
      }),
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )
  }, [meals])

  const formatDate = selectedDate ? format(parseISO(selectedDate), "EEE, MMM d") : ""
  const dayHasTraining = sessions.length > 0

  const macroTarget = target
    ? {
        kcal: target.kcal || 0,
        protein: target.protein_g || 0,
        carbs: target.carbs_g || 0,
        fat: target.fat_g || 0,
      }
    : null

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Nutrition</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    )
  }

  if (!meals || meals.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Nutrition</h2>
        <EmptyState
          icon="🍽️"
          title="No meals planned"
          description={dayHasTraining ? "Add meals to fuel your training" : "No meals for this day yet"}
        />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground mb-2">Nutrition Plan</h2>
        <p className="text-xs text-muted-foreground">{formatDate}</p>
      </div>

      {/* Macro Summary */}
      {macroTarget && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Calories</div>
            <div className="text-sm font-semibold text-foreground">
              {totalMacros.kcal} / {macroTarget.kcal}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {macroTarget.kcal > 0
                ? Math.round((totalMacros.kcal / macroTarget.kcal) * 100)
                : 0}
              %
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Protein</div>
            <div className="text-sm font-semibold text-foreground">
              {totalMacros.protein_g}g
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              /{macroTarget.protein}g
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Carbs</div>
            <div className="text-sm font-semibold text-foreground">
              {totalMacros.carbs_g}g
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              /{macroTarget.carbs}g
            </div>
          </div>

          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">Fat</div>
            <div className="text-sm font-semibold text-foreground">
              {totalMacros.fat_g}g
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              /{macroTarget.fat}g
            </div>
          </div>
        </div>
      )}

      {/* Fuel Meals (Pre/During/Post) */}
      {(mealsByTiming.preFuel.length > 0 ||
        mealsByTiming.duringFuel.length > 0 ||
        mealsByTiming.postFuel.length > 0) && (
        <div className="mb-6 pb-6 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚡</span>
            <h3 className="font-semibold text-foreground">Workout Fueling</h3>
          </div>

          <div className="space-y-3">
            {mealsByTiming.preFuel.length > 0 && (
              <div>
                <Badge variant="secondary" className="mb-2">
                  Before Training
                </Badge>
                <div className="space-y-2">
                  {mealsByTiming.preFuel.map((meal) => (
                    <MealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              </div>
            )}

            {mealsByTiming.duringFuel.length > 0 && (
              <div>
                <Badge variant="secondary" className="mb-2">
                  During Training
                </Badge>
                <div className="space-y-2">
                  {mealsByTiming.duringFuel.map((meal) => (
                    <MealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              </div>
            )}

            {mealsByTiming.postFuel.length > 0 && (
              <div>
                <Badge variant="secondary" className="mb-2">
                  After Training
                </Badge>
                <div className="space-y-2">
                  {mealsByTiming.postFuel.map((meal) => (
                    <MealCard key={meal.id} meal={meal} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regular Meals */}
      {mealsByTiming.regular.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🍽️</span>
            <h3 className="font-semibold text-foreground">Meals</h3>
          </div>
          <div className="space-y-2">
            {mealsByTiming.regular.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MealCard({ meal }: { meal: MealPlanItem }) {
  const workoutContext = getWorkoutContext(meal)

  return (
    <div className="bg-muted rounded-lg p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getMealEmoji(meal)}</span>
            <div>
              <h4 className="font-medium text-foreground">{meal.name}</h4>
              {workoutContext && (
                <p className="text-xs text-muted-foreground">For: {workoutContext}</p>
              )}
              {meal.time && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  {meal.time}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1 font-semibold text-foreground">
            <Flame className="h-4 w-4" />
            {meal.kcal || 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            P: {meal.protein_g || 0}g | C: {meal.carbs_g || 0}g | F: {meal.fat_g || 0}g
          </div>
        </div>
      </div>
    </div>
  )
}
