"use client"

import type { ScheduleItem } from "@/components/dashboard/schedule/types"

const typeStyles: Record<ScheduleItem["type"], string> = {
  meal: "bg-emerald-100 text-emerald-900 border-emerald-200",
  workout: "bg-blue-100 text-blue-900 border-blue-200",
  event: "bg-amber-100 text-amber-900 border-amber-200",
  nutrition_pre: "bg-emerald-50 text-emerald-900 border-emerald-200",
  nutrition_during: "bg-emerald-200/60 text-emerald-900 border-emerald-200",
  nutrition_post: "bg-emerald-50 text-emerald-900 border-emerald-200",
}

interface ScheduleBlockProps {
  item: ScheduleItem
  top: number
  height: number
  onSelect?: (item: ScheduleItem) => void
}

export function ScheduleBlock({ item, top, height, onSelect }: ScheduleBlockProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect?.(item)
        }
      }}
      className={`absolute left-2 right-2 rounded-lg border px-2 py-1 text-[11px] leading-snug shadow-sm cursor-pointer ${typeStyles[item.type]}`}
      style={{ top, height }}
    >
      <div className="flex items-center gap-1 font-semibold">
        {item.emoji && <span>{item.emoji}</span>}
        <span className="truncate">{item.title}</span>
      </div>
      {(item.kcal ?? 0) > 0 && (
        <div className="text-[10px] opacity-80">
          {item.kcal} kcal · P{item.protein_g ?? 0} C{item.carbs_g ?? 0} F{item.fat_g ?? 0}
        </div>
      )}
    </div>
  )
}
