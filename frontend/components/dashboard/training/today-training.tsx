"use client"

import { Clock, Flame, Activity, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TrainingSessionSummary } from "@/lib/db/types"

interface TodayTrainingProps {
  session: TrainingSessionSummary
}

const typeIcons = {
  swim: "🏊",
  bike: "🚴",
  run: "🏃",
  strength: "💪",
  rest: "🧘",
  other: "🏋️",
}

const intensityColors = {
  low: "bg-green-500",
  moderate: "bg-yellow-500",
  high: "bg-red-500",
}

export function TodayTraining({ session }: TodayTrainingProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Today's Training</h3>
        <span
          className={`px-3 py-1 rounded-full text-xs text-white ${session.completed ? "bg-green-500" : "bg-blue-500"}`}
        >
          {session.completed ? "Completed" : "Upcoming"}
        </span>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl">
          {typeIcons[session.type]}
        </div>
        <div>
          <h4 className="text-xl font-bold text-foreground">{session.title}</h4>
          <p className="text-muted-foreground capitalize">{session.type} workout</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-muted rounded-xl p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <p className="text-lg font-semibold text-foreground">{session.durationMinutes}</p>
          <p className="text-xs text-muted-foreground">minutes</p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <Flame className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <p className="text-lg font-semibold text-foreground">{session.calories}</p>
          <p className="text-xs text-muted-foreground">calories</p>
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <Activity className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
          <div className="flex items-center justify-center gap-2">
            <div className={`h-2 w-2 rounded-full ${intensityColors[session.intensity]}`} />
            <p className="text-sm font-semibold text-foreground capitalize">{session.intensity}</p>
          </div>
          <p className="text-xs text-muted-foreground">intensity</p>
        </div>
      </div>

      {!session.completed && (
        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Play className="h-4 w-4" />
          Start Workout
        </Button>
      )}
    </div>
  )
}
