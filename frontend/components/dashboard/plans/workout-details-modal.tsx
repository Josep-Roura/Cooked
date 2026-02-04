"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Clock, Flame, Activity, Dumbbell, Timer, Zap, Loader, MapPin, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotionModal } from "@/components/ui/notion-modal"
import { useToast } from "@/components/ui/use-toast"
import { WorkoutNutritionCard } from "@/components/nutrition/workout-nutrition-card"
import { WorkoutNutritionTimeline } from "@/components/nutrition/workout-nutrition-timeline"
import { addMinutesToTime } from "@/components/dashboard/schedule/utils"
import type { TpWorkout } from "@/lib/db/types"

interface WorkoutDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workout: TpWorkout | null
  onUpdate?: () => void
  nearbyMeals?: Array<{ type: string; time: string; date: string }>
}

export function WorkoutDetailsModal({ open, onOpenChange, workout, onUpdate, nearbyMeals }: WorkoutDetailsModalProps) {
  const { toast } = useToast()
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [editedTime, setEditedTime] = useState("")
  const [isSavingTime, setIsSavingTime] = useState(false)
  const [isGeneratingNutrition, setIsGeneratingNutrition] = useState(false)
  const [customDuringNutrition, setCustomDuringNutrition] = useState<string | null>(null)
  const [nutritionPlan, setNutritionPlan] = useState<any>(null)
  const [displayedTime, setDisplayedTime] = useState("")
  const [nutritionRecordId, setNutritionRecordId] = useState<string | null>(null)
  const [isLoadingNutrition, setIsLoadingNutrition] = useState(false)
  
  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
       setIsEditingTime(false)
       setCustomDuringNutrition(null)
       setNutritionPlan(null)
       setNutritionRecordId(null)
     } else if (workout) {
       setDisplayedTime(workout.start_time ?? "TBD")
       // Auto-load nutrition if it exists
       loadNutritionPlan()
     }
   }, [open, workout])

   const loadNutritionPlan = async () => {
     if (!workout) return
     
     setIsLoadingNutrition(true)
     try {
       const response = await fetch(
         `/api/v1/nutrition/during-workout?startDate=${workout.workout_day}&endDate=${workout.workout_day}&limit=50`
       )
       
       if (response.ok) {
         const data = await response.json()
         const records = data.records ?? []
         
         console.log(`[Nutrition Load] Found ${records.length} records for date ${workout.workout_day}`)
         console.log(`[Nutrition Load] Looking for workout_id: ${workout.id} (type: ${typeof workout.id})`)
         records.forEach((r: any, idx: number) => {
           console.log(`  [Record ${idx}] workout_id: ${r.workout_id} (type: ${typeof r.workout_id}), has nutrition_plan_json: ${!!r.nutrition_plan_json}`)
         })
         
         // Try matching by workout_id (as string or number)
         const matchingRecord = records.find((r: any) => 
           String(r.workout_id) === String(workout.id)
         )
         
         if (matchingRecord) {
           console.log(`[Nutrition Load] ✅ Found matching record`)
           setNutritionRecordId(matchingRecord.id)
           setCustomDuringNutrition(matchingRecord.during_workout_recommendation)
           
           // Try to load the complete plan from nutrition_plan_json first
           if (matchingRecord.nutrition_plan_json) {
             try {
               console.log(`[Nutrition Load] Parsing nutrition_plan_json...`)
               const plan = typeof matchingRecord.nutrition_plan_json === 'string' 
                 ? JSON.parse(matchingRecord.nutrition_plan_json)
                 : matchingRecord.nutrition_plan_json
               console.log(`[Nutrition Load] ✅ Parsed nutrition_plan_json:`, plan)
               setNutritionPlan(plan)
               return
             } catch (e) {
               console.warn(`[Nutrition Load] Failed to parse nutrition_plan_json:`, e)
             }
           } else {
             console.log(`[Nutrition Load] nutrition_plan_json is null/empty`)
           }
           
           // Fallback to during_workout_recommendation
           if (matchingRecord.during_workout_recommendation) {
             try {
               console.log(`[Nutrition Load] Parsing during_workout_recommendation...`)
               const plan = typeof matchingRecord.during_workout_recommendation === 'string'
                 ? JSON.parse(matchingRecord.during_workout_recommendation)
                 : matchingRecord.during_workout_recommendation
               console.log(`[Nutrition Load] ✅ Parsed during_workout_recommendation:`, plan)
               setNutritionPlan(plan)
             } catch (e) {
               console.warn(`[Nutrition Load] Failed to parse during_workout_recommendation:`, e)
             }
           } else {
             console.log(`[Nutrition Load] during_workout_recommendation is also null/empty`)
           }
         } else {
           console.log(`[Nutrition Load] ❌ No matching record found for workout_id: ${workout.id}`)
         }
       }
     } catch (error) {
       console.warn("Could not load nutrition plan:", error)
     } finally {
       setIsLoadingNutrition(false)
     }
   }
  
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

    // Filter nearby meals from the same day
    const todaysMeals = nearbyMeals?.filter(m => m.date === workout.workout_day) ?? []

    setIsGeneratingNutrition(true)
    try {
      const response = await fetch("/api/ai/nutrition/during-workout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutId: workout.id,
          workoutDate: workout.workout_day,
          workoutType: workout.workout_type,
          durationMinutes: duration,
          intensity: workout.if ?? "moderate",
          tss: workout.tss ?? 0,
          description: workout.description ?? "",
          workoutStartTime: displayedTime,
          workoutEndTime: addMinutesToTime(displayedTime, duration),
          nearbyMealTimes: todaysMeals.map(m => ({
            mealType: m.type,
            time: m.time,
          })),
          save: true, // Save to database
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate nutrition plan")
      }

      const data = await response.json()
       setCustomDuringNutrition(data.nutrition)
       if (data.plan) {
         setNutritionPlan(data.plan)
       }
       if (data.recordId) {
         setNutritionRecordId(data.recordId)
       }
       
       toast({
         title: "Nutrition plan generated",
         description: data.saved ? "Saved to database" : "Custom nutrition plan created",
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
      <div className="space-y-4">
        
        {/* Time - Compact Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-blue-100 font-medium uppercase tracking-wide">Scheduled</p>
              <p className="text-sm text-blue-50">{workoutDate}</p>
            </div>
            
            {isEditingTime ? (
              <div className="flex gap-1.5 items-end">
                <Input
                  type="time"
                  value={editedTime}
                  onChange={(e) => setEditedTime(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/50 rounded h-8 w-20 text-sm"
                />
                <Button
                  onClick={handleTimeSave}
                  disabled={isSavingTime}
                  size="sm"
                  className="bg-white text-blue-600 hover:bg-blue-50 rounded h-8 px-2.5 text-xs"
                >
                  {isSavingTime ? <Loader className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
                <Button
                  onClick={() => setIsEditingTime(false)}
                  disabled={isSavingTime}
                  size="sm"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/20 rounded h-8 px-2.5 text-xs"
                >
                  ×
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-bold">{displayedTime}</span>
                <Button
                  onClick={handleTimeEdit}
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded h-8 px-2.5 text-xs"
                >
                  Edit
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats - Compact */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {duration && (
            <div className="bg-blue-50 rounded-lg p-2 border border-blue-200/60">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-lg font-bold text-blue-900">{duration}</span>
              </div>
              <p className="text-xs text-blue-700 font-medium">min</p>
            </div>
          )}
          {workout.tss && (
            <div className="bg-orange-50 rounded-lg p-2 border border-orange-200/60">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingUp className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-lg font-bold text-orange-900">{workout.tss}</span>
              </div>
              <p className="text-xs text-orange-700 font-medium">TSS</p>
            </div>
          )}
          {workout.if && (
            <div className="bg-red-50 rounded-lg p-2 border border-red-200/60">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Flame className="h-3.5 w-3.5 text-red-600" />
                <span className="text-lg font-bold text-red-900">{(parseFloat(workout.if) * 100).toFixed(0)}%</span>
              </div>
              <p className="text-xs text-red-700 font-medium">IF</p>
            </div>
          )}
          {workout.power_avg && (
            <div className="bg-purple-50 rounded-lg p-2 border border-purple-200/60">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Dumbbell className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-lg font-bold text-purple-900">{Math.round(workout.power_avg)}</span>
              </div>
              <p className="text-xs text-purple-700 font-medium">W</p>
            </div>
          )}
        </div>

        {/* Description */}
        {workout.description && (
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200/60">
            <h3 className="text-xs font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-600" /> Description
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{workout.description}</p>
          </div>
        )}

        {/* Coach Comments */}
        {workout.coach_comments && (
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200/60">
            <h3 className="text-xs font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
              <span>📝</span> Coach Notes
            </h3>
            <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{workout.coach_comments}</p>
          </div>
        )}

        {/* Nutrition Strategy */}
         <div className="space-y-4">
           {/* Loading state */}
           {isLoadingNutrition && (
             <div className="bg-blue-50 rounded-lg p-4 border border-blue-200/60 text-center">
               <Loader className="h-4 w-4 animate-spin mx-auto text-blue-600" />
               <p className="text-xs text-blue-700 mt-2">Cargando plan de nutrición...</p>
             </div>
           )}

           {/* Show Timeline when plan is generated */}
           {!isLoadingNutrition && nutritionPlan ? (
             <WorkoutNutritionTimeline
               plan={nutritionPlan}
               workoutDuration={duration || 0}
               workoutStartTime={displayedTime}
               recordId={nutritionRecordId || undefined}
               onSave={async (updates) => {
                 if (!nutritionRecordId) return
                 const response = await fetch(`/api/v1/nutrition/during-workout/${nutritionRecordId}`, {
                   method: "PATCH",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify(updates),
                 })
                 if (!response.ok) throw new Error("Failed to save")
               }}
             />
            ) : !isLoadingNutrition ? (
              <>
                {/* Pre-workout */}
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200/60">
                  <h3 className="text-xs font-semibold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                    🥗 Pre-workout
                  </h3>
                  <p className="text-sm text-emerald-900">Consume 30-60g carbs 30-60 min before</p>
                </div>

                {/* During */}
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200/60">
                  <h3 className="text-xs font-semibold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                    ⚡ During
                  </h3>
                  <p className="text-sm text-emerald-900 mb-2.5">
                    {duration && duration >= 90 
                      ? "60-90g carbs/hour" 
                      : duration && duration >= 60 
                        ? "30-60g carbs"
                        : "Hydrate with electrolytes"}
                  </p>
                </div>

                {/* Post-workout */}
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200/60">
                  <h3 className="text-xs font-semibold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                    🍽️ Post-workout
                  </h3>
                  <p className="text-sm text-emerald-900">20-40g protein + 40-80g carbs within 30-60 min</p>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerateDuringNutrition}
                  disabled={isGeneratingNutrition}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                >
                  {isGeneratingNutrition ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                      Generating AI Nutrition Plan...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Generate AI Nutrition Plan
                    </>
                  )}
                </Button>
              </>
            ) : null}
         </div>
      </div>
    </NotionModal>
  )
}
