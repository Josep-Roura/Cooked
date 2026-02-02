"use client"

import type { CSSProperties } from "react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"

interface ScheduleBlockProps {
  item: ScheduleItem
  style: CSSProperties
  onSelect?: (item: ScheduleItem) => void
}

const typeStyles: Record<ScheduleItem["type"], string> = {
  meal: "bg-emerald-50/80 border-emerald-200/60 text-emerald-900 hover:bg-emerald-100/80",
  workout: "bg-blue-50/80 border-blue-200/60 text-blue-900 hover:bg-blue-100/80",
  event: "bg-amber-50/80 border-amber-200/60 text-amber-900 hover:bg-amber-100/80",
  nutrition_pre: "bg-emerald-100/60 border-emerald-200/50 text-emerald-800 hover:bg-emerald-200/60",
  nutrition_during: "bg-emerald-200/60 border-emerald-300/50 text-emerald-800 hover:bg-emerald-300/60",
  nutrition_post: "bg-emerald-100/60 border-emerald-200/50 text-emerald-800 hover:bg-emerald-200/60",
}

export function ScheduleBlock({ item, style, onSelect }: ScheduleBlockProps) {
  const isCompact = item.type.startsWith("nutrition_")
  const isWorkout = item.type === "workout"
  const isLocked = item.locked === true
  const isDraggable = (item.source?.type === "meal" || item.source?.type === "workout") && !isLocked

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: !isDraggable,
  })

  const timeRange = `${item.startTime}–${item.endTime}`

  const dragStyle: CSSProperties = transform
    ? {
        ...style,
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
        opacity: 0.9,
      }
    : style

  const handleClick = () => {
    // Prevent click when dragging
    if (!isDragging) {
      onSelect?.(item)
    }
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={handleClick}
      style={dragStyle}
      className={cn(
        "absolute inset-x-1 rounded-md border text-left shadow-sm transition-all duration-200 overflow-hidden",
        "hover:shadow-md hover:scale-[1.02] hover:z-10",
        typeStyles[item.type],
        item.timeUnknown ? "border-dashed opacity-80" : "",
        isCompact ? "px-1.5 py-1" : "px-2 py-1.5",
        isDragging && "ring-2 ring-blue-400 shadow-lg",
        isLocked && "cursor-not-allowed opacity-90",
        isDraggable && "cursor-grab active:cursor-grabbing",
      )}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      {/* Locked indicator */}
      {isLocked && (
        <div className="absolute top-0.5 right-0.5">
          <svg className="w-3 h-3 text-current opacity-50" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Header: Emoji + Title + Time */}
      <div className="flex items-center gap-1 min-w-0">
        <span className={cn(
          "shrink-0 leading-none",
          isCompact ? "text-sm" : "text-base",
          isWorkout && "text-lg"
        )}>
          {item.emoji ?? "•"}
        </span>
        <span className={cn(
          "font-medium truncate leading-tight flex-1 min-w-0",
          isCompact ? "text-[11px]" : "text-xs",
          isWorkout && "text-sm font-semibold"
        )}>
          {item.title}
        </span>
      </div>
      
      {/* Info: Time range and kcal */}
      <div className={cn(
        "flex items-center gap-1.5 mt-0.5",
        isCompact ? "text-[10px]" : "text-[11px]"
      )}>
        <span className="text-muted-foreground/70 whitespace-nowrap">
          {timeRange}
        </span>
        {item.kcal ? (
          <span className="text-muted-foreground/90 font-medium">
            · {item.kcal} kcal
          </span>
        ) : null}
        {item.detail && !item.kcal ? (
          <span className="text-muted-foreground/70">
            · {item.detail}
          </span>
        ) : null}
      </div>
    </button>
  )
}
