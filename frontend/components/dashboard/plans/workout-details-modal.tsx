"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Clock, Flame, Activity, Dumbbell, Timer, Zap, Loader, MapPin, TrendingUp } from "lucide-react"
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
  const [isSavingTime, setIsSavingTime] = useState(false)
  const [isGeneratingNutrition, setIsGeneratingNutrition] = useState(false)
  const [customDuringNutrition, setCustomDuringNutrition] = useState<string | null>(null)
  const [displayedTime, setDisplayedTime] = useState("")
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setIsEditingTime(false)
      setCustomDuringNutrition(null)
    } else if (workout) {
      setDisplayedTime(workout.start_time ?? "TBD")
    }
  }, [open, workout])
  
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
  
  const handleTimeEdit = () => {
    setEditedTime(displayedTime)
    setIsEditingTime(true)
  }

  const handleTimeSave = async () => {
    if (!editedTime || editedTime === "TBD") {
      toast({
        title: "Invalid time",
        description: "Please enter a valid time",
        variant: "destructive",
      })
      return
    }

    setIsSavingTime(true)
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

      setDisplayedTime(editedTime)
      setIsEditingTime(false)
      
      toast({
        title: "Success",
        description: `Workout time updated to ${editedTime}`,
      })
      
      onUpdate?.()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update time",
        variant: "destructive",
      })
    } finally {
      setIsSavingTime(false)
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
        description: "Custom during-workout nutrition created",
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

  const workoutDate = format(new Date(workout.workout_day), "EEEE, MMM d, yyyy")

  return (
    <NotionModal open={open} onOpenChange={onOpenChange} title={`${emoji} ${title}`} description={description}>
      <div className="space-y-5">
        
        {/* Header with Time Editor - Premium Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="space-y-4">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Scheduled for</p>
              <p className="text-lg text-blue-50">{workoutDate}</p>
            </div>
            
            {isEditingTime ? (
              <div className="flex gap-2 items-end pt-2">
                <div className="flex-1">
                  <label className="text-xs text-blue-100 block mb-2">Start Time</label>
                  <Input
                    type="time"
                    value={editedTime}
                    onChange={(e) => setEditedTime(e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/50 rounded-lg"
                  />
                </div>
                <Button
                  onClick={handleTimeSave}
                  disabled={isSavingTime}
                  size="sm"
                  className="bg-white text-blue-600 hover:bg-blue-50 rounded-lg h-10"
                >
                  {isSavingTime ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
                <Button
                  onClick={() => setIsEditingTime(false)}
                  disabled={isSavingTime}
                  size="sm"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/20 rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-100" />
                  <span className="text-3xl font-bold">{displayedTime}</span>
                </div>
                <Button
                  onClick={handleTimeEdit}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-lg"
                >
                  Change Time
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {duration && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 border border-blue-200/60">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-2xl font-bold text-blue-900">{duration}</span>
              </div>
              <p className="text-xs text-blue-700 font-medium">minutes</p>
            </div>
          )}
          {workout.tss && (
            <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-3 border border-orange-200/60">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-2xl font-bold text-orange-900">{workout.tss}</span>
              </div>
              <p className="text-xs text-orange-700 font-medium">TSS</p>
            </div>
          )}
          {workout.if && (
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-3 border border-red-200/60">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-red-600" />
                <span className="text-2xl font-bold text-red-900">{(parseFloat(workout.if) * 100).toFixed(0)}%</span>
              </div>
              <p className="text-xs text-red-700 font-medium">Intensity</p>
            </div>
          )}
          {workout.power_avg && (
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-3 border border-purple-200/60">
              <div className="flex items-center gap-2 mb-1">
                <Dumbbell className="h-4 w-4 text-purple-600" />
                <span className="text-2xl font-bold text-purple-900">{Math.round(workout.power_avg)}</span>
              </div>
              <p className="text-xs text-purple-700 font-medium">watts</p>
            </div>
          )}
        </div>

        {/* Description Section */}
        {workout.description && (
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 border border-slate-200/60">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-600" /> Description
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{workout.description}</p>
          </div>
        )}

        {/* Coach Comments */}
        {workout.coach_comments && (
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 border border-amber-200/60">
            <h3 className="text-sm font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <span>📝</span> Coach Notes
            </h3>
            <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{workout.coach_comments}</p>
          </div>
        )}

        {/* Nutrition Strategy - Enhanced */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-5 border border-emerald-200/60">
          <h3 className="text-sm font-semibold text-emerald-900 mb-4 flex items-center gap-2">
            🥗 Nutrition Strategy
          </h3>
          
          <div className="space-y-4">
            {/* Pre-workout */}
            <div className="bg-white/60 rounded-lg p-3 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Pre-workout</p>
              <p className="text-sm text-emerald-900">Consume 30-60g carbs 30-60 min before</p>
            </div>

            {/* During */}
            <div className="bg-white/60 rounded-lg p-3 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">During</p>
              {customDuringNutrition ? (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-900 leading-relaxed">{customDuringNutrition}</p>
                  <Button
                    onClick={() => setCustomDuringNutrition(null)}
                    size="sm"
                    variant="ghost"
                    className="text-emerald-600 hover:bg-emerald-100/50 text-xs h-7 px-2"
                  >
                    ← Back to default
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-emerald-900">
                    {duration && duration >= 90 
                      ? "60-90g carbs/hour for sessions > 90 min" 
                      : duration && duration >= 60 
                        ? "30-60g carbs for sessions > 60 min" 
                        : "Hydrate with electrolytes"}
                  </p>
                  <Button
                    onClick={handleGenerateDuringNutrition}
                    size="sm"
                    disabled={isGeneratingNutrition}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs h-8"
                  >
                    {isGeneratingNutrition ? (
                      <>
                        <Loader className="h-3 w-3 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-3 w-3 mr-2" />
                        Generate Custom Plan
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Post-workout */}
            <div className="bg-white/60 rounded-lg p-3 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Post-workout</p>
              <p className="text-sm text-emerald-900">20-40g protein + 40-80g carbs within 30-60 min</p>
            </div>
          </div>
        </div>
      </div>
    </NotionModal>
  )
}
