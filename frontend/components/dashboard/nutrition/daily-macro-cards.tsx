"use client"

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

  const hasTarget = Boolean(target)
  const metrics = [
    {
      label: "Calories",
      current: consumed.kcal,
      target: target?.kcal ?? 0,
      hasTarget,
      unit: "kcal",
      color: "bg-primary",
    },
    {
      label: "Protein",
      current: consumed.protein_g,
      target: target?.protein_g ?? 0,
      hasTarget,
      unit: "g",
      color: "bg-cyan-500",
    },
    {
      label: "Carbs",
      current: consumed.carbs_g,
      target: target?.carbs_g ?? 0,
      hasTarget,
      unit: "g",
      color: "bg-orange-500",
    },
  ]

  return (
    <>
      {metrics.map((metric) => {
        const percentage = metric.hasTarget && metric.target ? Math.round((metric.current / metric.target) * 100) : 0
        const diff = metric.hasTarget ? metric.current - metric.target : 0
        const remaining = Math.abs(diff)
        const statusLabel = metric.hasTarget
          ? diff > 0
            ? `${remaining} ${metric.unit} over`
            : `${remaining} ${metric.unit} left`
          : "No target"
        const badgeTone = !metric.hasTarget
          ? "bg-muted text-muted-foreground"
          : diff > 0
            ? "bg-rose-100 text-rose-700"
            : "bg-emerald-100 text-emerald-700"

        return (
          <div key={metric.label} className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{metric.label}</span>
              <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${badgeTone}`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-3xl font-bold text-foreground">{metric.current}</span>
              <span className="text-muted-foreground text-sm mb-1">
                / {metric.hasTarget ? metric.target : 0} {metric.unit}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${metric.color} rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metric.hasTarget ? `${percentage}% of daily target` : "Set a target to track progress"}
            </p>
          </div>
        )
      })}
    </>
  )
}
