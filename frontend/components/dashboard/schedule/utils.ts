export const DEFAULT_START_HOUR = 6
export const DEFAULT_END_HOUR = 22

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return DEFAULT_START_HOUR * 60
  return hours * 60 + minutes
}

export function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function clampMinutes(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
