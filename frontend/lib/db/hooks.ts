"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endOfWeek, format, startOfWeek } from "date-fns"
import type {
  CalendarEvent,
  DashboardOverviewData,
  DateRangeOption,
  GroceryItem,
  MacroSummary,
  Meal,
  MealLog,
  MealPrepSession,
  MealScheduleItem,
  MealPlanDay,
  MealPlanIngredient,
  MealPlanItem,
  PlanWeekMeal,
  PlanChatMessage,
  PlanChatThread,
  WeeklyNutritionDay,
  MacrosDaySummary,
  NutritionDaySummary,
  NutritionDayType,
  NutritionMacros,
  NutritionPlan,
  NutritionPlanRow,
  NutritionDayPlan,
  NutritionSummary,
  OnboardingProfileInput,
  PlanPreview,
  ProfileRow,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  TrainingIntensity,
  TrainingSessionSummary,
  TrainingSummary,
  TrainingType,
  TpWorkout,
  UpcomingEvent,
  UserEvent,
} from "@/lib/db/types"
import {
  fetchActivePlanByDate,
  fetchNutritionPlanRowsByPlanId,
  fetchNutritionPlanRowsByDateRange,
  fetchNutritionPlans,
  fetchProfile,
  getDateRange,
  upsertProfileFromOnboarding,
} from "@/lib/db/queries"
import { fetchWorkoutsByDateRange } from "@/lib/db/tpWorkouts"

const intensityThresholds = {
  low: 4,
  high: 7,
}
const DEFAULT_START_TIME = "07:00"

function mapWorkoutType(value: string | null): TrainingType {
  if (!value) return "other"
  const normalized = value.toLowerCase()
  if (normalized.includes("swim")) return "swim"
  if (normalized.includes("bike") || normalized.includes("cycle")) return "bike"
  if (normalized.includes("run")) return "run"
  if (normalized.includes("strength") || normalized.includes("gym")) return "strength"
  if (normalized.includes("rest")) return "rest"
  return "other"
}

function getWorkoutDurationHours(workout: TpWorkout): number {
  const actual = workout.actual_hours ?? null
  const planned = workout.planned_hours ?? null
  const type = mapWorkoutType(workout.workout_type)

  if (type === "strength" && actual === null && (planned === null || planned === 0)) {
    return 1
  }

  const hours = actual ?? planned ?? 0
  return hours > 0 ? hours : 0
}

function getWorkoutDurationMinutes(workout: TpWorkout): number {
  return Math.round(getWorkoutDurationHours(workout) * 60)
}

function mapIntensity(workout: TpWorkout): TrainingIntensity {
  const rpe = workout.rpe ?? null
  if (rpe !== null) {
    if (rpe >= intensityThresholds.high) return "high"
    if (rpe >= intensityThresholds.low) return "moderate"
    return "low"
  }

  const intensityFactor = workout.if ?? null
  if (intensityFactor !== null) {
    if (intensityFactor >= 0.85) return "high"
    if (intensityFactor >= 0.7) return "moderate"
    return "low"
  }

  return "moderate"
}

function normalizeStartTime(value: string | null | undefined) {
  if (!value) {
    return DEFAULT_START_TIME
  }
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) {
    return DEFAULT_START_TIME
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function calculateEndTime(startTime: string, durationHours: number) {
  const [hours, minutes] = startTime.split(":").map((part) => Number(part))
  const durationMinutes = durationHours > 0 ? Math.round(durationHours * 60) : 60
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const endMinutes = totalMinutes % 60
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`
}

function buildTrainingSessions(workouts: TpWorkout[]): TrainingSessionSummary[] {
  return workouts.map((workout) => {
    const durationMinutes = getWorkoutDurationMinutes(workout)
    const calories = Math.round(workout.tss ?? 0)

    return {
      id: String(workout.id),
      type: mapWorkoutType(workout.workout_type),
      title: workout.title ?? workout.workout_type ?? "Training session",
      durationMinutes,
      intensity: mapIntensity(workout),
      calories,
      completed: Boolean(workout.has_actual ?? workout.actual_hours),
      time: normalizeStartTime(workout.start_time),
      date: workout.workout_day,
      description: workout.description ?? workout.coach_comments ?? null,
    }
  })
}

function buildTrainingSummary(workouts: TpWorkout[]): TrainingSummary {
  const summaryByDay = new Map<string, { durationMinutes: number; calories: number; type: TrainingType; intensity: TrainingIntensity }>()

  workouts.forEach((workout) => {
    const dayLabel = format(new Date(workout.workout_day), "EEE")
    const durationMinutes = getWorkoutDurationMinutes(workout)
    const calories = Math.round(workout.tss ?? 0)
    const existing = summaryByDay.get(dayLabel)

    summaryByDay.set(dayLabel, {
      durationMinutes: (existing?.durationMinutes ?? 0) + durationMinutes,
      calories: (existing?.calories ?? 0) + calories,
      type: mapWorkoutType(workout.workout_type),
      intensity: mapIntensity(workout),
    })
  })

  const sessions = Array.from(summaryByDay.entries()).map(([day, data]) => ({
    day,
    type: data.type,
    durationMinutes: data.durationMinutes,
    intensity: data.intensity,
  }))

  return {
    totalDurationMinutes: workouts.reduce(
      (sum, workout) => sum + getWorkoutDurationMinutes(workout),
      0,
    ),
    totalCalories: workouts.reduce((sum, workout) => sum + Math.round(workout.tss ?? 0), 0),
    sessions,
  }
}

function buildCalendarEvents(workouts: TpWorkout[]): CalendarEvent[] {
  return workouts.map((workout) => {
    const type = mapWorkoutType(workout.workout_type)
    const durationHours = getWorkoutDurationHours(workout) || 1
    const startTime = normalizeStartTime(workout.start_time)
    const endTime = calculateEndTime(startTime, durationHours)

    const colorMap: Record<TrainingType, string> = {
      swim: "bg-cyan-400",
      bike: "bg-orange-500",
      run: "bg-green-500",
      strength: "bg-purple-500",
      rest: "bg-gray-400",
      other: "bg-gray-400",
    }

    return {
      id: String(workout.id),
      title: workout.title ?? workout.workout_type ?? "Training",
      type,
      startTime,
      endTime,
      date: workout.workout_day,
      color: colorMap[type],
      description: workout.description ?? workout.coach_comments ?? null,
    }
  })
}

type NutritionMetaEntry = {
  meals?: Meal[]
  macros?: NutritionMacros
  day_type?: NutritionDayType
  meals_per_day?: number
}

function parseNutritionMeta(meta: Record<string, unknown> | null | undefined): Record<string, NutritionMetaEntry> {
  if (!meta || typeof meta !== "object") {
    return {}
  }
  const raw = (meta as Record<string, unknown>)["nutrition_by_date"]
  if (!raw || typeof raw !== "object") {
    return {}
  }
  return raw as Record<string, NutritionMetaEntry>
}

function normalizeMealTime(value: string | undefined | null): string | null {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function buildNutritionEvents(
  rows: NutritionPlanRow[],
  profile: ProfileRow | null | undefined,
  range: DateRangeOption,
  now: Date,
): CalendarEvent[] {
  const { start, end } = getDateRange(range, now)
  const startKey = format(start, "yyyy-MM-dd")
  const endKey = format(end, "yyyy-MM-dd")
  const nutritionMeta = parseNutritionMeta(profile?.meta)
  const events: CalendarEvent[] = []
  const coveredDates = new Set<string>()
  const defaultMealsPerDay = profile?.meals_per_day ?? 3

  Object.entries(nutritionMeta).forEach(([date, entry]) => {
    if (date < startKey || date > endKey) return
    const meals = Array.isArray(entry.meals) ? entry.meals : []
    const dayMeals = meals.filter((meal) => Boolean(meal))
    if (dayMeals.length > 0) {
      dayMeals.forEach((meal) => {
        const startTime = normalizeMealTime(meal.time) ?? "12:00"
        events.push({
          id: `nutrition-${date}-${meal.slot}`,
          title: `Nutrition: ${meal.name}`,
          type: "nutrition",
          startTime,
          endTime: calculateEndTime(startTime, 0.75),
          date,
          color: "bg-green-500",
          description: `${meal.kcal} kcal`,
        })
      })
    } else {
      const mealsPerDay = entry.meals_per_day ?? defaultMealsPerDay
      events.push({
        id: `nutrition-${date}`,
        title: `Meal plan (${mealsPerDay} meals)`,
        type: "nutrition",
        startTime: "12:00",
        endTime: calculateEndTime("12:00", 0.5),
        date,
        color: "bg-green-500",
      })
    }
    coveredDates.add(date)
  })

  rows.forEach((row) => {
    if (row.date < startKey || row.date > endKey) return
    if (coveredDates.has(row.date)) return
    const mealsPerDay = defaultMealsPerDay
    events.push({
      id: `nutrition-${row.date}`,
      title: `Meal plan (${mealsPerDay} meals)`,
      type: "nutrition",
      startTime: "12:00",
      endTime: calculateEndTime("12:00", 0.5),
      date: row.date,
      color: "bg-green-500",
      description: `${row.kcal} kcal`,
    })
  })

  return events
}

function buildNutritionDailySummary(
  rows: NutritionPlanRow[],
  range: DateRangeOption,
  now: Date,
): NutritionDaySummary[] {
  const { start, end } = getDateRange(range, now)
  const days: NutritionDaySummary[] = []
  const dateCursor = new Date(start)

  while (dateCursor <= end) {
    const dateKey = format(dateCursor, "yyyy-MM-dd")
    const row = rows.find((item) => item.date === dateKey)
    const dayLabel = range === "month" ? format(dateCursor, "d") : format(dateCursor, "EEE")

    days.push({
      date: dateKey,
      dayLabel,
      kcal: row?.kcal ?? 0,
      protein_g: row?.protein_g ?? 0,
      carbs_g: row?.carbs_g ?? 0,
      fat_g: row?.fat_g ?? 0,
      intra_cho_g_per_h: row?.intra_cho_g_per_h ?? 0,
    })

    dateCursor.setDate(dateCursor.getDate() + 1)
  }

  return days
}

function buildMacroSummary(
  rows: NutritionPlanRow[],
  range: DateRangeOption,
  now: Date,
): MacroSummary | null {
  if (rows.length === 0) {
    return null
  }

  const { start, end } = getDateRange(range, now)
  const rangeRows = rows.filter((row) => row.date >= format(start, "yyyy-MM-dd") && row.date <= format(end, "yyyy-MM-dd"))

  if (rangeRows.length === 0) {
    return null
  }

  const totals = rangeRows.reduce(
    (acc, row) => {
      acc.calories += row.kcal
      acc.protein += row.protein_g
      acc.carbs += row.carbs_g
      acc.fat += row.fat_g
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  const previousDay = new Date(start)
  previousDay.setDate(previousDay.getDate() - 1)
  const previousRow = rows.find((row) => row.date === format(previousDay, "yyyy-MM-dd"))
  const averageCalories = totals.calories / rangeRows.length
  const deltaBase = range === "today" ? previousRow?.kcal ?? 0 : averageCalories
  const calorieDelta = Math.round(totals.calories - deltaBase)
  const deltaLabel = range === "today" ? "vs yesterday" : "vs avg"

  return {
    range,
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat),
    targetCalories: Math.round(averageCalories),
    targetProtein: Math.round(totals.protein / rangeRows.length),
    targetCarbs: Math.round(totals.carbs / rangeRows.length),
    targetFat: Math.round(totals.fat / rangeRows.length),
    calorieDelta,
    deltaLabel,
  }
}

function buildNutritionSummary(rows: NutritionPlanRow[], range: DateRangeOption, now: Date): NutritionSummary {
  const dailyData = buildNutritionDailySummary(rows, range, now)

  const average = dailyData.reduce(
    (acc, day) => {
      acc.calories += day.kcal
      acc.protein += day.protein_g
      acc.carbs += day.carbs_g
      acc.fat += day.fat_g
      return acc
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  const divisor = dailyData.length || 1

  return {
    targetCalories: Math.round(average.calories / divisor),
    targetProtein: Math.round(average.protein / divisor),
    targetCarbs: Math.round(average.carbs / divisor),
    targetFat: Math.round(average.fat / divisor),
    dailyData,
  }
}

function buildPlanPreview(plan: NutritionPlan): PlanPreview {
  return {
    id: plan.id,
    title: `Plan ${plan.start_date}`,
    createdAt: plan.created_at,
    focus: plan.user_key,
    summary: `${plan.start_date} → ${plan.end_date}`,
    startDate: plan.start_date,
    endDate: plan.end_date,
  }
}

function buildUpcomingEvent(profile: ProfileRow | null): UpcomingEvent | null {
  if (!profile?.event) {
    return null
  }

  const meta = profile.meta ?? {}
  const eventDate = typeof meta === "object" && meta ? (meta["event_date"] as string | undefined) : undefined

  return {
    name: profile.event,
    date: eventDate ?? "",
    description: profile.primary_goal ?? null,
  }
}

type PreferencesPayload = {
  units: "metric" | "imperial"
  theme: "light" | "dark"
  notifications_enabled: boolean
}

type MonthWorkoutsPayload = {
  workouts: TpWorkout[]
}

type RecipesPayload = {
  recipes?: Recipe[]
}

type RecipePayload = {
  recipe?: Recipe
  ingredients?: RecipeIngredient[]
  steps?: RecipeStep[]
}

type MealSchedulePayload = {
  schedule?: MealScheduleItem[]
}

type GroceryPayload = {
  items?: GroceryItem[]
}

type MealLogPayload = {
  meal_log?: MealLog[]
}

type MealPrepPayload = {
  sessions?: MealPrepSession[]
}

type UserEventsPayload = {
  events?: UserEvent[]
}

type MealPlanDayPayload = {
  plan?: MealPlanDay
  items?: MealPlanItem[]
}

type PlanWeekPayload = {
  meals?: PlanWeekMeal[]
}

type PlanChatPayload = {
  thread?: PlanChatThread
  messages?: PlanChatMessage[]
}

type MacrosDayPayload = MacrosDaySummary

async function fetchPreferences() {
  const response = await fetch("/api/v1/settings/preferences")
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load preferences")
  }
  return (await response.json()) as PreferencesPayload
}

async function patchPreferences(payload: Partial<PreferencesPayload>) {
  const response = await fetch("/api/v1/settings/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to update preferences")
  }
  return (await response.json()) as PreferencesPayload
}

async function fetchMonthWorkouts(year: number, month: number) {
  const response = await fetch(`/api/v1/workouts/month?year=${year}&month=${month}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load workouts")
  }
  const data = (await response.json()) as MonthWorkoutsPayload
  return data.workouts ?? []
}

async function fetchNutritionDay(date: string) {
  const response = await fetch(`/api/v1/nutrition/day?date=${date}`)
  if (response.status === 404) {
    return { exists: false, plan: null }
  }
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load nutrition day")
  }
  const data = (await response.json()) as NutritionDayPlan
  return { exists: true, plan: data }
}

async function fetchRecipes() {
  const response = await fetch("/api/v1/food/recipes")
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load recipes")
  }
  const data = (await response.json()) as RecipesPayload
  return Array.isArray(data.recipes) ? data.recipes : []
}

async function fetchRecipe(recipeId: string) {
  const response = await fetch(`/api/v1/food/recipes/${recipeId}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load recipe")
  }
  const data = (await response.json()) as RecipePayload
  return {
    recipe: data.recipe ?? null,
    ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
    steps: Array.isArray(data.steps) ? data.steps : [],
  }
}

async function fetchMealSchedule(start: string, end: string) {
  const response = await fetch(`/api/v1/food/schedule?start=${start}&end=${end}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load meal schedule")
  }
  const data = (await response.json()) as MealSchedulePayload
  return Array.isArray(data.schedule) ? data.schedule : []
}

async function fetchGrocery(start?: string, end?: string) {
  const params = new URLSearchParams()
  if (start && end) {
    params.set("start", start)
    params.set("end", end)
  }
  const response = await fetch(`/api/v1/food/grocery?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load grocery list")
  }
  const data = (await response.json()) as GroceryPayload
  return Array.isArray(data.items) ? data.items : []
}

async function fetchMealLog(date: string) {
  const response = await fetch(`/api/v1/food/meal-log?date=${date}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load meal log")
  }
  const data = (await response.json()) as MealLogPayload
  return Array.isArray(data.meal_log) ? data.meal_log : []
}

async function fetchMealPrep(start?: string, end?: string) {
  const params = new URLSearchParams()
  if (start && end) {
    params.set("start", start)
    params.set("end", end)
  }
  const response = await fetch(`/api/v1/food/prep-sessions?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load meal prep")
  }
  const data = (await response.json()) as MealPrepPayload
  return Array.isArray(data.sessions) ? data.sessions : []
}

async function fetchPlanWeek(start: string, end: string) {
  const params = new URLSearchParams({ start, end })
  const response = await fetch(`/api/v1/plans/week?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load weekly plan")
  }
  const data = (await response.json()) as PlanWeekPayload
  return Array.isArray(data.meals) ? data.meals : []
}

async function fetchPlanChat(weekStart: string) {
  const params = new URLSearchParams({ week_start: weekStart })
  const response = await fetch(`/api/v1/plans/chat?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load plan chat")
  }
  const data = (await response.json()) as PlanChatPayload
  return {
    thread: data.thread ?? null,
    messages: Array.isArray(data.messages) ? data.messages : [],
  }
}

async function fetchUserEvents(from: string, to: string) {
  const params = new URLSearchParams({ from, to })
  const response = await fetch(`/api/v1/events?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load events")
  }
  const data = (await response.json()) as UserEventsPayload
  return Array.isArray(data.events) ? data.events : []
}

async function fetchMealPlanDay(date: string) {
  const response = await fetch(`/api/v1/meals/day?date=${date}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load meal plan")
  }
  const data = (await response.json()) as MealPlanDayPayload
  if (data.plan && Array.isArray(data.items)) {
    return { plan: data.plan, items: data.items }
  }
  return { plan: null, items: [] }
}

async function fetchMacrosDay(date: string) {
  const response = await fetch(`/api/v1/macros/day?date=${date}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load macros")
  }
  return (await response.json()) as MacrosDayPayload
}

async function fetchWeeklyNutrition(start: string, end: string) {
  const params = new URLSearchParams({ start, end })
  const response = await fetch(`/api/v1/nutrition/week?${params.toString()}`)
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to load weekly nutrition")
  }
  const data = (await response.json()) as { days?: WeeklyNutritionDay[] }
  return Array.isArray(data.days) ? data.days : []
}

export function useWeekRange(anchorDate: Date) {
  const start = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const end = endOfWeek(anchorDate, { weekStartsOn: 1 })
  return {
    start,
    end,
    startKey: format(start, "yyyy-MM-dd"),
    endKey: format(end, "yyyy-MM-dd"),
  }
}

export function useWeeklyNutrition(userId: string | null | undefined, weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["db", "nutrition-week", userId, weekStart, weekEnd],
    queryFn: () => fetchWeeklyNutrition(weekStart, weekEnd),
    enabled: Boolean(userId) && Boolean(weekStart) && Boolean(weekEnd),
    staleTime: 1000 * 30,
  })
}

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["db", "profile", userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
  })
}

export function usePreferences(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["db", "preferences", userId],
    queryFn: fetchPreferences,
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
  })
}

export function useUpdatePreferences(userId: string | null | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: patchPreferences,
    onMutate: async (nextPayload) => {
      await queryClient.cancelQueries({ queryKey: ["db", "preferences", userId] })
      const previous = queryClient.getQueryData<PreferencesPayload>(["db", "preferences", userId])

      if (previous) {
        const updated = { ...previous, ...nextPayload }
        queryClient.setQueryData(["db", "preferences", userId], updated)
        queryClient.setQueryData<ProfileRow | null | undefined>(["db", "profile", userId], (current) =>
          current
            ? {
                ...current,
                units: updated.units,
                meta: {
                  ...(typeof current.meta === "object" && current.meta ? current.meta : {}),
                  theme: updated.theme,
                  notifications_enabled: updated.notifications_enabled,
                },
              }
            : current,
        )
      }

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["db", "preferences", userId], context.previous)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["db", "preferences", userId], data)
      queryClient.setQueryData<ProfileRow | null | undefined>(["db", "profile", userId], (current) =>
        current
          ? {
              ...current,
              units: data.units,
              meta: {
                ...(typeof current.meta === "object" && current.meta ? current.meta : {}),
                theme: data.theme,
                notifications_enabled: data.notifications_enabled,
              },
            }
          : current,
      )
    },
  })
}

export function useMonthWorkouts(userId: string | null | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ["db", "month-workouts", userId, year, month],
    queryFn: () => fetchMonthWorkouts(year, month),
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}

export function useOnboardingProfileSave() {
  return {
    save: (userId: string, input: OnboardingProfileInput, email: string | null) =>
      upsertProfileFromOnboarding(userId, input, email),
  }
}

export function useNutritionPlans(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["db", "nutrition-plans", userId],
    queryFn: () => fetchNutritionPlans(userId as string),
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
  })
}

export function useNutritionPlanRows(planId: string | null | undefined) {
  return useQuery({
    queryKey: ["db", "nutrition-plan-rows", planId],
    queryFn: () => fetchNutritionPlanRowsByPlanId(planId as string),
    enabled: Boolean(planId),
    staleTime: 1000 * 60,
  })
}

export function useTrainingWorkouts(
  userId: string | null | undefined,
  range: DateRangeOption,
) {
  return useQuery({
    queryKey: ["db", "training-workouts", userId, range],
    queryFn: async () => {
      const { start, end } = getDateRange(range, new Date())
      return fetchWorkoutsByDateRange(userId as string, format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"))
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}

export function useTrainingSessions(
  userId: string | null | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: ["db", "training-sessions", userId, startDate, endDate],
    queryFn: async () => {
      const workouts = await fetchWorkoutsByDateRange(
        userId as string,
        startDate,
        endDate,
      )
      return buildTrainingSessions(workouts)
    },
    enabled: Boolean(userId) && Boolean(startDate) && Boolean(endDate),
    staleTime: 1000 * 30,
  })
}

export function useDashboardOverview(
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  range: DateRangeOption,
) {
  return useQuery({
    queryKey: ["db", "dashboard-overview", userId, range],
    queryFn: async (): Promise<DashboardOverviewData> => {
      const now = new Date()
      const { start, end } = getDateRange(range, now)
      const workouts = await fetchWorkoutsByDateRange(
        userId as string,
        format(start, "yyyy-MM-dd"),
        format(end, "yyyy-MM-dd"),
      )

      const activePlan = await fetchActivePlanByDate(userId as string, format(now, "yyyy-MM-dd"))
      const planRows = activePlan ? await fetchNutritionPlanRowsByPlanId(activePlan.id) : []

      return {
        macros: buildMacroSummary(planRows, range, now),
        trainingSessions: buildTrainingSessions(workouts),
        upcomingEvent: buildUpcomingEvent(profile),
        planPreview: activePlan ? buildPlanPreview(activePlan) : null,
      }
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}

export function useTrainingSummary(
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  range: DateRangeOption,
) {
  return useQuery({
    queryKey: ["db", "training-summary", userId, range],
    queryFn: async (): Promise<{ sessions: TrainingSessionSummary[]; summary: TrainingSummary; calendar: CalendarEvent[] }> => {
      const { start, end } = getDateRange(range, new Date())
      const workouts = await fetchWorkoutsByDateRange(
        userId as string,
        format(start, "yyyy-MM-dd"),
        format(end, "yyyy-MM-dd"),
      )

      return {
        sessions: buildTrainingSessions(workouts),
        summary: buildTrainingSummary(workouts),
        calendar: buildCalendarEvents(workouts),
      }
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}

export function useNutritionSummary(
  userId: string | null | undefined,
  range: DateRangeOption,
) {
  return useQuery({
    queryKey: ["db", "nutrition-summary", userId, range],
    queryFn: async () => {
      const now = new Date()
      const { start, end } = getDateRange(range, now)
      const activePlan = await fetchActivePlanByDate(userId as string, format(now, "yyyy-MM-dd"))
      const planRows = await fetchNutritionPlanRowsByDateRange(
        userId as string,
        format(start, "yyyy-MM-dd"),
        format(end, "yyyy-MM-dd"),
      )

      return {
        plan: activePlan,
        rows: planRows,
        summary: buildNutritionSummary(planRows, range, now),
      }
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}

export function useNutritionDayPlan(
  userId: string | null | undefined,
  date: string,
) {
  return useQuery({
    queryKey: ["db", "nutrition-day", userId, date],
    queryFn: () => fetchNutritionDay(date),
    enabled: Boolean(userId) && Boolean(date),
    staleTime: 1000 * 30,
  })
}

export function useNutritionDay(userId: string | null | undefined, date: string) {
  return useQuery({
    queryKey: ["db", "nutrition-day", userId, date],
    queryFn: () => fetchNutritionDay(date),
    enabled: Boolean(userId) && Boolean(date),
    staleTime: 1000 * 30,
  })
}

export function useMealPlanDay(userId: string | null | undefined, date: string) {
  return useQuery({
    queryKey: ["db", "meal-plan-day", userId, date],
    queryFn: () => fetchMealPlanDay(date),
    enabled: Boolean(userId) && Boolean(date),
    staleTime: 1000 * 15,
  })
}

export function useMacrosDay(userId: string | null | undefined, date: string) {
  return useQuery({
    queryKey: ["db", "macros-day", userId, date],
    queryFn: () => fetchMacrosDay(date),
    enabled: Boolean(userId) && Boolean(date),
    staleTime: 1000 * 15,
  })
}

export function useEnsureMealPlans() {
  return useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      const params = new URLSearchParams({ start, end })
      const response = await fetch(`/api/v1/meals/ensure?${params.toString()}`, { method: "POST" })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to ensure meals")
      }
      return response.json()
    },
  })
}

export function useUpdateMealPlanItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<Pick<MealPlanItem, "eaten" | "name" | "time" | "notes">>
    }) => {
      const response = await fetch(`/api/v1/meals/item/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to update meal")
      }
      return (await response.json()) as { item: MealPlanItem }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day"] })
      queryClient.invalidateQueries({ queryKey: ["db", "macros-day"] })
      queryClient.invalidateQueries({ queryKey: ["db", "nutrition-week"] })
      queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-item", variables.id] })
    },
  })
}

export function useUpdateMealIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const response = await fetch(`/api/v1/meals/ingredient/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to update ingredient")
      }
      return (await response.json()) as { ingredient: MealPlanIngredient }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "meal-plan-day"] })
    },
  })
}

export function useRecipes(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["db", "food-recipes", userId],
    queryFn: fetchRecipes,
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
  })
}

export function useRecipe(userId: string | null | undefined, recipeId: string | null | undefined) {
  return useQuery({
    queryKey: ["db", "food-recipe", userId, recipeId],
    queryFn: () => fetchRecipe(recipeId as string),
    enabled: Boolean(userId) && Boolean(recipeId),
    staleTime: 1000 * 60,
  })
}

export function useMealSchedule(userId: string | null | undefined, start: string, end: string) {
  return useQuery({
    queryKey: ["db", "food-schedule", userId, start, end],
    queryFn: () => fetchMealSchedule(start, end),
    enabled: Boolean(userId) && Boolean(start) && Boolean(end),
    staleTime: 1000 * 30,
  })
}

export function useGrocery(userId: string | null | undefined, start?: string, end?: string) {
  return useQuery({
    queryKey: ["db", "food-grocery", userId, start, end],
    queryFn: () => fetchGrocery(start, end),
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}

export function useMealLog(userId: string | null | undefined, date: string) {
  return useQuery({
    queryKey: ["db", "food-meal-log", userId, date],
    queryFn: () => fetchMealLog(date),
    enabled: Boolean(userId) && Boolean(date),
    staleTime: 1000 * 15,
  })
}

export function useMealPrep(userId: string | null | undefined, start?: string, end?: string) {
  return useQuery({
    queryKey: ["db", "food-meal-prep", userId, start, end],
    queryFn: () => fetchMealPrep(start, end),
    enabled: Boolean(userId),
    staleTime: 1000 * 60,
  })
}

export function usePlanWeek(userId: string | null | undefined, start: string, end: string) {
  return useQuery({
    queryKey: ["db", "plan-week", userId, start, end],
    queryFn: () => fetchPlanWeek(start, end),
    enabled: Boolean(userId) && Boolean(start) && Boolean(end),
    staleTime: 1000 * 30,
  })
}

export function usePlanChat(userId: string | null | undefined, weekStart: string) {
  return useQuery({
    queryKey: ["db", "plan-chat", userId, weekStart],
    queryFn: () => fetchPlanChat(weekStart),
    enabled: Boolean(userId) && Boolean(weekStart),
    staleTime: 1000 * 10,
  })
}

export function useSendPlanChatMessage(userId: string | null | undefined, weekStart: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/v1/plans/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start: weekStart, content }),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to send message")
      }
      return (await response.json()) as PlanChatPayload
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "plan-chat", userId, weekStart] })
    },
  })
}

export function useResetPlanChat(userId: string | null | undefined, weekStart: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (threadId: string) => {
      const params = new URLSearchParams({ thread_id: threadId })
      const response = await fetch(`/api/v1/plans/chat?${params.toString()}`, { method: "DELETE" })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to reset chat")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "plan-chat", userId, weekStart] })
    },
  })
}

export async function updateMealCompletion({
  date,
  slot,
  completed,
}: {
  date: string
  slot: number
  completed: boolean
}) {
  const response = await fetch("/api/v1/nutrition/meal", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, slot, completed }),
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(errorBody?.error ?? "Failed to update meal")
  }
  const data = (await response.json()) as { meals?: Meal[] }
  return Array.isArray(data.meals) ? data.meals : []
}

export function useCalendarEvents(
  userId: string | null | undefined,
  profile: ProfileRow | null | undefined,
  range: DateRangeOption,
) {
  const profileUpdatedAt = profile?.updated_at ?? null

  return useQuery({
    queryKey: ["db", "calendar-events", userId, range, profileUpdatedAt],
    queryFn: async () => {
      const now = new Date()
      const { start, end } = getDateRange(range, now)
      const [workouts, nutritionRows] = await Promise.all([
        fetchWorkoutsByDateRange(
          userId as string,
          format(start, "yyyy-MM-dd"),
          format(end, "yyyy-MM-dd"),
        ),
        fetchNutritionPlanRowsByDateRange(
          userId as string,
          format(start, "yyyy-MM-dd"),
          format(end, "yyyy-MM-dd"),
        ),
      ])

      const trainingCalendar = buildCalendarEvents(workouts)
      const nutritionCalendar = buildNutritionEvents(nutritionRows, profile, range, now)

      return {
        sessions: buildTrainingSessions(workouts),
        summary: buildTrainingSummary(workouts),
        calendar: [...trainingCalendar, ...nutritionCalendar],
      }
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}

export function useUserEvents(
  userId: string | null | undefined,
  from: string,
  to: string,
) {
  return useQuery({
    queryKey: ["db", "events", userId, from, to],
    queryFn: () => fetchUserEvents(from, to),
    enabled: Boolean(userId) && Boolean(from) && Boolean(to),
    staleTime: 1000 * 30,
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Omit<UserEvent, "id" | "user_id" | "created_at" | "updated_at">) => {
      const response = await fetch("/api/v1/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to create event")
      }
      return (await response.json()) as { event: UserEvent }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "events"] })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: Partial<Omit<UserEvent, "id" | "user_id" | "created_at" | "updated_at">>
    }) => {
      const response = await fetch(`/api/v1/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to update event")
      }
      return (await response.json()) as { event: UserEvent }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "events"] })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v1/events/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to delete event")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["db", "events"] })
    },
  })
}
