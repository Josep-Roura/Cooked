"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Clock, Flame, Activity, Dumbbell, Timer, Zap, Loader } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotionModal } from "@/components/ui/notion-modal"
import { useToast } from "@/components/ui/use-toast"
import type { TpWorkout } from "@/lib/db/types"

interface WorkoutDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: TpWorkout | null
  onUpdate?: () => void
}

export function WorkoutDetailsModal({ open, onOpenChange, workout, onUpdate }: WorkoutDetailsModalProps) {
  const { toast } = useToast()
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [editedTime, setEditedTime] = useState("")
  const [isGeneratingNutrition, setIsGeneratingNutrition] = useState(false)
  const [customDuringNutrition, setCustomDuringNutrition] = useState<string | null>(null)
  
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

  const currentTime = workout.start_time ?? "TBD"
  
  const handleTimeEdit = () => {
    setEditedTime(currentTime)
    setIsEditingTime(true)
  }

  const handleTimeSave = async () => {
    if (!editedTime) {
      toast({
        title: "Invalid time",
        description: "Please enter a valid time",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/v1/workouts/update-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutId: workout.id,
          startTime: editedTime,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update workout time")
      }

      toast({
        title: "Time updated",
        description: `Workout time changed to ${editedTime}`,
      })
      setIsEditingTime(false)
      onUpdate?.()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update time",
        variant: "destructive",
      })
    }
  }

  const handleGenerateDuringNutrition = async () => {
    if (!duration) {
      toast({
        title: "Duration required",
        description: "Unable to determine workout duration",
        variant: "destructive",
      })
      return
    }

    setIsGeneratingNutrition(true)
    try {
      const response = await fetch("/api/ai/nutrition/during-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutType: workout.workout_type,
          durationMinutes: duration,
          intensity: workout.if ?? "moderate",
          tss: workout.tss ?? 0,
          description: workout.description ?? "",
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate nutrition plan")
      }

      const data = await response.json()
      setCustomDuringNutrition(data.nutrition)
      
      toast({
        title: "Nutrition plan generated",
        description: "Custom during-workout nutrition plan created",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate nutrition",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingNutrition(false)
    }
  }

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

        {/* Time Editor */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Scheduled Time
          </h3>
          <div className="flex items-center gap-3">
            {isEditingTime ? (
              <>
                <Input
                  type="time"
                  value={editedTime}
                  onChange={(e) => setEditedTime(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleTimeSave}
                  size="sm"
                  variant="default"
                  className="rounded-md"
                >
                  Save
                </Button>
                <Button
                  onClick={() => setIsEditingTime(false)}
                  size="sm"
                  variant="outline"
                  className="rounded-md"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <div className="text-sm text-foreground">
                  {format(new Date(workout.workout_day), "EEEE, MMM d")} at <span className="font-semibold">{currentTime}</span>
                </div>
                <Button
                  onClick={handleTimeEdit}
                  size="sm"
                  variant="outline"
                  className="rounded-md ml-auto"
                >
                  Edit
                </Button>
              </>
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
              {customDuringNutrition ? (
                <div className="text-emerald-800">
                  <p className="font-medium mb-2">{customDuringNutrition}</p>
                  <Button
                    onClick={() => setCustomDuringNutrition(null)}
                    size="sm"
                    variant="ghost"
                    className="text-emerald-600 text-xs h-6"
                  >
                    Show default recommendation
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 flex-1">
                  <span className="text-emerald-800">
                    {duration && duration >= 90 
                      ? "60-90g carbs/hour for sessions > 90 min" 
                      : duration && duration >= 60 
                        ? "30-60g carbs for sessions > 60 min" 
                        : "Hydrate with electrolytes"}
                  </span>
                  <Button
                    onClick={handleGenerateDuringNutrition}
                    size="sm"
                    variant="outline"
                    disabled={isGeneratingNutrition}
                    className="text-emerald-600 border-emerald-300 hover:bg-emerald-100/50 w-fit text-xs h-7"
                  >
                    {isGeneratingNutrition ? (
                      <>
                        <Loader className="h-3 w-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 mr-1" />
                        Generate custom plan
                      </>
                    )}
                  </Button>
                </div>
              )}
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
