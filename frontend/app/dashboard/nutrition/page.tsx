"use client"

import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { NutritionOverview } from "@/components/dashboard/nutrition/nutrition-overview"
import { MealCards } from "@/components/dashboard/nutrition/meal-cards"
import { MacroChart } from "@/components/dashboard/nutrition/macro-chart"
import { mockMeals, mockWeeklyNutrition, mockTrainingSessions } from "@/lib/mock-data"

export default function NutritionPage() {
  const todaysMeals = mockMeals
  const todaysTraining = mockTrainingSessions[0]

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl">
          <h1 className="text-2xl font-bold text-foreground mb-6">Nutrition</h1>

          {/* Training Link Banner */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-2xl">🏊</span>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Today's nutrition is adapted for</p>
              <p className="font-semibold text-foreground">
                {todaysTraining.title} - {todaysTraining.duration} min {todaysTraining.intensity} intensity
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">Estimated burn</p>
              <p className="font-semibold text-primary">{todaysTraining.calories} kcal</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <NutritionOverview weeklyData={mockWeeklyNutrition} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <MacroChart weeklyData={mockWeeklyNutrition} />
            <MealCards meals={todaysMeals} />
          </div>
        </div>
      </main>
    </div>
  )
}
