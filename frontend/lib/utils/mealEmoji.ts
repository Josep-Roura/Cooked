export function getMealEmoji(name?: string | null, mealType?: string | null) {
  const value = `${mealType ?? ""} ${name ?? ""}`.toLowerCase()

  if (value.includes("breakfast") || value.includes("morning")) return "🍳"
  if (value.includes("lunch")) return "🥗"
  if (value.includes("dinner") || value.includes("supper")) return "🍽️"
  if (value.includes("snack")) return "🥨"
  if (value.includes("pre-workout") || value.includes("pre workout")) return "⚡"
  if (value.includes("intra") || value.includes("during")) return "💧"
  if (value.includes("post-workout") || value.includes("post workout")) return "🥤"
  if (value.includes("recovery")) return "🫐"
  return "🥗"
}
