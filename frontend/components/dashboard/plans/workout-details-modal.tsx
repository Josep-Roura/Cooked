"use client"

import { format } from "date-fns"
import { Clock, Flame, Activity, Dumbbell, Timer } from "lucide-react"
import { NotionModal } from "@/components/ui/notion-modal"
import type { TpWorkout } from "@/lib/db/types"

interface WorkoutDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: TpWorkout | null
}

export function WorkoutDetailsModal({ open, onOpenChange, workout }: WorkoutDetailsModalProps) {
  if (!workout) {
    return (
      <NotionModal open={open} onOpenChange={onOpenChange} title="Workout details">
        <p className="text-sm text-muted-foreground">Select a workout to see details.</p>
      </NotionModal>
    )
  }

  const title = workout.title ?? workout.workout_type ?? "Workout"
  const duration = workout.planned_hours 
    ? Math.round(workout.planned_hours * 60) 
    : workout.actual_hours 
      ? Math.round(workout.actual_hours * 60) 
      : null
  const description = duration 
    ? `${duration} min · ${workout.workout_type || "Training"}` 
    : workout.workout_type || "Training session"

  const workoutType = workout.workout_type?.toLowerCase() ?? ""
  const emoji = workoutType.includes("swim")
    ? "🏊"
    : workoutType.includes("bike") || workoutType.includes("cycle")
      ? "🚴"
      : workoutType.includes("run")
        ? "🏃"
        : workoutType.includes("strength")
          ? "🏋️"
          : workoutType.includes("rest")
            ? "🛌"
            : "🏅"

  return (
    <NotionModal open={open} onOpenChange={onOpenChange} title={`${emoji} ${title}`} description={description}>
      <div className="space-y-6">
        {/* Workout Stats */}
        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200/60">
          <h3 className="text-sm font-semibold text-foreground mb-3">Workout Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {duration && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-lg font-bold text-foreground">{duration}</span>
                </div>
                <div className="text-xs text-muted-foreground">minutes</div>
              </div>
            )}
            {workout.tss && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Activity className="h-4 w-4 text-orange-500" />
                  <span className="text-lg font-bold text-foreground">{workout.tss}</span>
                </div>
                <div className="text-xs text-muted-foreground">TSS</div>
              </div>
            )}
            {workout.if && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Flame className="h-4 w-4 text-red-500" />
                  <span className="text-lg font-bold text-foreground">{workout.if}</span>
                </div>
                <div className="text-xs text-muted-foreground">IF</div>
              </div>
            )}
            {workout.power_avg && (
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Dumbbell className="h-4 w-4 text-purple-500" />
                  <span className="text-lg font-bold text-foreground">{Math.round(workout.power_avg)}</span>
                </div>
                <div className="text-xs text-muted-foreground">avg watts</div>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {workout.description && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workout.description}</p>
          </div>
        )}

        {/* Coach Comments */}
        {workout.coach_comments && (
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span>📝</span> Coach Notes
            </h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{workout.coach_comments}</p>
          </div>
        )}

        {/* Nutrition Strategy */}
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
          <h3 className="text-sm font-semibold text-emerald-900 mb-3">🥗 Nutrition Strategy</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-medium shrink-0">Pre-workout:</span>
              <span className="text-emerald-800">Consume 30-60g carbs 30-60 min before</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-medium shrink-0">During:</span>
              <span className="text-emerald-800">
                {duration && duration >= 90 
                  ? "60-90g carbs/hour for sessions > 90 min" 
                  : duration && duration >= 60 
                    ? "30-60g carbs for sessions > 60 min" 
                    : "Hydrate with electrolytes"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-medium shrink-0">Post-workout:</span>
              <span className="text-emerald-800">20-40g protein + 40-80g carbs within 30-60 min</span>
            </div>
          </div>
        </div>

        {/* Scheduled Info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Timer className="h-3 w-3" />
          <span>
            Scheduled: {format(new Date(workout.workout_day), "EEEE, MMM d")} at {workout.start_time ?? "TBD"}
          </span>
        </div>
      </div>
    </NotionModal>
  )
}
