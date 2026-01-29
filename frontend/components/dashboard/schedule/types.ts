export type ScheduleItemType =
  | "meal"
  | "workout"
  | "event"
  | "nutrition_pre"
  | "nutrition_during"
  | "nutrition_post"

export type ScheduleItem = {
  id: string
  type: ScheduleItemType
  date: string
  startTime: string
  endTime: string
  title: string
  emoji?: string | null
  kcal?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  meta?: Record<string, unknown>
}
