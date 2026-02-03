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
  // Google Calendar style: subtle backgrounds with stronger borders
  meal: "bg-emerald-50 border-l-4 border-emerald-500 text-emerald-900 hover:bg-emerald-100/50",
  workout: "bg-blue-50 border-l-4 border-blue-600 text-blue-900 hover:bg-blue-100/50",
  event: "bg-orange-50 border-l-4 border-orange-500 text-orange-900 hover:bg-orange-100/50",
  nutrition_pre: "bg-emerald-50 border-l-4 border-emerald-400 text-emerald-800 hover:bg-emerald-100/50",
  nutrition_during: "bg-emerald-100 border-l-4 border-emerald-500 text-emerald-800 hover:bg-emerald-100/70",
  nutrition_post: "bg-emerald-50 border-l-4 border-emerald-400 text-emerald-800 hover:bg-emerald-100/50",
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
        "absolute inset-x-1 rounded-sm border-0 text-left shadow-sm transition-all duration-200 overflow-hidden",
        "hover:shadow-md hover:z-10",
        typeStyles[item.type],
        item.timeUnknown ? "opacity-70" : "",
        isCompact ? "px-2 py-1" : "px-2 py-2",
        isDragging && "ring-2 ring-blue-500 shadow-lg",
        isLocked && "cursor-not-allowed opacity-75",
        isDraggable && "cursor-grab active:cursor-grabbing",
      )}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
    >
      {/* Locked indicator */}
      {isLocked && (
        <div className="absolute top-1 right-1">
          <svg className="w-3 h-3 text-current opacity-40" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Header: Emoji + Title */}
      <div className="flex items-center gap-1.5 min-w-0 mb-1">
        <span className={cn(
          "shrink-0 leading-none",
          isCompact ? "text-xs" : "text-sm",
          isWorkout && "text-base"
        )}>
          {item.emoji ?? "•"}
        </span>
        <span className={cn(
          "font-semibold truncate leading-tight flex-1 min-w-0",
          isCompact ? "text-xs" : "text-sm",
          isWorkout && "text-sm"
        )}>
          {item.title}
        </span>
      </div>
      
      {/* Info: Time range and kcal */}
      <div className={cn(
        "flex items-center gap-1 text-[11px] leading-tight",
        "text-current opacity-70"
      )}>
        <span className="whitespace-nowrap font-medium">
          {timeRange}
        </span>
        {item.kcal ? (
          <span className="whitespace-nowrap">
            • {item.kcal} kcal
          </span>
        ) : null}
      </div>
    </button>
  )
}
