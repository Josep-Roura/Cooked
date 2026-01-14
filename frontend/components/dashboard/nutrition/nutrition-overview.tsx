"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface NutritionOverviewProps {
  weeklyData: {
    targetCalories: number
    targetProtein: number
    targetCarbs: number
    targetFat: number
    dailyData: Array<{
      day: string
      calories: number
      protein: number
      carbs: number
      fat: number
    }>
  }
}

export function NutritionOverview({ weeklyData }: NutritionOverviewProps) {
  const todayData = weeklyData.dailyData[0]

  const metrics = [
    {
      label: "Calories",
      current: todayData.calories,
      target: weeklyData.targetCalories,
      unit: "kcal",
      color: "bg-primary",
    },
    {
      label: "Protein",
      current: todayData.protein,
      target: weeklyData.targetProtein,
      unit: "g",
      color: "bg-cyan-500",
    },
    {
      label: "Carbs",
      current: todayData.carbs,
      target: weeklyData.targetCarbs,
      unit: "g",
      color: "bg-orange-500",
    },
  ]

  return (
    <>
      {metrics.map((metric) => {
        const percentage = Math.round((metric.current / metric.target) * 100)
        const diff = metric.current - metric.target
        const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus

        return (
          <div key={metric.label} className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              <div className="flex items-center gap-1 text-xs">
                <TrendIcon className={`h-3 w-3 ${diff >= 0 ? "text-green-500" : "text-red-500"}`} />
                <span className={diff >= 0 ? "text-green-500" : "text-red-500"}>
                  {diff >= 0 ? "+" : ""}
                  {diff} {metric.unit}
                </span>
              </div>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl font-bold text-foreground">{metric.current}</span>
              <span className="text-muted-foreground text-sm mb-1">
                / {metric.target} {metric.unit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${metric.color} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{percentage}% of daily target</p>
          </div>
        )
      })}
    </>
  )
}
