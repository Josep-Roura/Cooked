"use client"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { TrainingType } from "@/lib/db/types"

interface WeeklyHistoryProps {
  weeklyData: {
    totalDurationMinutes: number
    totalCalories: number
    days: Array<{
      date: string
      label: string
      displayLabel: string
      totalsByType: Record<TrainingType, number>
      totalMinutes: number
      isToday: boolean
    }>
  }
}

const typeColors: Record<TrainingType | "other", string> = {
  swim: "bg-cyan-500",
  bike: "bg-orange-500",
  run: "bg-green-500",
  strength: "bg-purple-500",
  rest: "bg-gray-400",
  other: "bg-gray-400",
}

const typeLabels: Record<TrainingType | "other", string> = {
  swim: "Swim",
  bike: "Bike",
  run: "Run",
  strength: "Strength",
  rest: "Rest",
  other: "Other",
}

const typeOrder: TrainingType[] = ["swim", "bike", "run", "strength", "rest", "other"]

function formatDurationMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) return "0m"
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export function WeeklyHistory({ weeklyData }: WeeklyHistoryProps) {
  const maxDuration = Math.max(...weeklyData.days.map((day) => day.totalMinutes), 1)

  return (
    <TooltipProvider>
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-900">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Weekly Training History</h3>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-slate-600">Total duration: </span>
              <span className="font-semibold text-slate-900">
                {formatDurationMinutes(weeklyData.totalDurationMinutes)}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Calories burned: </span>
              <span className="font-semibold text-slate-900">{weeklyData.totalCalories.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-3 h-48 mb-4">
          {weeklyData.days.map((day) => {
            const dayHeight = day.totalMinutes > 0 ? (day.totalMinutes / maxDuration) * 100 : 4
            const tooltipEntries = typeOrder
              .map((type) => ({ type, value: day.totalsByType[type] ?? 0 }))
              .filter((entry) => entry.value > 0)

            return (
              <Tooltip key={day.date}>
                <TooltipTrigger asChild>
                  <div
                    className={`flex-1 flex flex-col items-center gap-2 rounded-xl px-1 pb-2 ${
                      day.isToday ? "border-2 border-emerald-500/70 bg-emerald-500/5" : "border border-transparent"
                    }`}
                  >
                    <div className="w-full relative h-40 flex items-end justify-center">
                      <div className="w-full max-w-12 h-full rounded-lg bg-muted/30 flex flex-col-reverse overflow-hidden">
                        <div
                          className="w-full flex flex-col-reverse"
                          style={{ height: `${Math.max(dayHeight, 6)}%` }}
                        >
                          {tooltipEntries.length === 0 ? (
                            <div className="w-full bg-muted" style={{ height: "100%" }} />
                          ) : (
                            tooltipEntries.map((entry, index) => {
                              const height = day.totalMinutes > 0 ? (entry.value / day.totalMinutes) * 100 : 0
                              const isTop = index === tooltipEntries.length - 1
                              return (
                                <div
                                  key={entry.type}
                                  className={`w-full ${typeColors[entry.type] || "bg-gray-400"} ${
                                    isTop ? "rounded-t-lg" : ""
                                  }`}
                                  style={{ height: `${height}%` }}
                                />
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={`text-xs ${day.isToday ? "font-bold text-emerald-600" : "text-slate-600"}`}>
                        {day.label}
                      </span>
                      {day.totalMinutes > 0 && (
                        <p className="text-xs text-slate-600">{formatDurationMinutes(day.totalMinutes)}</p>
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs bg-white border border-slate-200 text-slate-900">
                  <div className="text-xs font-semibold text-slate-900">{day.displayLabel}</div>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {tooltipEntries.length === 0 ? (
                      <p>No sessions</p>
                    ) : (
                      tooltipEntries.map((entry) => (
                        <div key={entry.type} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${typeColors[entry.type]}`} />
                            {typeLabels[entry.type] ?? entry.type}
                          </span>
                          <span className="text-slate-900">{formatDurationMinutes(entry.value)}</span>
                        </div>
                      ))
                    )}
                    {day.totalMinutes > 0 && (
                      <div className="flex items-center justify-between border-t border-slate-200 pt-1 mt-1 text-slate-900">
                        <span>Total</span>
                        <span>{formatDurationMinutes(day.totalMinutes)}</span>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-slate-200">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${color}`} />
              <span className="text-xs text-slate-600 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}
