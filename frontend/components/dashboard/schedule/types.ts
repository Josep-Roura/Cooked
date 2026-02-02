import type { NutritionMeal, PlanWeekMeal, TpWorkout, UserEvent } from "@/lib/db/types"

export type ScheduleItemType =
  | "meal"
  | "workout"
  | "event"
  | "nutrition_pre"
  | "nutrition_during"
  | "nutrition_post"

export interface ScheduleItem {
  id: string
  type: ScheduleItemType
  date: string
  startTime: string
  endTime: string
  title: string
  emoji?: string | null
  kcal?: number | null
  macros?: {
    protein_g?: number | null
    carbs_g?: number | null
    fat_g?: number | null
  } | null
  detail?: string | null
  timeUnknown?: boolean
  locked?: boolean
  meta?: {
    meal?: PlanWeekMeal | NutritionMeal
    workout?: TpWorkout
    event?: UserEvent
  }
}
