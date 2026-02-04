"use client"

import { useState, useMemo } from "react"
import { ChevronDown, Apple, Droplet, Heart } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MealPlanItem, NutritionMacros } from "@/lib/db/types"

interface SessionNutritionToggleProps {
  sessionId: string
  date: string
  meals?: MealPlanItem[]
  target?: NutritionMacros | null
  isLoading?: boolean
}

export function SessionNutritionToggle({
  sessionId,
  date,
  meals = [],
  target,
  isLoading = false,
}: SessionNutritionToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Filter only pre/during/post fuel meals
  const fuelMeals = useMemo(() => {
    return meals.filter((meal) => {
      const name = meal.name.toLowerCase()
      return (
        name.includes("fuel:") &&
        (name.includes("pre") || name.includes("during") || name.includes("post"))
      )
    })
  }, [meals])

  // Separate into sections
  const mealsByTiming = useMemo(() => {
    return {
      pre: fuelMeals.filter((m) => m.name.toLowerCase().includes("fuel: pre")),
      during: fuelMeals.filter((m) => m.name.toLowerCase().includes("fuel: during")),
      post: fuelMeals.filter((m) => m.name.toLowerCase().includes("fuel: post")),
    }
  }, [fuelMeals])

  if (isLoading || fuelMeals.length === 0) {
    return null
  }

  return (
    <div className="pt-3 border-t border-border/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 px-0 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded transition-colors"
      >
        <span>⚡ Nutrition</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 pt-3 border-t border-border/50">
          {/* Pre-Workout Card */}
          {mealsByTiming.pre.length > 0 && (
            <NutritionCard
              icon={Apple}
              title="Pre-Workout"
              color="emerald"
              meals={mealsByTiming.pre}
            />
          )}

          {/* During Workout Card */}
          {mealsByTiming.during.length > 0 && (
            <NutritionCard
              icon={Droplet}
              title="During Workout"
              color="blue"
              meals={mealsByTiming.during}
            />
          )}

          {/* Post-Workout Card */}
          {mealsByTiming.post.length > 0 && (
            <NutritionCard
              icon={Heart}
              title="Post-Workout"
              color="pink"
              meals={mealsByTiming.post}
            />
          )}
        </div>
      )}
    </div>
  )
}

interface NutritionCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  color: "emerald" | "blue" | "pink"
  meals: MealPlanItem[]
}

function NutritionCard({
  icon: Icon,
  title,
  color,
  meals,
}: NutritionCardProps) {
  const colorConfig = {
    emerald: {
      header: "bg-emerald-100",
      headerText: "text-emerald-800",
      body: "bg-emerald-50",
      icon: "text-emerald-600",
    },
    blue: {
      header: "bg-blue-100",
      headerText: "text-blue-800",
      body: "bg-blue-50",
      icon: "text-blue-600",
    },
    pink: {
      header: "bg-pink-100",
      headerText: "text-pink-800",
      body: "bg-pink-50",
      icon: "text-pink-600",
    },
  }

  const config = colorConfig[color]

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Header */}
      <div className={cn("p-2.5 flex items-center gap-2", config.header)}>
        <div className={cn("w-5 h-5 flex items-center justify-center flex-shrink-0", config.icon)}>
          <Icon className="w-4 h-4" />
        </div>
        <h4 className={cn("font-semibold text-sm", config.headerText)}>{title}</h4>
      </div>

      {/* Body - Meals list */}
      <div className={cn("p-3 space-y-2", config.body)}>
        {meals.map((meal) => (
          <div key={meal.id} className="text-sm font-medium text-slate-800">
            {meal.name.replace(/Fuel:\s*(Pre|During|Post)\s*·\s*/i, '')}
          </div>
        ))}
      </div>
    </div>
  )
}
