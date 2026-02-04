"use client"

import { useRef, useCallback, memo, useState } from "react"
import { format } from "date-fns"
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type DragCancelEvent,
  type DragMoveEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core"
import type { ScheduleItem } from "@/components/dashboard/schedule/types"
import { ScheduleBlock } from "@/components/dashboard/schedule/schedule-block"
import { DEFAULT_END_HOUR, DEFAULT_START_HOUR, HOUR_HEIGHT, timeToMinutes, minutesToTime, calculateOverlapPositions } from "@/components/dashboard/schedule/utils"

interface WeeklyTimeGridProps {
  days: Date[]
  items: ScheduleItem[]
  startHour?: number
  endHour?: number
  onSelectItem?: (item: ScheduleItem) => void
  onDragEnd?: (item: ScheduleItem, newDate: string, newStartTime: string) => void
}

const SNAP_MINUTES = 15

type HoveredSlot = {
  dayIndex: number
  top: number
  height: number
}

// Memoized day column to prevent re-renders
const DayColumn = memo(function DayColumn({
  day,
  items,
  hours,
  startHour,
  endHour,
  onSelectItem,
  highlight,
}: {
  day: Date
  items: ScheduleItem[]
  hours: number[]
  startHour: number
  endHour: number
  onSelectItem?: (item: ScheduleItem) => void
  highlight?: HoveredSlot | null
}) {
  const dateKey = format(day, "yyyy-MM-dd")
  const dayItems = items.filter((item) => item.date === dateKey)
  const gridHeight = hours.length * HOUR_HEIGHT
  
  // Calculate overlap positions for items in this day
  const itemsWithPositions = calculateOverlapPositions(dayItems, startHour, endHour, HOUR_HEIGHT)

  return (
    <div className="relative border-l border-border/30 first:border-l-0" style={{ height: gridHeight }}>
      {highlight ? (
        <div
          className="absolute inset-x-0 bg-blue-100/50 border border-blue-300/70 pointer-events-none rounded-md"
          style={{ top: highlight.top, height: highlight.height }}
        />
      ) : null}
      {hours.map((hour) => (
        <div
          key={`${dateKey}-${hour}`}
          className="border-b border-border/20 last:border-b-0"
          style={{ height: HOUR_HEIGHT }}
        />
      ))}
      {itemsWithPositions.map(({ item, columnIndex, totalColumns, top, height }) => (
        <ScheduleBlock
          key={item.id}
          item={item}
          onSelect={onSelectItem}
          columnIndex={columnIndex}
          totalColumns={totalColumns}
          style={{ top, height }}
        />
      ))}
    </div>
  )
})

export function WeeklyTimeGrid({
  days,
  items,
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
  onSelectItem,
  onDragEnd,
}: WeeklyTimeGridProps) {
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
  const gridRef = useRef<HTMLDivElement>(null)
  const [activeItem, setActiveItem] = useState<ScheduleItem | null>(null)
  const [hoveredSlot, setHoveredSlot] = useState<HoveredSlot | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  // Optimized sensors for smooth dragging
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3, // Lower distance for faster activation
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Lower delay for faster response
        tolerance: 3,
      },
    })
  )

  const getDragPosition = useCallback((event: DragEndEvent | DragMoveEvent) => {
    if (!gridRef.current) return null

    const gridRect = gridRef.current.getBoundingClientRect()
    const timeColumnWidth = 50
    const dayColumnWidth = (gridRect.width - timeColumnWidth) / 7
    
    // Get header height dynamically
    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 60

    // Use the pointer position from the activator event adjusted by delta
    const activator = event.activatorEvent as PointerEvent
    const clientX = activator.clientX + event.delta.x
    const clientY = activator.clientY + event.delta.y

    const relativeX = clientX - gridRect.left - timeColumnWidth
    const relativeY = clientY - gridRect.top - headerHeight

    const dayIndex = Math.floor(relativeX / dayColumnWidth)
    if (dayIndex < 0 || dayIndex >= 7) return null

    const minutesFromTop = (relativeY / HOUR_HEIGHT) * 60
    const totalMinutes = startHour * 60 + minutesFromTop

    const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
    const clampedMinutes = Math.max(startHour * 60, Math.min(endHour * 60 - SNAP_MINUTES, snappedMinutes))

    const newDate = format(days[dayIndex], "yyyy-MM-dd")
    const newStartTime = minutesToTime(clampedMinutes)

    return { dayIndex, newDate, newStartTime, clampedMinutes }
  }, [days, startHour, endHour])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = event.active.data.current as ScheduleItem
    if (item) {
      console.log(`[DragStart] ${item.type}: ${item.title}`)
      setActiveItem(item)
    }
  }, [])

  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const position = getDragPosition(event)
    const item = activeItem
    if (!position || !item) {
      setHoveredSlot(null)
      return
    }

    const durationMinutes = Math.max(timeToMinutes(item.endTime) - timeToMinutes(item.startTime), SNAP_MINUTES)
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24)
    const top = ((position.clampedMinutes - startHour * 60) / 60) * HOUR_HEIGHT

    setHoveredSlot({
      dayIndex: position.dayIndex,
      top,
      height,
    })
  }, [activeItem, getDragPosition, startHour])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const position = getDragPosition(event)
    const item = event.active.data.current as ScheduleItem
    
    // Always clear active item first for smooth UI
    setActiveItem(null)
    setHoveredSlot(null)
    
    if (position && item) {
      console.log(`[DragEnd] ${item.type}: ${item.title} -> ${position.newDate} ${position.newStartTime}`)
    }
    
    if (!position || !item) return

    onDragEnd?.(item, position.newDate, position.newStartTime)
  }, [getDragPosition, onDragEnd])

  const handleDragCancel = useCallback((event: DragCancelEvent) => {
    setActiveItem(null)
    setHoveredSlot(null)
  }, [])

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div ref={headerRef} className="grid grid-cols-[50px_repeat(7,minmax(0,1fr))] border-b border-border/60 bg-muted/30">
          <div />
          {days.map((day) => (
            <div key={day.toISOString()} className="px-1 py-2 text-center border-l border-border/30 first:border-l-0">
              <div className="text-sm font-semibold text-foreground">{format(day, "EEE")}</div>
              <div className="text-xs text-muted-foreground">{format(day, "MMM d")}</div>
            </div>
          ))}
        </div>
        <div ref={gridRef} className="grid grid-cols-[50px_repeat(7,minmax(0,1fr))]">
          <div className="border-r border-border/50 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="px-1.5 text-[11px] text-muted-foreground/80 flex items-start justify-end pt-0.5 border-b border-border/20 last:border-b-0"
                style={{ height: HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day, index) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              items={items}
              hours={hours}
              startHour={startHour}
              endHour={endHour}
              onSelectItem={onSelectItem}
              highlight={hoveredSlot && hoveredSlot.dayIndex === index ? hoveredSlot : null}
            />
          ))}
        </div>
      </div>
      
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="opacity-90 scale-105 shadow-xl ring-2 ring-blue-400 rounded-md overflow-hidden will-change-transform">
            <ScheduleBlock 
              item={activeItem} 
              style={{ position: 'relative', top: 0, height: activeItem.type === 'workout' ? 80 : 60 }} 
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
