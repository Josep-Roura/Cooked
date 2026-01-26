import { z } from "zod"

export const macrosSchema = z.object({
  kcal: z.number().int().nonnegative(),
  protein_g: z.number().int().nonnegative(),
  carbs_g: z.number().int().nonnegative(),
  fat_g: z.number().int().nonnegative(),
})

export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.union([z.number().nonnegative(), z.string().min(1)]),
  unit: z.string().min(1),
})

export const mealSchema = z.object({
  slot: z.number().int().min(1),
  name: z.string().min(1),
  time: z.string().optional().nullable(),
  ingredients: z.array(ingredientSchema),
  macros: macrosSchema,
  notes: z.string().optional().nullable(),
})

export const dayPlanSchema = z.object({
  date: z.string().min(1),
  day_type: z.string().min(1),
  macros: macrosSchema,
  meals: z.array(mealSchema),
})

export const weekPlanSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
  days: z.array(dayPlanSchema),
})

export const editResponseSchema = z.object({
  updatedPlan: weekPlanSchema,
  diff: z.record(z.unknown()),
  warnings: z.array(z.string()).default([]),
})

export type WeekPlan = z.infer<typeof weekPlanSchema>
export type DayPlan = z.infer<typeof dayPlanSchema>
export type MealPlan = z.infer<typeof mealSchema>
export type EditResponse = z.infer<typeof editResponseSchema>
