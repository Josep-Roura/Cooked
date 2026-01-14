"use client"

import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { TodayTraining } from "@/components/dashboard/training/today-training"
import { WeeklyHistory } from "@/components/dashboard/training/weekly-history"
import { TrainingNutritionLink } from "@/components/dashboard/training/training-nutrition-link"
import { mockTrainingSessions, mockWeeklyTraining, mockMeals } from "@/lib/mock-data"

export default function TrainingPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl">
          <h1 className="text-2xl font-bold text-foreground mb-6">Training</h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <TodayTraining session={mockTrainingSessions[0]} />
            <TrainingNutritionLink training={mockTrainingSessions[0]} meals={mockMeals.slice(0, 2)} />
          </div>

          <WeeklyHistory weeklyData={mockWeeklyTraining} />
        </div>
      </main>
    </div>
  )
}
