"use client"

import { useState } from "react"
import { ChevronDown, Flame, Droplet, Zap, Clock, Lock, Edit2, Save, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface WorkoutNutritionCardProps {
  recordId?: string
  recommendation: string
  workoutType?: string
  duration?: number
  startTime?: string
  onSave?: (updates: Record<string, unknown>) => Promise<void>
  onLock?: (locked: boolean) => Promise<void>
  isEditable?: boolean
  locked?: boolean
}

export function WorkoutNutritionCard({
  recordId,
  recommendation,
  workoutType,
  duration,
  startTime,
  onSave,
  onLock,
  isEditable = true,
  locked = false,
}: WorkoutNutritionCardProps) {
  const { toast } = useToast()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(recommendation)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!onSave) return

    setIsSaving(true)
    try {
      await onSave({ during_workout_recommendation: editedText })
      toast({
        title: "Success",
        description: "Nutrition recommendation updated",
      })
      setIsEditing(false)
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

  const handleLock = async () => {
    if (!onLock) return
    try {
      await onLock(!locked)
      toast({
        title: "Success",
        description: `Nutrition ${!locked ? "locked" : "unlocked"}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lock status",
        variant: "destructive",
      })
    }
  }

  // Parse key metrics from recommendation text
  const carbsMatch = recommendation.match(/(\d+(?:\-\d+)?)\s*g.*?carb/i)
  const carbsValue = carbsMatch ? carbsMatch[1] : undefined

  const hydrationMatch = recommendation.match(/(\d+(?:\-\d+)?)\s*m?l.*?(?:hour|hydration|water)/i)
  const hydrationValue = hydrationMatch ? hydrationMatch[1] : undefined

  const electrolyteMatch = recommendation.match(/(\d+(?:\-\d+)?)\s*m?g.*?(?:electrolyte|sodium)/i)
  const electrolyteValue = electrolyteMatch ? electrolyteMatch[1] : undefined

  const timingMatch = recommendation.match(/(?:start|every|at)\s+(\d+)\s*(?:min|minute)/i)
  const timingValue = timingMatch ? timingMatch[1] : undefined

  return (
    <div className={cn(
      "rounded-lg border transition-all",
      isExpanded 
        ? "bg-emerald-50 border-emerald-300/50 shadow-md"
        : "bg-white border-emerald-200/50 hover:border-emerald-300/70"
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-emerald-50/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Flame className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-emerald-900">During Workout Nutrition</h3>
            <p className="text-xs text-emerald-700 mt-0.5">
              {workoutType && `${workoutType}`}
              {duration && ` • ${duration} min`}
              {startTime && ` • ${startTime}`}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-emerald-600 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Summary Grid - Always Visible */}
      {!isExpanded && (
        <div className="px-4 pb-3 grid grid-cols-3 gap-2">
          {carbsValue && (
            <div className="bg-orange-50 rounded p-2 border border-orange-200/50">
              <div className="text-xs text-orange-700 font-medium">Carbs</div>
              <div className="text-sm font-bold text-orange-900">{carbsValue}g</div>
            </div>
          )}
          {hydrationValue && (
            <div className="bg-blue-50 rounded p-2 border border-blue-200/50">
              <div className="text-xs text-blue-700 font-medium">Hydration</div>
              <div className="text-sm font-bold text-blue-900">{hydrationValue}ml</div>
            </div>
          )}
          {timingValue && (
            <div className="bg-purple-50 rounded p-2 border border-purple-200/50">
              <div className="text-xs text-purple-700 font-medium">Timing</div>
              <div className="text-sm font-bold text-purple-900">Every {timingValue}m</div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-emerald-200/50 p-4 space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {carbsValue && (
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200/50">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-orange-700">Carbs</span>
                </div>
                <div className="text-lg font-bold text-orange-900">{carbsValue}g</div>
              </div>
            )}
            {hydrationValue && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200/50">
                <div className="flex items-center gap-2 mb-1">
                  <Droplet className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700">Hydration</span>
                </div>
                <div className="text-lg font-bold text-blue-900">{hydrationValue}ml</div>
              </div>
            )}
            {electrolyteValue && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200/50">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700">Electrolytes</span>
                </div>
                <div className="text-lg font-bold text-purple-900">{electrolyteValue}mg</div>
              </div>
            )}
            {timingValue && (
              <div className="bg-pink-50 rounded-lg p-3 border border-pink-200/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-pink-600" />
                  <span className="text-xs font-semibold text-pink-700">Timing</span>
                </div>
                <div className="text-lg font-bold text-pink-900">Every {timingValue}m</div>
              </div>
            )}
          </div>

          {/* Full Recommendation */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full p-3 rounded border border-emerald-300 bg-white text-sm text-emerald-900 font-medium leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none min-h-24"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button
                  onClick={() => {
                    setEditedText(recommendation)
                    setIsEditing(false)
                  }}
                  disabled={isSaving}
                  size="sm"
                  variant="outline"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-3 border border-emerald-200/50">
              <p className="text-sm text-emerald-900 font-medium leading-relaxed whitespace-pre-wrap">
                {recommendation}
              </p>
            </div>
          )}

          {/* Actions */}
          {isEditable && (
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setIsEditing(!isEditing)}
                disabled={isEditing || isSaving || locked}
                size="sm"
                variant="outline"
                className="text-emerald-600 hover:bg-emerald-50"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" />
                Edit
              </Button>
              <Button
                onClick={handleLock}
                size="sm"
                variant="outline"
                className={cn(
                  "transition-colors",
                  locked
                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                    : "text-emerald-600 hover:bg-emerald-50"
                )}
              >
                <Lock className="w-3.5 h-3.5 mr-1" />
                {locked ? "Locked" : "Lock"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
