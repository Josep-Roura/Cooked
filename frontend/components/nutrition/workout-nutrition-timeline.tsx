"use client"

import { useState } from "react"
import { ChevronDown, Clock, Droplet, Zap, Flame, Apple, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface WorkoutNutritionPlanProps {
  plan: {
    preWorkout?: {
      timing: string
      items: Array<{
        time: string
        product: string
        quantity: number
        unit: string
        carbs?: number
        protein?: number
        sodium?: number
        notes?: string
      }>
      totalCarbs: number
      totalProtein: number
      totalCalories: number
    }
    duringWorkout?: {
      timing: string
      interval: number
      items: Array<{
        time: string
        product: string
        quantity: number
        unit: string
        carbs?: number
        sodium?: number
        notes?: string
      }>
      totalCarbs: number
      totalHydration: number
      totalSodium: number
    }
    postWorkout?: {
      timing: string
      items: Array<{
        time: string
        product: string
        quantity: number
        unit: string
        carbs?: number
        protein?: number
        sodium?: number
        notes?: string
      }>
      totalCarbs: number
      totalProtein: number
      totalCalories: number
    }
    recommendations?: string
  }
  workoutDuration?: number
  workoutStartTime?: string
  recordId?: string
  onSave?: (updates: Record<string, unknown>) => Promise<void>
}

export function WorkoutNutritionTimeline({
  plan,
  workoutDuration = 0,
  workoutStartTime = "06:00",
  recordId,
  onSave,
}: WorkoutNutritionPlanProps) {
  const { toast } = useToast()
  const [expandedSection, setExpandedSection] = useState<"pre" | "during" | "post" | null>("pre")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!recordId || !onSave) return
    setIsSaving(true)
    try {
      await onSave({ during_workout_recommendation: JSON.stringify(plan) })
      toast({ title: "Success", description: "Nutrition plan saved" })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Parse start time to calculate actual times
  const [startHour, startMin] = workoutStartTime.split(":").map(Number)
  const calculateTime = (minutesOffset: number) => {
    const date = new Date()
    date.setHours(startHour, startMin)
    date.setMinutes(date.getMinutes() + minutesOffset)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  }

  return (
    <div className="space-y-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-4 border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-slate-900">Nutrition Timeline</h2>
        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded">
          {workoutDuration} min workout
        </span>
      </div>

      {/* Pre-Workout Section */}
      {plan.preWorkout && (
        <PreWorkoutSection
          data={plan.preWorkout}
          isExpanded={expandedSection === "pre"}
          onToggle={() => setExpandedSection(expandedSection === "pre" ? null : "pre")}
        />
      )}

      {/* During-Workout Section */}
      {plan.duringWorkout && (
        <DuringWorkoutSection
          data={plan.duringWorkout}
          workoutDuration={workoutDuration}
          workoutStartTime={workoutStartTime}
          calculateTime={calculateTime}
          isExpanded={expandedSection === "during"}
          onToggle={() => setExpandedSection(expandedSection === "during" ? null : "during")}
        />
      )}

      {/* Post-Workout Section */}
      {plan.postWorkout && (
        <PostWorkoutSection
          data={plan.postWorkout}
          workoutDuration={workoutDuration}
          workoutStartTime={workoutStartTime}
          calculateTime={calculateTime}
          isExpanded={expandedSection === "post"}
          onToggle={() => setExpandedSection(expandedSection === "post" ? null : "post")}
        />
      )}

      {/* Recommendations */}
      {plan.recommendations && (
        <div className="bg-white rounded-lg p-3 border border-amber-200 mt-3">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">{plan.recommendations}</p>
          </div>
        </div>
      )}

      {/* Save Button */}
      {recordId && onSave && (
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
        >
          {isSaving ? "Saving..." : "Save Nutrition Plan"}
        </Button>
      )}
    </div>
  )
}

interface SectionProps {
  isExpanded: boolean
  onToggle: () => void
}

function PreWorkoutSection({
  data,
  isExpanded,
  onToggle,
}: SectionProps & { data: any }) {
  return (
    <div className="bg-white rounded-lg border border-emerald-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-emerald-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center">
            <Apple className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900 text-sm">Pre-Workout</h3>
            <p className="text-xs text-emerald-700">{data.timing}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <NutrientBadge icon={Flame} label="Carbs" value={`${data.totalCarbs}g`} color="orange" />
            <NutrientBadge icon={Zap} label="Protein" value={`${data.totalProtein}g`} color="purple" />
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-emerald-600 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-emerald-200 p-3 space-y-2 bg-emerald-50">
          {data.items.map((item: any, idx: number) => (
            <NutritionItem key={idx} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function DuringWorkoutSection({
  data,
  workoutDuration,
  workoutStartTime,
  calculateTime,
  isExpanded,
  onToggle,
}: SectionProps & {
  data: any
  workoutDuration: number
  workoutStartTime: string
  calculateTime: (offset: number) => string
}) {
  const numIntervals = Math.ceil(workoutDuration / data.interval)

  return (
    <div className="bg-white rounded-lg border border-blue-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
            <Droplet className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 text-sm">During Workout</h3>
            <p className="text-xs text-blue-700">Every {data.interval} min ({numIntervals} times)</p>
          </div>
          <div className="ml-auto flex gap-2">
            <NutrientBadge icon={Flame} label="Carbs" value={`${data.totalCarbs}g/h`} color="orange" />
            <NutrientBadge icon={Droplet} label="Hydration" value={`${data.totalHydration}ml/h`} color="cyan" />
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-blue-600 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-blue-200 p-3 space-y-3 bg-blue-50">
          {/* Schedule */}
          <div className="space-y-2">
            {Array.from({ length: numIntervals }).map((_, idx) => {
              const offset = idx * data.interval
              const time = calculateTime(offset)
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span className="font-semibold text-blue-900 w-14">{time}</span>
                  <span className="text-blue-700">→ Consume every item below</span>
                </div>
              )
            })}
          </div>

          {/* Items to consume */}
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-2">Each interval, consume:</p>
            {data.items.map((item: any, idx: number) => (
              <NutritionItem key={idx} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PostWorkoutSection({
  data,
  workoutDuration,
  workoutStartTime,
  calculateTime,
  isExpanded,
  onToggle,
}: SectionProps & {
  data: any
  workoutDuration: number
  workoutStartTime: string
  calculateTime: (offset: number) => string
}) {
  const postTime = calculateTime(workoutDuration + 10) // ~10 min after

  return (
    <div className="bg-white rounded-lg border border-pink-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-pink-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="w-8 h-8 rounded bg-pink-100 flex items-center justify-center">
            <Flame className="w-4 h-4 text-pink-600" />
          </div>
          <div>
            <h3 className="font-semibold text-pink-900 text-sm">Post-Workout</h3>
            <p className="text-xs text-pink-700">{data.timing} (~{postTime})</p>
          </div>
          <div className="ml-auto flex gap-2">
            <NutrientBadge icon={Flame} label="Carbs" value={`${data.totalCarbs}g`} color="orange" />
            <NutrientBadge icon={Zap} label="Protein" value={`${data.totalProtein}g`} color="purple" />
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-pink-600 transition-transform", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-pink-200 p-3 space-y-2 bg-pink-50">
          {data.items.map((item: any, idx: number) => (
            <NutritionItem key={idx} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}

function NutritionItem({ item }: { item: any }) {
  return (
    <div className="bg-white rounded p-2 border border-slate-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-semibold text-sm text-slate-900">{item.product}</p>
          <p className="text-xs text-slate-600">
            <strong>{item.quantity}</strong> {item.unit}
          </p>
          {item.notes && <p className="text-xs text-slate-500 italic mt-1">{item.notes}</p>}
        </div>
        <div className="flex gap-2 ml-2">
          {item.carbs !== undefined && (
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
              {item.carbs}g carbs
            </span>
          )}
          {item.protein !== undefined && (
            <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
              {item.protein}g protein
            </span>
          )}
          {item.sodium !== undefined && (
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
              {item.sodium}mg Na
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function NutrientBadge({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any
  label: string
  value: string
  color: string
}) {
  const bgClass = {
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
    cyan: "bg-cyan-50 text-cyan-700",
  }[color] || "bg-slate-50 text-slate-700"

  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded ${bgClass}`}>
      <Icon className="w-3 h-3" />
      <span className="text-xs font-semibold">{value}</span>
    </div>
  )
}
