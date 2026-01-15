"use client"

import { Clock, Flame, Utensils } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"
import type { NutritionPlanRow } from "@/lib/db/types"

interface MealCardsProps {
  rows: NutritionPlanRow[]
}

const dayTypeIcons: Record<string, string> = {
  training: "🏊",
  rest: "🧘",
  recovery: "🧘",
}

const dayTypeColors: Record<string, string> = {
  training: "bg-amber-100 border-amber-200",
  rest: "bg-indigo-100 border-indigo-200",
  recovery: "bg-indigo-100 border-indigo-200",
}

export function MealCards({ rows }: MealCardsProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Today's Meals</h3>
      {rows.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="No meals yet"
          description="Once your nutrition plan is loaded, meals will appear here."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`p-4 rounded-xl border ${dayTypeColors[row.day_type] ?? "bg-green-100 border-green-200"} transition-all hover:shadow-sm`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{dayTypeIcons[row.day_type] ?? "🥗"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{row.day_type} plan</h4>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {row.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />
                      {row.kcal} kcal
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-700 rounded-full">
                      P: {row.protein_g}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-700 rounded-full">
                      C: {row.carbs_g}g
                    </span>
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-700 rounded-full">
                      F: {row.fat_g}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
