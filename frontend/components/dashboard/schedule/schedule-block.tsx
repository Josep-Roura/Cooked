"use client"

import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import { formatTimeRange } from "@/components/dashboard/schedule/utils"

interface ScheduleBlockProps {
  item: ScheduleItem
  style: CSSProperties
  onSelect?: (item: ScheduleItem) => void
}

const typeStyles: Record<ScheduleItem["type"], string> = {
  meal: "bg-emerald-50 border-emerald-200/70 text-emerald-900",
  workout: "bg-blue-50 border-blue-200/70 text-blue-900",
  event: "bg-amber-50 border-amber-200/70 text-amber-900",
  nutrition_pre: "bg-emerald-100 border-emerald-200/80 text-emerald-900",
  nutrition_during: "bg-emerald-200 border-emerald-300 text-emerald-900",
  nutrition_post: "bg-emerald-100 border-emerald-200/80 text-emerald-900",
}

export function ScheduleBlock({ item, style, onSelect }: ScheduleBlockProps) {
  const macros = item.macros
    ? [
        item.macros.protein_g ? `P ${item.macros.protein_g}g` : null,
        item.macros.carbs_g ? `C ${item.macros.carbs_g}g` : null,
        item.macros.fat_g ? `F ${item.macros.fat_g}g` : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null

  const isCompact = item.type.startsWith("nutrition_")
  const timeLabel = formatTimeRange(item.startTime, item.endTime, item.timeUnknown)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      style={style}
      className={cn(
        "absolute left-2 right-2 rounded-lg border px-2 py-2 text-left shadow-sm transition hover:shadow-md",
        typeStyles[item.type],
        item.timeUnknown ? "border-dashed" : "",
        isCompact ? "text-[10px] leading-tight" : "text-xs",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={cn("text-sm", isCompact && "text-xs")}>{item.emoji ?? "•"}</span>
          <span className="font-semibold truncate">
            {item.title}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeLabel}</span>
      </div>
      {item.kcal ? (
        <div className={cn("mt-1 text-[10px] text-muted-foreground", isCompact && "text-[9px]")}
        >
          {item.kcal} kcal{macros ? ` · ${macros}` : ""}
        </div>
      ) : null}
      {item.detail && !item.kcal ? (
        <div className={cn("mt-1 text-[10px] text-muted-foreground", isCompact && "text-[9px]")}
        >
          {item.detail}
        </div>
      ) : null}
    </button>
  )
}
