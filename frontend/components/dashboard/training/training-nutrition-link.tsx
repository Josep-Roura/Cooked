"use client"

import { Link2 } from "lucide-react"
import type { NutritionPlanRow, TrainingSessionSummary } from "@/lib/db/types"

interface TrainingNutritionLinkProps {
  training: TrainingSessionSummary
  rows: NutritionPlanRow[]
}

export function TrainingNutritionLink({ training, rows }: TrainingNutritionLinkProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Training & Nutrition</h3>
      <div className="bg-muted rounded-xl p-4 mb-4">
        <p className="text-sm text-muted-foreground">Today's training</p>
        <p className="font-semibold text-foreground">
          {training.title} • {training.durationMinutes} min • {training.calories} kcal
        </p>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{row.date}</span>
            <span className="font-medium text-foreground">{row.kcal} kcal</span>
            <Link2 className="h-4 w-4 text-primary" />
          </div>
        ))}
      </div>
    </div>
  )
}
