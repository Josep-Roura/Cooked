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
              subtitle="30-60 min before"
              color="emerald"
              meals={mealsByTiming.pre}
            />
          )}

          {/* During Workout Card */}
          {mealsByTiming.during.length > 0 && (
            <NutritionCard
              icon={Droplet}
              title="During Workout"
              subtitle="Every 30 min"
              color="blue"
              meals={mealsByTiming.during}
            />
          )}

          {/* Post-Workout Card */}
          {mealsByTiming.post.length > 0 && (
            <NutritionCard
              icon={Heart}
              title="Post-Workout"
              subtitle="30-60 min after"
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
  subtitle: string
  color: "emerald" | "blue" | "pink"
  meals: MealPlanItem[]
}

function NutritionCard({
  icon: Icon,
  title,
  subtitle,
  color,
  meals,
}: NutritionCardProps) {
  const colorConfig = {
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      iconBg: "bg-emerald-100",
      icon: "text-emerald-600",
      title: "text-emerald-900",
      subtitle: "text-emerald-700",
      hoverBg: "hover:bg-emerald-100",
      mealBg: "bg-white border border-emerald-100",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      iconBg: "bg-blue-100",
      icon: "text-blue-600",
      title: "text-blue-900",
      subtitle: "text-blue-700",
      hoverBg: "hover:bg-blue-100",
      mealBg: "bg-white border border-blue-100",
    },
    pink: {
      bg: "bg-pink-50",
      border: "border-pink-200",
      iconBg: "bg-pink-100",
      icon: "text-pink-600",
      title: "text-pink-900",
      subtitle: "text-pink-700",
      hoverBg: "hover:bg-pink-100",
      mealBg: "bg-white border border-pink-100",
    },
  }

  const config = colorConfig[color]

  return (
    <div className={cn("rounded-lg border overflow-hidden", config.bg, config.border)}>
      <div className={cn("w-full p-2.5 flex items-center gap-2.5", config.hoverBg)}>
        <div className={cn("w-7 h-7 rounded flex items-center justify-center flex-shrink-0", config.iconBg)}>
          <Icon className={cn("w-3.5 h-3.5", config.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn("font-semibold text-xs", config.title)}>{title}</h4>
          <p className={cn("text-xs", config.subtitle)}>{subtitle}</p>
        </div>
      </div>

      {/* Meals list */}
      <div className={cn("border-t p-2.5 space-y-1.5", config.border)}>
        {meals.map((meal) => (
          <div key={meal.id} className={cn("rounded p-2 text-xs", config.mealBg)}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900">
                  {meal.name.replace(/Fuel:\s*(Pre|During|Post)\s*·\s*/i, '')}
                </div>
                {meal.time && (
                  <div className="text-muted-foreground text-[0.65rem]">@{meal.time}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
