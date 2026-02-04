export const DEFAULT_START_HOUR = 5
export const DEFAULT_END_HOUR = 23
export const HOUR_HEIGHT = 56

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map((value) => Number(value))
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.max(totalMinutes % 60, 0)
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function addMinutesToTime(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes)
}

export function normalizeTime(time: string | null | undefined, fallback: string) {
  if (time && /^\d{1,2}:\d{2}$/.test(time)) {
    return { time, isUnknown: false }
  }
  return { time: fallback, isUnknown: true }
}

export function getMealFallbackTime(slot: number) {
  const slots: Record<number, string> = {
    1: "07:30",
    2: "10:00",
    3: "13:00",
    4: "16:00",
    5: "19:00",
    6: "21:00",
  }
  return slots[slot] ?? "12:00"
}

export function getMealDurationMinutes(kcal: number | null | undefined) {
  // All meals last 1 hour (60 minutes) for consistent scheduling
  return 60
}

export function getWorkoutDurationMinutes(hours: number | null | undefined) {
  if (!hours || hours <= 0) return 60
  return Math.max(30, Math.round(hours * 60))
}

export function formatTimeRange(start: string, end: string, timeUnknown?: boolean) {
  if (timeUnknown) return "Time unknown"
  return `${start}–${end}`
}

// Overlap detection and positioning (Google Calendar style)
import type { ScheduleItem } from "./types"

export interface ScheduleItemWithPosition {
  item: ScheduleItem
  columnIndex: number
  totalColumns: number
  top: number
  height: number
}

function itemsOverlap(item1: ScheduleItem, item2: ScheduleItem): boolean {
  const start1 = timeToMinutes(item1.startTime)
  const end1 = timeToMinutes(item1.endTime)
  const start2 = timeToMinutes(item2.startTime)
  const end2 = timeToMinutes(item2.endTime)

  return start1 < end2 && start2 < end1
}

export function calculateOverlapPositions(
  dayItems: ScheduleItem[],
  startHour: number,
  endHour: number,
  hourHeight: number
): ScheduleItemWithPosition[] {
  if (dayItems.length === 0) return []

  // Sort items by start time
  const sorted = [...dayItems].sort((a, b) => 
    timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  )

  // Create groups of overlapping events
  const groups: ScheduleItem[][] = []
  
  sorted.forEach((item) => {
    let addedToGroup = false
    
    for (const group of groups) {
      // Check if item overlaps with any item in the group
      const overlaps = group.some(groupItem => 
        itemsOverlap(item, groupItem)
      )
      
      if (overlaps) {
        group.push(item)
        addedToGroup = true
        break
      }
    }
    
    if (!addedToGroup) {
      groups.push([item])
    }
  })

  // Calculate positions for each item
  const result: ScheduleItemWithPosition[] = []
  
  groups.forEach((group) => {
    // Re-sort group by start time
    const sortedGroup = [...group].sort((a, b) =>
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    )

    // Assign column positions
    sortedGroup.forEach((item, index) => {
      const startMinutes = timeToMinutes(item.startTime)
      const endMinutes = timeToMinutes(item.endTime)
      const clampedStart = Math.max(startMinutes, startHour * 60)
      const clampedEnd = Math.min(endMinutes, endHour * 60)
      const top = ((clampedStart - startHour * 60) / 60) * hourHeight
      const height = Math.max(((clampedEnd - clampedStart) / 60) * hourHeight, 32)

      result.push({
        item,
        columnIndex: index,
        totalColumns: sortedGroup.length,
        top,
        height,
      })
    })
  })

  return result
}
