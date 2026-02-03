"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, BellOff, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  requestNotificationPermission,
  scheduleNutritionReminders,
  calculateRemindersFromPlan,
  formatReminder,
  type NutritionReminder,
} from "@/lib/nutrition/reminders"

interface NutritionRemindersProps {
  plan: any
  workoutDuration: number
  workoutStartTime: string
  enabled?: boolean
  onStatusChange?: (enabled: boolean) => void
}

export function NutritionReminders({
  plan,
  workoutDuration,
  workoutStartTime,
  enabled: initialEnabled = false,
  onStatusChange,
}: NutritionRemindersProps) {
  const { toast } = useToast()
  const [remindersEnabled, setRemindersEnabled] = useState(initialEnabled)
  const [reminders, setReminders] = useState<NutritionReminder[]>([])
  const [isRequesting, setIsRequesting] = useState(false)
  const cancelRemindersRef = useRef<(() => void) | null>(null)

  // Calculate reminders from plan
  useEffect(() => {
    const calculated = calculateRemindersFromPlan(plan, workoutStartTime, workoutDuration)
    setReminders(calculated)
  }, [plan, workoutStartTime, workoutDuration])

  // Handle enabling reminders
  const handleToggleReminders = async () => {
    if (remindersEnabled) {
      // Disable reminders
      cancelRemindersRef.current?.()
      setRemindersEnabled(false)
      onStatusChange?.(false)
      toast({ title: "Reminders disabled" })
      return
    }

    // Enable reminders
    setIsRequesting(true)
    try {
      const permitted = await requestNotificationPermission()

      if (!permitted) {
        toast({
          title: "Permission denied",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        })
        setIsRequesting(false)
        return
      }

      // Schedule the reminders
      const { reminders: scheduled, cancel } = scheduleNutritionReminders(reminders, (reminder) => {
        toast({
          title: "Time to consume nutrition",
          description: `${reminder.product} (${reminder.quantity}${reminder.unit})`,
        })
      })

      cancelRemindersRef.current = cancel
      setReminders(scheduled)
      setRemindersEnabled(true)
      onStatusChange?.(true)

      toast({
        title: "Reminders enabled",
        description: `${scheduled.length} reminders scheduled`,
      })
    } catch (error) {
      console.error("Failed to enable reminders:", error)
      toast({
        title: "Error",
        description: "Failed to enable reminders",
        variant: "destructive",
      })
    } finally {
      setIsRequesting(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRemindersRef.current?.()
    }
  }, [])

  if (reminders.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-sm text-blue-900">
          <Clock className="w-4 h-4" />
          Nutrition Reminders
        </h3>
        <Button
          onClick={handleToggleReminders}
          disabled={isRequesting}
          size="sm"
          variant={remindersEnabled ? "default" : "outline"}
          className={cn(
            "gap-2 text-xs",
            remindersEnabled && "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          {remindersEnabled ? (
            <>
              <Bell className="w-3 h-3" />
              On
            </>
          ) : (
            <>
              <BellOff className="w-3 h-3" />
              Off
            </>
          )}
        </Button>
      </div>

      {/* Reminders List */}
      <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className={cn(
              "flex items-start gap-2 px-2 py-1.5 rounded bg-white border text-xs",
              reminder.scheduled
                ? "border-blue-200 text-blue-700"
                : "border-slate-200 text-slate-600"
            )}
          >
            <span className="font-mono font-semibold w-12 flex-shrink-0">{reminder.time}</span>
            <span className="flex-1 min-w-0">
              <span className="font-semibold">{reminder.product}</span>
              <span className="text-slate-500"> ({reminder.quantity}{reminder.unit})</span>
            </span>
          </div>
        ))}
      </div>

      {/* Info */}
      <p className="text-xs text-blue-700">
        {remindersEnabled
          ? `${reminders.length} reminders scheduled - you'll get a notification at each time`
          : "Enable reminders to get browser notifications at nutrition times"}
      </p>
    </div>
  )
}
