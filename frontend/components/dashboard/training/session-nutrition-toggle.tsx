"use client"

import { useState, useMemo } from "react"
import { ChevronDown, Flame, Droplet, Apple, Heart } from "lucide-react"
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

  // Calculate totals for each section
  const sectionTotals = useMemo(() => {
    return {
      pre: mealsByTiming.pre.reduce(
        (acc, meal) => ({
          kcal: acc.kcal + (meal.kcal || 0),
          protein_g: acc.protein_g + (meal.protein_g || 0),
          carbs_g: acc.carbs_g + (meal.carbs_g || 0),
          fat_g: acc.fat_g + (meal.fat_g || 0),
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      ),
      during: mealsByTiming.during.reduce(
        (acc, meal) => ({
          kcal: acc.kcal + (meal.kcal || 0),
          protein_g: acc.protein_g + (meal.protein_g || 0),
          carbs_g: acc.carbs_g + (meal.carbs_g || 0),
          fat_g: acc.fat_g + (meal.fat_g || 0),
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      ),
      post: mealsByTiming.post.reduce(
        (acc, meal) => ({
          kcal: acc.kcal + (meal.kcal || 0),
          protein_g: acc.protein_g + (meal.protein_g || 0),
          carbs_g: acc.carbs_g + (meal.carbs_g || 0),
          fat_g: acc.fat_g + (meal.fat_g || 0),
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      ),
    }
  }, [mealsByTiming])

  if (isLoading || fuelMeals.length === 0) {
    return null
  }

  return (
    <div className="pt-3 border-t border-border/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 px-0 py-2 text-sm font-medium text-foreground hover:bg-muted/50 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>⚡ Nutrition</span>
          <span className="text-xs text-muted-foreground">({fuelMeals.length} meals)</span>
        </div>
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
              totals={sectionTotals.pre}
            />
          )}

          {/* During Workout Card */}
          {mealsByTiming.during.length > 0 && (
            <NutritionCard
              icon={Droplet}
              title="During Workout"
              subtitle={`Every 30 min • ${mealsByTiming.during.length} items`}
              color="blue"
              meals={mealsByTiming.during}
              totals={sectionTotals.during}
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
              totals={sectionTotals.post}
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
  totals: {
    kcal: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
}

function NutritionCard({
  icon: Icon,
  title,
  subtitle,
  color,
  meals,
  totals,
}: NutritionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const colorConfig = {
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      iconBg: "bg-emerald-100",
      icon: "text-emerald-600",
      title: "text-emerald-900",
      subtitle: "text-emerald-700",
      hoverBg: "hover:bg-emerald-100",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      iconBg: "bg-blue-100",
      icon: "text-blue-600",
      title: "text-blue-900",
      subtitle: "text-blue-700",
      hoverBg: "hover:bg-blue-100",
    },
    pink: {
      bg: "bg-pink-50",
      border: "border-pink-200",
      iconBg: "bg-pink-100",
      icon: "text-pink-600",
      title: "text-pink-900",
      subtitle: "text-pink-700",
      hoverBg: "hover:bg-pink-100",
    },
  }

  const config = colorConfig[color]

  return (
    <div className={cn("rounded-lg border overflow-hidden", config.bg, config.border)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full p-2.5 flex items-center justify-between transition-colors",
          config.hoverBg
        )}
      >
        <div className="flex items-center gap-2.5 flex-1 text-left min-w-0">
          <div className={cn("w-7 h-7 rounded flex items-center justify-center flex-shrink-0", config.iconBg)}>
            <Icon className={cn("w-3.5 h-3.5", config.icon)} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={cn("font-semibold text-xs", config.title)}>{title}</h4>
            <p className={cn("text-xs", config.subtitle)}>{subtitle}</p>
          </div>
          {/* Macro pills on desktop */}
          <div className="hidden sm:flex gap-1 flex-shrink-0">
            {totals.carbs_g > 0 && (
              <MacroPill icon={Flame} value={`${totals.carbs_g}g`} color={color} />
            )}
            {totals.protein_g > 0 && (
              <MacroPill icon={Flame} value={`${totals.protein_g}g`} color={color} type="protein" />
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform flex-shrink-0",
            isExpanded && "rotate-180",
            config.icon
          )}
        />
      </button>

      {isExpanded && (
        <div className={cn("border-t p-2.5 space-y-2", config.border)}>
          {/* Macro summary */}
          <div className="grid grid-cols-2 gap-1.5">
            {totals.carbs_g > 0 && (
              <div className="bg-white rounded p-1.5 text-center text-xs">
                <div className="font-semibold text-slate-900">{totals.carbs_g}g</div>
                <div className="text-muted-foreground text-[0.65rem]">Carbs</div>
              </div>
            )}
            {totals.protein_g > 0 && (
              <div className="bg-white rounded p-1.5 text-center text-xs">
                <div className="font-semibold text-slate-900">{totals.protein_g}g</div>
                <div className="text-muted-foreground text-[0.65rem]">Protein</div>
              </div>
            )}
            {totals.fat_g > 0 && (
              <div className="bg-white rounded p-1.5 text-center text-xs">
                <div className="font-semibold text-slate-900">{totals.fat_g}g</div>
                <div className="text-muted-foreground text-[0.65rem]">Fat</div>
              </div>
            )}
            {totals.kcal > 0 && (
              <div className="bg-white rounded p-1.5 text-center text-xs">
                <div className="font-semibold text-slate-900">{totals.kcal}</div>
                <div className="text-muted-foreground text-[0.65rem]">kcal</div>
              </div>
            )}
          </div>

          {/* Meals list */}
          <div className="space-y-1">
            {meals.map((meal) => (
              <div key={meal.id} className="bg-white rounded p-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate text-[0.7rem]">
                      {meal.name}
                    </div>
                    {meal.time && (
                      <div className="text-muted-foreground text-[0.6rem]">@{meal.time}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 text-slate-600 font-semibold whitespace-nowrap text-[0.65rem]">
                    <Flame className="h-2.5 w-2.5" />
                    {meal.kcal}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface MacroPillProps {
  icon: React.ComponentType<{ className?: string }>
  value: string
  color: "emerald" | "blue" | "pink"
  type?: "carbs" | "protein"
}

function MacroPill({ icon: Icon, value, color, type = "carbs" }: MacroPillProps) {
  const colorMap = {
    emerald: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700",
    pink: "bg-pink-100 text-pink-700",
  }

  return (
    <div className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold", colorMap[color])}>
      <Icon className="h-2.5 w-2.5" />
      <span>{value}</span>
    </div>
  )
}
