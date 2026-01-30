"use client"

import { Badge } from "@/components/ui/badge"
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
        const remaining = Math.abs(diff)
        const statusLabel = diff > 0 ? `Over ${remaining}${metric.unit}` : `Remaining ${remaining}${metric.unit}`

        return (
          <div key={metric.label} className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              {target ? (
                <Badge variant={diff > 0 ? "destructive" : "secondary"}>{statusLabel}</Badge>
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
            <div className="relative h-2 rounded-full bg-primary/15 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 ${metric.color} rounded-full transition-all duration-500`}
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
