"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import type {
  CalendarEvent,
  DashboardOverviewData,
  DateRangeOption,
  EventCategory,
  MacroSummary,
  Meal,
  NutritionDaySummary,
  NutritionDayType,
  NutritionMacros,
  NutritionPlan,
  NutritionPlanRow,
  NutritionDayPlan,
  NutritionSummary,
  OnboardingProfileInput,
  PlanPreview,
  ProfileEvent,
  ProfileRow,
  TrainingIntensity,
  TrainingSessionSummary,
  TrainingSummary,
  TrainingType,
  TpWorkout,
  UpcomingEvent,
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
    const durationHours = workout.actual_hours ?? workout.planned_hours ?? 0
    const durationMinutes = Math.round(durationHours * 60)
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
    const durationMinutes = Math.round((workout.actual_hours ?? workout.planned_hours ?? 0) * 60)
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
      (sum, workout) => sum + Math.round((workout.actual_hours ?? workout.planned_hours ?? 0) * 60),
      0,
    ),
    totalCalories: workouts.reduce((sum, workout) => sum + Math.round(workout.tss ?? 0), 0),
    sessions,
  }
}

function buildCalendarEvents(workouts: TpWorkout[]): CalendarEvent[] {
  return workouts.map((workout) => {
    const type = mapWorkoutType(workout.workout_type)
    const durationHours = workout.actual_hours ?? workout.planned_hours ?? 1
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

function isEventCategory(value: unknown): value is EventCategory {
  return value === "race" || value === "test" || value === "other"
}

function normalizeProfileEvent(raw: unknown): ProfileEvent | null {
  if (!raw || typeof raw !== "object") {
    return null
  }
  const record = raw as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id : null
  const title = typeof record.title === "string" ? record.title.trim() : ""
  const date = typeof record.date === "string" ? record.date : ""
  if (!id || title.length < 2 || !date) {
    return null
  }
  const category = isEventCategory(record.category) ? record.category : "other"
  const goal = typeof record.goal === "string" ? record.goal.trim() : null
  const time = typeof record.time === "string" ? record.time : null
  const notes = typeof record.notes === "string" ? record.notes.trim() : null
  const createdAt =
    typeof record.created_at === "string" ? record.created_at : typeof record.updated_at === "string" ? record.updated_at : ""
  const updatedAt = typeof record.updated_at === "string" ? record.updated_at : createdAt
  const nowIso = new Date().toISOString()

  return {
    id,
    title,
    category,
    goal,
    date,
    time,
    notes,
    created_at: createdAt || nowIso,
    updated_at: updatedAt || nowIso,
  }
}

export function useEvents(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["db", "events", userId],
    queryFn: async (): Promise<ProfileEvent[]> => {
      const response = await fetch("/api/v1/events")
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error ?? "Failed to load events")
      }
      const data = (await response.json().catch(() => ({}))) as { events?: unknown } | unknown[]
      const rawEvents = Array.isArray(data) ? data : Array.isArray(data.events) ? data.events : []
      return rawEvents.map(normalizeProfileEvent).filter((event): event is ProfileEvent => Boolean(event))
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  })
}
