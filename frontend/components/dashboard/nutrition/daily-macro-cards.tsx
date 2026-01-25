"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { NutritionMacros } from "@/lib/db/types"

interface DailyMacroCardsProps {
  consumed: NutritionMacros
  target: NutritionMacros | null
  isLoading: boolean
}

export function DailyMacroCards({ consumed, target, isLoading }: DailyMacroCardsProps) {
  if (isLoading) {
    return (
      <>
        {[0, 1, 2].map((index) => (
          <div key={index} className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </>
    )
  }

  const metrics = [
    {
      label: "Calories",
      current: consumed.kcal,
      target: target?.kcal ?? 0,
      unit: "kcal",
      color: "bg-primary",
    },
    {
      label: "Protein",
      current: consumed.protein_g,
      target: target?.protein_g ?? 0,
      unit: "g",
      color: "bg-cyan-500",
    },
    {
      label: "Carbs",
      current: consumed.carbs_g,
      target: target?.carbs_g ?? 0,
      unit: "g",
      color: "bg-orange-500",
    },
  ]

  return (
    <>
      {metrics.map((metric) => {
        const percentage = metric.target ? Math.round((metric.current / metric.target) * 100) : 0
        const diff = metric.current - metric.target
        const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus

        return (
          <div key={metric.label} className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              {target ? (
                <div className="flex items-center gap-1 text-xs">
                  <TrendIcon className={`h-3 w-3 ${diff >= 0 ? "text-green-500" : "text-red-500"}`} />
                  <span className={diff >= 0 ? "text-green-500" : "text-red-500"}>
                    {diff >= 0 ? "+" : ""}
                    {diff} {metric.unit}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No target</span>
              )}
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
            <p className="text-xs text-muted-foreground mt-2">
              {target ? `${percentage}% of daily target` : "Set a target to track progress"}
            </p>
          </div>
        )
      })}
    </>
  )
}
