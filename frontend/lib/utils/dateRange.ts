export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function parseIsoDate(value: string) {
  if (!ISO_DATE_REGEX.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

export function buildDateRange(start: string, end: string, maxDays: number) {
  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  if (!startDate || !endDate) return null
  if (start > end) return null
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (days < 1 || days > maxDays) return null
  return { startDate, endDate, days }
}
