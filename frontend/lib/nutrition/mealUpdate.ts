export type MealUpdateInput = {
  recipe?: unknown
  ingredients?: unknown[]
}

export type MealExistingData = {
  recipe?: unknown
  ingredients?: unknown[] | null
}

export function mergeMealUpdate(existing: MealExistingData | undefined, update: MealUpdateInput) {
  return {
    recipe: update.recipe !== undefined ? update.recipe : existing?.recipe ?? null,
    ingredients:
      update.ingredients !== undefined
        ? update.ingredients
        : (existing?.ingredients as unknown[] | null) ?? [],
  }
}
