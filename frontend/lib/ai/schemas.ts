import { z } from "zod"

export const macrosSchema = z.object({
  kcal: z.number().int().nonnegative(),
  protein_g: z.number().int().nonnegative(),
  carbs_g: z.number().int().nonnegative(),
  fat_g: z.number().int().nonnegative(),
})

export const ingredientSchema = z.object({
  name: z.string().min(1),
  qty: z.union([z.number().nonnegative(), z.string().min(1)]),
  unit: z.string().min(1),
  notes: z.string().optional(),
})

export const recipeSchema = z
  .object({
    steps: z.array(z.string().min(1)).optional(),
    url: z.string().url().optional(),
    prep_time: z.string().optional(),
  })
  .optional()

export const mealPlanSchema = z.object({
  slot: z.number().int().nonnegative(),
  name: z.string().min(1),
  time: z.string().optional().nullable(),
  macros: macrosSchema,
  ingredients: z.array(ingredientSchema),
  recipe: recipeSchema,
})

export const dayPlanSchema = z.object({
  date: z.string().min(1),
  meals: z.array(mealPlanSchema),
  totals: macrosSchema,
})

export const weeklyPlanSchema = z.object({
  week_start: z.string().min(1),
  week_end: z.string().min(1),
  days: z.array(dayPlanSchema),
})

export const editResponseSchema = z.object({
  updatedWeekPlan: weeklyPlanSchema,
  diff: z.record(z.unknown()),
  warnings: z.array(z.string()).default([]),
})

export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>
export type DayPlan = z.infer<typeof dayPlanSchema>
export type MealPlan = z.infer<typeof mealPlanSchema>
export type EditResponse = z.infer<typeof editResponseSchema>
