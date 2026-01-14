"use client"

import { ArrowRight } from "lucide-react"
import type { TrainingSession, Meal } from "@/lib/mock-data"

interface TrainingNutritionLinkProps {
  training: TrainingSession
  meals: Meal[]
}

export function TrainingNutritionLink({ training, meals }: TrainingNutritionLinkProps) {
  return (
    <div className="bg-primary rounded-2xl p-6 text-primary-foreground">
      <h3 className="text-lg font-semibold mb-4">Training & Nutrition Link</h3>

      <div className="flex items-center gap-4">
        {/* Training */}
        <div className="flex-1 bg-primary-foreground/10 rounded-xl p-4">
          <p className="text-sm opacity-80 mb-1">Training</p>
          <p className="font-semibold">{training.title}</p>
          <p className="text-sm opacity-80">
            {training.duration} min • {training.calories} kcal
          </p>
        </div>

        <ArrowRight className="h-6 w-6 flex-shrink-0" />

        {/* Nutrition */}
        <div className="flex-1 bg-primary-foreground/10 rounded-xl p-4">
          <p className="text-sm opacity-80 mb-1">Fueling</p>
          {meals.map((meal) => (
            <div key={meal.id} className="mb-1 last:mb-0">
              <p className="font-semibold text-sm">{meal.title}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 p-3 bg-primary-foreground/10 rounded-lg">
        <p className="text-sm">
          <span className="font-semibold">Pro tip:</span> Your post-workout nutrition is optimized for{" "}
          {training.intensity} intensity training with emphasis on carbohydrate replenishment.
        </p>
      </div>
    </div>
  )
}
