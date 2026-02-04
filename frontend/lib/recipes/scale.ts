/**
 * Utilities for scaling recipe ingredients based on servings
 */

export interface ScaledIngredient {
  name: string
  quantity: number
  unit: string
  category: string
  optional: boolean
}

/**
 * List of units that should be kept as whole numbers
 */
const WHOLE_NUMBER_UNITS = [
  "egg",
  "eggs",
  "can",
  "cans",
  "package",
  "packages",
  "box",
  "boxes",
  "loaf",
  "loaves",
  "bulb",
  "bulbs",
  "head",
  "heads",
  "clove",
  "cloves",
  "slice",
  "slices",
  "sheet",
  "sheets",
  "piece",
  "pieces",
  "fillet",
  "fillets",
  "breast",
  "breasts",
]

/**
 * Determine if a unit should be kept as a whole number
 */
function isWholeNumberUnit(unit: string): boolean {
  const lowerUnit = unit.toLowerCase()
  return WHOLE_NUMBER_UNITS.some((u) => lowerUnit.includes(u))
}

/**
 * Format a quantity for display
 * e.g., 0.5 → "½", 1.5 → "1½"
 */
export function formatQuantity(quantity: number): string {
  if (quantity === 0) return "0"

  // Check for common fractions
  const fractions: Record<number, string> = {
    0.125: "⅛",
    0.25: "¼",
    0.333: "⅓",
    0.375: "⅜",
    0.5: "½",
    0.625: "⅝",
    0.667: "⅔",
    0.75: "¾",
    0.875: "⅞",
  }

  const decimal = quantity % 1
  const whole = Math.floor(quantity)

  // Look for fraction match (with tolerance)
  for (const [frac, symbol] of Object.entries(fractions)) {
    if (Math.abs(decimal - parseFloat(frac)) < 0.01) {
      if (whole > 0) {
        return `${whole} ${symbol}`
      }
      return symbol
    }
  }

  // Default: round to reasonable decimal places
  if (Number.isInteger(quantity)) {
    return String(quantity)
  }

  return quantity.toFixed(2).replace(/\.?0+$/, "")
}

/**
 * Scale quantity based on servings
 */
export function scaleIngredient(
  ingredient: ScaledIngredient,
  originalServings: number,
  newServings: number
): ScaledIngredient {
  const scaleFactor = newServings / originalServings
  let scaledQuantity = ingredient.quantity * scaleFactor

  if (isWholeNumberUnit(ingredient.unit)) {
    scaledQuantity = Math.round(scaledQuantity)
    // At least 1 if not zero
    if (scaledQuantity === 0 && ingredient.quantity > 0) {
      scaledQuantity = 1
    }
  } else {
    // Round to 2 decimal places
    scaledQuantity = Math.round(scaledQuantity * 100) / 100
  }

  return {
    ...ingredient,
    quantity: scaledQuantity,
  }
}

/**
 * Scale multiple ingredients
 */
export function scaleIngredients(
  ingredients: ScaledIngredient[],
  originalServings: number,
  newServings: number
): ScaledIngredient[] {
  if (newServings === originalServings) {
    return ingredients
  }

  return ingredients.map((ing) => scaleIngredient(ing, originalServings, newServings))
}

/**
 * Format ingredient for display
 * e.g., "2 cups flour" or "½ egg white"
 */
export function formatIngredient(ingredient: ScaledIngredient): string {
  const quantityStr = formatQuantity(ingredient.quantity)
  const unit = ingredient.quantity === 1 && ingredient.unit.endsWith("s") ? ingredient.unit.slice(0, -1) : ingredient.unit

  return `${quantityStr} ${unit} ${ingredient.name}`.trim()
}

/**
 * Convert between units (basic conversions)
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  const conversions: Record<string, Record<string, number>> = {
    // Volume conversions
    "tbsp": { "tsp": 3, "ml": 15, "cup": 0.0625 },
    "tsp": { "tbsp": 0.333, "ml": 5, "cup": 0.0208 },
    "cup": { "ml": 240, "tbsp": 16, "tsp": 48 },
    "ml": { "cup": 0.00417, "tbsp": 0.067, "tsp": 0.2 },

    // Weight conversions
    "oz": { "g": 28.35 },
    "g": { "oz": 0.035, "kg": 0.001 },
    "kg": { "g": 1000, "lb": 2.205 },
    "lb": { "kg": 0.454, "g": 453.6 },
  }

  const from = fromUnit.toLowerCase()
  const to = toUnit.toLowerCase()

  if (from === to) return quantity

  const conversion = conversions[from]?.[to]
  if (!conversion) return null

  return quantity * conversion
}
