"use client"

import { useState } from "react"
import { ChevronDown, Clock, Droplet, Zap, Flame, Apple, AlertCircle, Download } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { exportNutritionToPDF, exportNutritionAsTextPDF } from "@/lib/nutrition/export-pdf"
import { NutritionReminders } from "./nutrition-reminders"

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
  const [isExporting, setIsExporting] = useState(false)

  // Handle if plan is a string instead of object
  let parsedPlan = plan
  if (typeof plan === "string") {
    try {
      parsedPlan = JSON.parse(plan)
    } catch {
      console.error("Could not parse plan string:", plan)
      return <div className="text-red-600">Error parsing nutrition plan</div>
    }
  }

  // Validate plan structure
  if (!parsedPlan || typeof parsedPlan !== "object") {
    return <div className="text-red-600">Invalid nutrition plan format</div>
  }

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

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportNutritionToPDF("nutrition-timeline-export", {
        filename: `nutrition-plan-${new Date().toISOString().split("T")[0]}.pdf`,
        workoutDuration,
        workoutStartTime,
      })
      toast({ title: "Success", description: "Nutrition plan exported to PDF" })
    } catch (error) {
      // Fallback to text PDF if canvas export fails
      try {
        exportNutritionAsTextPDF(parsedPlan, {
          filename: `nutrition-plan-${new Date().toISOString().split("T")[0]}.pdf`,
          workoutDuration,
          workoutStartTime,
        })
        toast({ title: "Success", description: "Nutrition plan exported to PDF (text format)" })
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to export nutrition plan",
          variant: "destructive",
        })
      }
    } finally {
      setIsExporting(false)
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
    <div className="space-y-3">
      {/* Reminders Section */}
      <NutritionReminders
        plan={parsedPlan}
        workoutDuration={workoutDuration}
        workoutStartTime={workoutStartTime}
      />

      {/* Export Container - Hidden during export */}
      <div id="nutrition-timeline-export" className="space-y-3 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg p-3 md:p-4 border border-slate-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
          <h2 className="text-base md:text-lg font-bold text-slate-900">Nutrition Timeline</h2>
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded whitespace-nowrap">
            {workoutDuration} min workout
          </span>
        </div>

        {/* Pre-Workout Section */}
        {parsedPlan?.preWorkout && (
          <PreWorkoutSection
            data={plan.preWorkout}
            isExpanded={expandedSection === "pre"}
            onToggle={() => setExpandedSection(expandedSection === "pre" ? null : "pre")}
          />
        )}

        {/* During-Workout Section */}
        {parsedPlan?.duringWorkout && (
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
        {parsedPlan?.postWorkout && (
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
        {parsedPlan?.recommendations && (
          <div className="bg-white rounded-lg p-3 border border-amber-200 mt-3">
            <div className="flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">{parsedPlan.recommendations}</p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {recordId && onSave && (
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? "Saving..." : "Save Nutrition Plan"}
          </Button>
        )}
        <Button
          onClick={handleExport}
          disabled={isExporting}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          {isExporting ? "Exporting..." : "Export to PDF"}
        </Button>
      </div>
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
        className="w-full p-2 md:p-3 flex items-center justify-between hover:bg-emerald-50 transition-colors"
      >
        <div className="flex items-center gap-2 md:gap-3 flex-1 text-left min-w-0">
          <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Apple className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-emerald-900 text-xs md:text-sm">Pre-Workout</h3>
            <p className="text-xs text-emerald-700 truncate">{data.timing}</p>
          </div>
          <div className="hidden sm:flex gap-1 md:gap-2 flex-shrink-0">
            <NutrientBadge icon={Flame} label="Carbs" value={`${data.totalCarbs}g`} color="orange" />
            <NutrientBadge icon={Zap} label="Protein" value={`${data.totalProtein}g`} color="purple" />
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-emerald-600 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-emerald-200 p-2 md:p-3 space-y-2 bg-emerald-50">
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
        className="w-full p-2 md:p-3 flex items-center justify-between hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-2 md:gap-3 flex-1 text-left min-w-0">
          <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Droplet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-blue-900 text-xs md:text-sm">During Workout</h3>
            <p className="text-xs text-blue-700 truncate">Every {data.interval} min ({numIntervals}x)</p>
          </div>
          <div className="hidden sm:flex gap-1 md:gap-2 flex-shrink-0">
            <NutrientBadge icon={Flame} label="Carbs" value={`${data.totalCarbs}g/h`} color="orange" />
            <NutrientBadge icon={Droplet} label="Hydration" value={`${data.totalHydration}ml/h`} color="cyan" />
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-blue-600 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-blue-200 p-2 md:p-3 space-y-3 bg-blue-50">
          {/* Schedule */}
          <div className="space-y-2">
            {Array.from({ length: numIntervals }).map((_, idx) => {
              const offset = idx * data.interval
              const time = calculateTime(offset)
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-blue-600 flex-shrink-0" />
                  <span className="font-semibold text-blue-900 w-14 flex-shrink-0">{time}</span>
                  <span className="text-blue-700 truncate">→ Consume items</span>
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
        className="w-full p-2 md:p-3 flex items-center justify-between hover:bg-pink-50 transition-colors"
      >
        <div className="flex items-center gap-2 md:gap-3 flex-1 text-left min-w-0">
          <div className="w-8 h-8 rounded bg-pink-100 flex items-center justify-center flex-shrink-0">
            <Flame className="w-4 h-4 text-pink-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-pink-900 text-xs md:text-sm">Post-Workout</h3>
            <p className="text-xs text-pink-700 truncate">{data.timing} (~{postTime})</p>
          </div>
          <div className="hidden sm:flex gap-1 md:gap-2 flex-shrink-0">
            <NutrientBadge icon={Flame} label="Carbs" value={`${data.totalCarbs}g`} color="orange" />
            <NutrientBadge icon={Zap} label="Protein" value={`${data.totalProtein}g`} color="purple" />
          </div>
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-pink-600 transition-transform flex-shrink-0", isExpanded && "rotate-180")}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-pink-200 p-2 md:p-3 space-y-2 bg-pink-50">
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
    <div className="bg-white rounded p-2 md:p-3 border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs md:text-sm text-slate-900">{item.product}</p>
          <p className="text-xs text-slate-600">
            <strong>{item.quantity}</strong> {item.unit}
          </p>
          {item.notes && <p className="text-xs text-slate-500 italic mt-1">{item.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-1 sm:gap-2">
          {item.carbs !== undefined && (
            <span className="text-xs font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded whitespace-nowrap">
              {item.carbs}g
            </span>
          )}
          {item.protein !== undefined && (
            <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded whitespace-nowrap">
              {item.protein}g
            </span>
          )}
          {item.sodium !== undefined && (
            <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded whitespace-nowrap">
              {item.sodium}mg
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
