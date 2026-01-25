"use client"

import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MealRow } from "@/components/dashboard/plans/meal-row"
import type { PlanWeekMeal } from "@/lib/db/types"

interface DayPlanCardProps {
  date: Date
  meals: PlanWeekMeal[]
  maxMeals?: number
  onSelectMeal: (meal: PlanWeekMeal) => void
  onSelectDay: (date: Date) => void
}

export function DayPlanCard({ date, meals, maxMeals = 4, onSelectMeal, onSelectDay }: DayPlanCardProps) {
  const visibleMeals = meals.slice(0, maxMeals)
  const extraCount = meals.length - visibleMeals.length

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{format(date, "EEE")}</span>
          <span className="text-xs text-muted-foreground">{format(date, "MMM d")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {meals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No meals planned for this day.</p>
        ) : (
          <div className="space-y-2">
            {visibleMeals.map((meal) => (
              <MealRow key={meal.id} meal={meal} onSelect={onSelectMeal} />
            ))}
            {extraCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary"
                onClick={() => onSelectDay(date)}
              >
                + {extraCount} more
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
