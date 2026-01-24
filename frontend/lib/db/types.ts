export type Units = "metric" | "imperial"

export interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  meta: Record<string, unknown> | null
  name: string | null
  height_cm: number | null
  weight_kg: number | null
  units: Units | null
  primary_goal: string | null
  experience_level: string | null
  event: string | null
  sports: string[] | null
  workout_time: string | null
  diet: string | null
  meals_per_day: number | null
  cooking_time_min: number | null
  budget: string | null
  kitchen: string | null
  trainingpeaks_connected: boolean | null
  updated_at: string | null
  accept_terms: boolean | null
  accept_terms_at: string | null
}

export interface NutritionPlanRow {
  id: string
  plan_id: string | null
  date: string
  day_type: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  intra_cho_g_per_h: number
  created_at: string
  user_id: string | null
}

export interface NutritionPlan {
  id: string
  user_key: string
  source_filename: string | null
  weight_kg: number
  start_date: string
  end_date: string
  created_at: string
  user_id: string
}

export interface TpWorkout {
  id: number
  user_id: string | null
  athlete_id: string
  workout_day: string
  start_time: string | null
  workout_type: string | null
  title: string | null
  description: string | null
  coach_comments: string | null
  athlete_comments: string | null
  planned_hours: number | null
  planned_km: number | null
  actual_hours: number | null
  actual_km: number | null
  if: number | null
  tss: number | null
  power_avg: number | null
  hr_avg: number | null
  rpe: number | null
  feeling: number | null
  has_actual: boolean | null
  week: string | null
  dow: string | null
  source: string | null
  created_at: string | null
  updated_at: string | null
}

export type DateRangeOption = "today" | "week" | "month"

export type TrainingType = "swim" | "bike" | "run" | "strength" | "rest" | "other"

export type TrainingIntensity = "low" | "moderate" | "high"

export interface TrainingSessionSummary {
  id: string
  type: TrainingType
  title: string
  durationMinutes: number
  intensity: TrainingIntensity
  calories: number
  completed: boolean
  time: string
  date: string
  description?: string | null
}

export interface TrainingSummary {
  totalDurationMinutes: number
  totalCalories: number
  sessions: Array<{
    day: string
    type: TrainingType
    durationMinutes: number
    intensity: TrainingIntensity
  }>
}

export interface NutritionDaySummary {
  date: string
  dayLabel: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  intra_cho_g_per_h: number
}

export interface NutritionSummary {
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  dailyData: NutritionDaySummary[]
}

export type NutritionDayType = "rest" | "training" | "high"

export interface NutritionMacros {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  intra_cho_g_per_h: number
}

export interface Meal {
  slot: number
  name: string
  time: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  ingredients?: string[]
  completed?: boolean
  notes?: string | null
  tags?: string[]
}

export interface NutritionDayPlan {
  date: string
  day_type: NutritionDayType
  macros: NutritionMacros
  meals_per_day: number
  meals: Meal[]
  plan_id: string | null
}

export type RecipeCategory =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "snack"
  | "preworkout"
  | "postworkout"
  | "other"

export interface Recipe {
  id: string
  user_id: string
  title: string
  description: string | null
  servings: number
  cook_time_min: number | null
  tags: string[]
  category: RecipeCategory | null
  macros_kcal: number
  macros_protein_g: number
  macros_carbs_g: number
  macros_fat_g: number
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  user_id: string
  name: string
  quantity: number | null
  unit: string | null
  category: string | null
  optional: boolean
  created_at: string
}

export interface RecipeStep {
  id: string
  recipe_id: string
  user_id: string
  step_number: number
  instruction: string
  timer_seconds: number | null
  created_at: string
}

export interface MealScheduleItem {
  id: string
  user_id: string
  date: string
  slot: number
  name: string
  recipe_id: string | null
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  ingredients: unknown | null
  created_at: string
  updated_at: string
}

export interface MealLog {
  id: string
  user_id: string
  date: string
  slot: number
  is_eaten: boolean
  eaten_at: string | null
  created_at: string
  updated_at: string
}

export interface GroceryItem {
  id: string
  user_id: string
  name: string
  quantity: number | null
  unit: string | null
  category: string | null
  is_bought: boolean
  source: string | null
  recipe_id: string | null
  date_range_start: string | null
  date_range_end: string | null
  created_at: string
  updated_at: string
}

export interface MealPrepSession {
  id: string
  user_id: string
  title: string
  session_date: string | null
  duration_min: number | null
  notes: string | null
  created_at: string
  updated_at: string
  items?: MealPrepItem[]
}

export interface MealPrepItem {
  id: string
  session_id: string
  user_id: string
  label: string
  linked_recipe_id: string | null
  linked_dates: string[] | null
  is_done: boolean
  created_at: string
}

export interface MacroSummary {
  range: DateRangeOption
  calories: number
  protein: number
  carbs: number
  fat: number
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  calorieDelta: number
  deltaLabel: string
}

export interface UpcomingEvent {
  name: string
  date: string
  description?: string | null
  location?: string | null
}

export type EventCategory = "race" | "test" | "other"

export interface ProfileEvent {
  id: string
  title: string
  category: EventCategory
  goal: string | null
  date: string
  time: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlanPreview {
  id: string
  title: string
  createdAt: string
  focus: string
  summary: string
  startDate: string
  endDate: string
}

export interface DashboardOverviewData {
  macros: MacroSummary | null
  trainingSessions: TrainingSessionSummary[]
  upcomingEvent: UpcomingEvent | null
  planPreview: PlanPreview | null
}

export type CalendarEventType = TrainingType | "nutrition"

export interface CalendarEvent {
  id: string
  title: string
  type: CalendarEventType
  startTime: string
  endTime: string
  date: string
  color: string
  description?: string | null
}

export interface OnboardingProfileInput {
  full_name: string
  email?: string
  height_cm?: number
  weight_kg: number
  units: Units
  primary_goal: string
  experience_level: string
  event_name?: string
  sports: string[]
  typical_workout_time: string
  diet_type: string
  meals_per_day: number
  cooking_time_per_day: string
  budget_level: string
  kitchen_access: string
  trainingpeaks_connected: boolean
  accept_terms: boolean
  gender?: string
  birthdate?: string
  country?: string
  timezone?: string
  target_weight_kg?: number
  event_date?: string
  weekly_training_hours_target?: number
  weekly_sessions_swim?: number
  weekly_sessions_bike?: number
  weekly_sessions_run?: number
  weekly_sessions_gym?: number
  intensity_preference?: string
  long_session_day?: string
  days_off_preference?: string[]
  allergies?: string[]
  dislikes?: string
  caffeine?: string
  hydration_focus?: boolean
  travel_frequency?: string
  data_processing_consent?: boolean
}
