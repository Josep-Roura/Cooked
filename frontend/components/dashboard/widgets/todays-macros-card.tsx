"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Utensils } from "lucide-react"
import type { NutritionMacros } from "@/lib/db/types"

interface TodaysMacrosCardProps {
  consumed?: NutritionMacros | null
  target?: NutritionMacros | null
  isLoading: boolean
  label?: string
}

export function TodaysMacrosCard({ consumed, target, isLoading, label = "Today's macros" }: TodaysMacrosCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-2 w-full" />
      </div>
    )
  }

  if (!consumed || !target) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <EmptyState
          icon={Utensils}
          title="No macros available"
          description="Set up a nutrition plan to see daily targets here."
        />
      </div>
    )
  }

  const caloriePercent = target.kcal > 0 ? Math.min((consumed.kcal / target.kcal) * 100, 100) : 0
  const macroItems = [
    { label: "Protein", consumed: consumed.protein_g, target: target.protein_g },
    { label: "Carbs", consumed: consumed.carbs_g, target: target.carbs_g },
    { label: "Fat", consumed: consumed.fat_g, target: target.fat_g },
  ]

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">Target {target.kcal} kcal</span>
      </div>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-3xl font-bold text-foreground">{consumed.kcal}</span>
        <span className="text-muted-foreground text-sm mb-1">/ {target.kcal} kcal</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground mb-4">
        {macroItems.map((macro) => (
          <div key={macro.label} className="bg-muted rounded-xl p-3 text-center">
            <p className="font-semibold text-foreground">
              {macro.consumed}g <span className="text-muted-foreground font-normal">/ {macro.target}g</span>
            </p>
            <p>{macro.label}</p>
          </div>
        ))}
      </div>
      <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${caloriePercent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {Math.round(caloriePercent)}% of target
      </p>
    </div>
  )
}
