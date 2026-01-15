"use client"

import { TrendingDown, TrendingUp } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Utensils } from "lucide-react"
import type { MacroSummary } from "@/lib/db/types"

interface TodaysMacrosCardProps {
  data?: MacroSummary | null
  isLoading: boolean
}

export function TodaysMacrosCard({ data, isLoading }: TodaysMacrosCardProps) {
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

  if (!data) {
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

  const deltaPositive = data.calorieDelta >= 0
  const DeltaIcon = deltaPositive ? TrendingUp : TrendingDown

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">Today's macros</span>
        <div className="flex items-center gap-1 text-xs">
          <DeltaIcon className={`h-3 w-3 ${deltaPositive ? "text-green-500" : "text-red-500"}`} />
          <span className={deltaPositive ? "text-green-500" : "text-red-500"}>
            {deltaPositive ? "+" : ""}
            {data.calorieDelta} kcal {data.deltaLabel}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-3xl font-bold text-foreground">{data.calories}</span>
        <span className="text-muted-foreground text-sm mb-1">/ {data.targetCalories} kcal</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground mb-4">
        <div className="bg-muted rounded-xl p-3 text-center">
          <p className="font-semibold text-foreground">{data.protein}g</p>
          <p>Protein</p>
        </div>
        <div className="bg-muted rounded-xl p-3 text-center">
          <p className="font-semibold text-foreground">{data.carbs}g</p>
          <p>Carbs</p>
        </div>
        <div className="bg-muted rounded-xl p-3 text-center">
          <p className="font-semibold text-foreground">{data.fat}g</p>
          <p>Fat</p>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min((data.calories / data.targetCalories) * 100, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {Math.round((data.calories / data.targetCalories) * 100)}% of target
      </p>
    </div>
  )
}
