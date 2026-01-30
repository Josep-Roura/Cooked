export const DEFAULT_START_HOUR = 6
export const DEFAULT_END_HOUR = 22
export const HOUR_HEIGHT = 60

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
  if (!kcal) return 30
  if (kcal <= 300) return 20
  if (kcal >= 700) return 45
  return 30
}

export function getWorkoutDurationMinutes(hours: number | null | undefined) {
  if (!hours || hours <= 0) return 60
  return Math.max(30, Math.round(hours * 60))
}

export function formatTimeRange(start: string, end: string, timeUnknown?: boolean) {
  if (timeUnknown) return "Time unknown"
  return `${start}–${end}`
}
