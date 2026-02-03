# AI Recipe Generation API Documentation

## Overview

The recipe generation system allows users to generate detailed recipes with IA, including ingredients with scalable quantities and cooking steps. All data is saved to the database and can be scaled based on number of servings.

## Endpoints

### 1. Generate Recipe

**Endpoint:** `POST /api/ai/recipes`

**Authentication:** Required (Bearer token)

**Description:** Generate a detailed recipe with ingredients and steps using AI.

**Request Body:**

```json
{
  "meal_name": "Grilled Chicken Breast with Sweet Potato",
  "meal_type": "dinner",
  "servings": 4,
  "dietary_preferences": ["high-protein", "gluten-free"],
  "ingredients_to_include": ["chicken", "sweet potato"],
  "ingredients_to_avoid": ["dairy", "nuts"],
  "cook_time_max_min": 40,
  "target_macros": {
    "kcal": 500,
    "protein_g": 45,
    "carbs_g": 40,
    "fat_g": 12
  }
}
```

**Request Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `meal_name` | string | Yes | Name/description of the meal |
| `meal_type` | enum | Yes | One of: `breakfast`, `lunch`, `dinner`, `snack` |
| `servings` | number | No | Base servings (default: 1) |
| `dietary_preferences` | string[] | No | e.g., `["high-protein", "low-carb", "vegan"]` |
| `ingredients_to_include` | string[] | No | Must-include ingredients |
| `ingredients_to_avoid` | string[] | No | Ingredients to exclude |
| `cook_time_max_min` | number | No | Maximum cooking time in minutes |
| `target_macros` | object | No | Macro targets (kcal, protein_g, carbs_g, fat_g) |

**Response (201 Created):**

```json
{
  "ok": true,
  "recipe": {
    "id": "uuid",
    "title": "Grilled Chicken Breast with Sweet Potato",
    "servings": 4,
    "cook_time_min": 35,
    "description": "...",
    "macros_kcal": 2000,
    "macros_protein_g": 180,
    "macros_carbs_g": 160,
    "macros_fat_g": 48,
    "ingredients": [
      {
        "name": "Chicken breast",
        "quantity": 800,
        "unit": "g",
        "category": "protein",
        "optional": false
      },
      {
        "name": "Sweet potato",
        "quantity": 600,
        "unit": "g",
        "category": "vegetable",
        "optional": false
      }
    ],
    "steps": [
      {
        "step_number": 1,
        "instruction": "Preheat grill to medium-high heat",
        "timer_seconds": null
      },
      {
        "step_number": 2,
        "instruction": "Season chicken with salt and pepper",
        "timer_seconds": null
      }
    ]
  }
}
```

**Important Notes:**
- Ingredient quantities are stored as TOTALS for all servings
- These quantities are automatically scaled when requesting different serving counts
- Special units (eggs, cans, etc.) are kept as whole numbers
- Macros are stored for the full recipe (all servings)

---

### 2. Get Recipe with Scaling

**Endpoint:** `GET /api/ai/recipes/[id]?servings=N`

**Authentication:** Required (Bearer token)

**Description:** Retrieve a recipe with ingredients scaled to specified servings.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `servings` | number | recipe.servings | Target number of servings |

**Response (200 OK):**

```json
{
  "ok": true,
  "recipe": {
    "id": "uuid",
    "title": "Grilled Chicken Breast with Sweet Potato",
    "servings": 2,
    "macros_kcal": 1000,
    "macros_protein_g": 90,
    "macros_carbs_g": 80,
    "macros_fat_g": 24
  },
  "ingredients": [
    {
      "name": "Chicken breast",
      "quantity": 400,
      "unit": "g",
      "category": "protein"
    },
    {
      "name": "Sweet potato",
      "quantity": 300,
      "unit": "g",
      "category": "vegetable"
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "instruction": "Preheat grill to medium-high heat"
    }
  ],
  "scaling_factor": 0.5
}
```

**Scaling Features:**
- Ingredients are proportionally scaled
- Whole number units (eggs, cans, etc.) remain as integers
- Macros are recalculated proportionally
- Non-scalable ingredients can be marked as optional

---

### 3. Scale Recipe

**Endpoint:** `POST /api/ai/recipes/scale`

**Authentication:** Required (Bearer token)

**Description:** Calculate scaled ingredients for different serving sizes.

**Request Body:**

```json
{
  "recipe_id": "uuid",
  "new_servings": 6
}
```

**Response (200 OK):**

```json
{
  "ok": true,
  "recipe": {
    "id": "uuid",
    "title": "...",
    "servings": 6,
    "scaling_factor": 1.5
  },
  "ingredients": [
    {
      "name": "Chicken breast",
      "quantity": 1200,
      "unit": "g"
    }
  ]
}
```

---

## Ingredient Scaling Logic

### Quantity Scaling

Quantities are scaled proportionally based on the ratio of new servings to original servings.

**Example:**
- Original recipe: 4 servings with 200g flour
- Request: 2 servings
- Scaling factor: 2 ÷ 4 = 0.5
- Scaled quantity: 200 × 0.5 = 100g

### Whole Number Handling

Certain units are kept as whole numbers:
- Eggs, cans, packages, boxes, loaves
- Bulbs, heads, cloves, slices, sheets
- Pieces, fillets, breasts

**Example:**
- Original: 1 egg → Scaled to 2 servings → 0.5 eggs → **1 egg** (rounded to minimum 1)
- Original: 2 eggs → Scaled to 0.5 servings → 1 egg → **1 egg** (exact)

### Decimal Rounding

Non-whole units are rounded to 2 decimal places:
- 250ml × 0.33 = 82.5ml → **82.5ml**
- 500g × 1.5 = 750g → **750g**

### Macro Scaling

Macros are scaled proportionally:
- If recipe has 500 kcal for 1 serving
- For 2 servings: 500 × 2 = **1000 kcal**

---

## Ingredient Categories

Recipes include ingredient categories for better organization:

- `protein` - meat, fish, eggs, legumes
- `vegetable` - vegetables, greens
- `fruit` - fruits, berries
- `grain` - bread, pasta, rice, oats
- `dairy` - milk, cheese, yogurt
- `oil` - cooking oils, butter
- `spice` - spices, seasonings, herbs
- `other` - miscellaneous

---

## Database Schema

### recipes table

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Recipe ID |
| `user_id` | uuid | Owner user ID |
| `title` | text | Recipe title |
| `description` | text | Recipe description |
| `servings` | int | Base number of servings |
| `cook_time_min` | int | Cooking time in minutes |
| `macros_kcal` | int | Total kcal for all servings |
| `macros_protein_g` | int | Total protein grams |
| `macros_carbs_g` | int | Total carbs grams |
| `macros_fat_g` | int | Total fat grams |
| `tags` | text[] | Dietary preferences/tags |
| `category` | text | Meal type (breakfast, lunch, etc.) |

### recipe_ingredients table

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Ingredient ID |
| `recipe_id` | uuid | Recipe reference |
| `user_id` | uuid | Owner user ID |
| `name` | text | Ingredient name |
| `quantity` | numeric | TOTAL for all servings |
| `unit` | text | g, ml, cup, tbsp, etc. |
| `category` | text | Ingredient category |
| `optional` | boolean | Whether ingredient is optional |

### recipe_steps table

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Step ID |
| `recipe_id` | uuid | Recipe reference |
| `user_id` | uuid | Owner user ID |
| `step_number` | int | Sequential step number |
| `instruction` | text | Step instruction |
| `timer_seconds` | int | Optional timer duration |

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Validation error",
  "details": [
    {
      "path": ["meal_name"],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Not authenticated"
}
```

### 404 Not Found

```json
{
  "error": "Recipe not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to generate recipe",
  "details": "OpenAI API error message"
}
```

---

## Usage Examples

### Generate a High-Protein Dinner

```bash
curl -X POST http://localhost:3000/api/ai/recipes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meal_name": "Grilled Salmon with Asparagus",
    "meal_type": "dinner",
    "servings": 2,
    "dietary_preferences": ["high-protein"],
    "target_macros": {
      "protein_g": 40,
      "kcal": 500
    }
  }'
```

### Get Recipe Scaled for 4 People

```bash
curl http://localhost:3000/api/ai/recipes/RECIPE_ID?servings=4 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Recipe Scaled for 1 Person

```bash
curl http://localhost:3000/api/ai/recipes/RECIPE_ID?servings=1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Implementation Notes

- All timestamps use UTC
- Quantities > 1 for whole units don't get singular unit names
- AI generation uses OpenAI GPT-4o-mini model
- Recipes are user-scoped via `user_id`
- All data is validated with Zod schemas
- Macros are estimated by AI; users can adjust
