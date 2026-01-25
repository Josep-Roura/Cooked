export async function generatePlanWithAI({
  workoutType,
  durationMin,
  goal,
  weightKg,
  dietPrefs,
  notes,
}: {
  workoutType: string
  durationMin: number
  goal: string
  weightKg: number
  dietPrefs: string
  notes: string
}) {
  const title = `${goal} ${workoutType} plan`
  const category = "nutrition"
  const full_day_plan = `Plan based on ${durationMin} min ${workoutType} session for ${weightKg}kg athlete. Diet: ${dietPrefs}. ${notes}`

  return {
    title,
    category,
    full_day_plan,
  }
}
