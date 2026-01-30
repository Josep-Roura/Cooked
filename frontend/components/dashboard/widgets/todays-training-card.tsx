"use client"

import { useMemo, useState } from "react"
import { Activity, Clock, Play } from "lucide-react"
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

export function TodaysTrainingCard({ isLoading, sessions, onSelect, title }: TodaysTrainingCardProps) {
  const [selectedSession, setSelectedSession] = useState<TrainingSessionSummary | null>(null)

  const filteredSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.time && b.time) return a.time.localeCompare(b.time)
      if (a.time) return -1
      if (b.time) return 1
      return a.title.localeCompare(b.title)
    })
  }, [sessions])

  const getFuelingHint = (session: TrainingSessionSummary) => {
    if (session.durationMinutes >= 90 || session.intensity === "high") {
      return "Fuel before, during, and after this session."
    }
    if (session.durationMinutes >= 60) {
      return "Have carbs before and a recovery snack after."
    }
    if (session.durationMinutes >= 30) {
      return "A light snack after should be enough."
    }
    return "Hydrate and recover as usual."
  }

  const handleOpen = (session: TrainingSessionSummary) => {
    setSelectedSession(session)
    onSelect(session)
  }

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
        <span className="text-xs text-muted-foreground">{filteredSessions.length} sessions</span>
      </div>

      {filteredSessions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No sessions planned"
          description="There are no workouts scheduled for this day."
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
              <div className="flex-1 space-y-1">
                <h4 className="font-semibold text-foreground">{session.title}</h4>
                <p className="text-sm text-muted-foreground capitalize">
                  {session.type} • {session.intensity}
                </p>
                <p className="text-[11px] text-muted-foreground">{getFuelingHint(session)}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {session.durationMinutes}m
                </div>
                {session.calories ? (
                  <div className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
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
                  {selectedSession.type} • {selectedSession.intensity} • {selectedSession.durationMinutes}m
                </p>
              </DrawerHeader>
              <p className="text-sm text-muted-foreground mb-4">{selectedSession.description}</p>
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-6">
                <span>Scheduled: {selectedSession.time}</span>
                <span>{selectedSession.calories} kcal estimated</span>
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
