"use client"

import { Clock, Flame, Link2 } from "lucide-react"
import type { Meal } from "@/lib/mock-data"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface MealCardsProps {
  meals: Meal[]
}

const mealTypeIcons = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
}

const mealTypeColors = {
  breakfast: "bg-amber-100 border-amber-200",
  lunch: "bg-green-100 border-green-200",
  dinner: "bg-indigo-100 border-indigo-200",
  snack: "bg-pink-100 border-pink-200",
}

export function MealCards({ meals }: MealCardsProps) {
  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Today's Meals</h3>
        <div className="space-y-3">
          {meals.map((meal) => (
            <div
              key={meal.id}
              className={`p-4 rounded-xl border ${mealTypeColors[meal.type]} transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{mealTypeIcons[meal.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{meal.title}</h4>
                    {meal.linkedTraining && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Link2 className="h-4 w-4 text-primary" />
                        </TooltipTrigger>
                        <TooltipContent>Linked to training session</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {meal.time}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      {meal.calories} kcal
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-700 rounded-full">
                      P: {meal.protein}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-700 rounded-full">
                      C: {meal.carbs}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 rounded-full">
                      F: {meal.fat}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
