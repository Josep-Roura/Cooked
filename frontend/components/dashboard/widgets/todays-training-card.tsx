"use client"

import { useMemo, useState } from "react"
import { Activity, Clock, Flame, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import type { TrainingSessionSummary, TrainingType } from "@/lib/db/types"

interface TodaysTrainingCardProps {
  isLoading: boolean
  sessions: TrainingSessionSummary[]
  onSelect: (session: TrainingSessionSummary) => void
  title?: string
}

const typeIcons: Record<TrainingType, string> = {
  swim: "🏊",
  bike: "🚴",
  run: "🏃",
  strength: "💪",
  rest: "🧘",
  other: "🏋️",
}

const fuelingHints: Array<{
  label: string
  predicate: (session: TrainingSessionSummary) => boolean
}> = [
  {
    label: "Fuel before + during. Add carbs + fluids post-session.",
    predicate: (session) => session.durationMinutes >= 90 || session.intensity === "high",
  },
  {
    label: "Have a small carb snack 30-60 min before. Rehydrate after.",
    predicate: (session) => session.durationMinutes >= 45 || session.intensity === "moderate",
  },
  {
    label: "Light session — hydrate and add protein after.",
    predicate: () => true,
  },
]

export function TodaysTrainingCard({ isLoading, sessions, onSelect, title }: TodaysTrainingCardProps) {
  const [selectedSession, setSelectedSession] = useState<TrainingSessionSummary | null>(null)

  const filteredSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title)),
    [sessions],
  )

  const handleOpen = (session: TrainingSessionSummary) => {
    setSelectedSession(session)
    onSelect(session)
  }

  const getFuelingHint = (session: TrainingSessionSummary) =>
    fuelingHints.find((hint) => hint.predicate(session))?.label ?? ""

  const formatIntensity = (intensity: TrainingSessionSummary["intensity"]) =>
    intensity ? intensity.charAt(0).toUpperCase() + intensity.slice(1) : null

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title ?? "Today's Training"}</h3>
      </div>

      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No sessions for this day"
          description="Your training sessions will show up here once scheduled."
        />
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => handleOpen(session)}
              className="w-full text-left bg-muted rounded-xl p-4 flex items-center gap-4 hover:bg-muted/70 transition"
            >
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                {typeIcons[session.type]}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{session.title}</h4>
                <p className="text-sm text-muted-foreground capitalize">
                  {session.type}
                  {formatIntensity(session.intensity) ? ` • ${formatIntensity(session.intensity)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Fueling hint: {getFuelingHint(session)}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {session.durationMinutes}m
                </div>
                {session.calories ? (
                  <div className="flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {session.calories} kcal
                  </div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      <Drawer open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DrawerContent>
          {selectedSession && (
            <div className="p-6">
              <DrawerHeader className="p-0 mb-4">
                <DrawerTitle className="text-lg font-semibold">{selectedSession.title}</DrawerTitle>
                <p className="text-sm text-muted-foreground capitalize">
                  {selectedSession.type}
                  {formatIntensity(selectedSession.intensity) ? ` • ${formatIntensity(selectedSession.intensity)}` : ""}
                  • {selectedSession.durationMinutes}m
                </p>
              </DrawerHeader>
              <p className="text-sm text-muted-foreground mb-4">{selectedSession.description}</p>
              
              {/* Nutrition Section */}
              <div className="bg-muted rounded-xl p-4 mb-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Workout Nutrition</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-muted-foreground">Calories:</span>
                    <span className="font-medium">{selectedSession.calories ?? "N/A"} kcal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">{selectedSession.durationMinutes} min</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Fueling Strategy:</span> {getFuelingHint(selectedSession)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground mb-6">
                <span>Scheduled: {selectedSession.time}</span>
              </div>
              {!selectedSession.completed && (
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  <Play className="h-4 w-4" />
                  Start Workout
                </Button>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
