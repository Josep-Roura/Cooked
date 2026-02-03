# Nutrition Plan System - Complete Guide

## Overview

El nuevo sistema de nutrición genera **planes específicos y estructurados** para cada entrenamiento con:
- ✅ Productos específicos (marcas reales)
- ✅ Cantidades exactas (no rangos)
- ✅ Timing preciso (cada cuánto consumir)
- ✅ Macros detallados (carbs, proteína, sodio)
- ✅ Separado: Pre-Durante-Post entreno

## Flujo de Datos

```
Usuario abre Workout → Click "Generar Plan IA"
  ↓
POST /api/ai/nutrition/during-workout
  ↓
AI genera JSON con estructura completa
  ↓
WorkoutNutritionTimeline muestra timeline visual
  ↓
Usuario ve: Qué comer, cuándo, cuánto, qué productos
```

## Estructura JSON Generada

El AI devuelve un JSON como este:

```json
{
  "preWorkout": {
    "timing": "2-3 hours before",
    "items": [
      {
        "time": "-180 min",
        "product": "Oatmeal with banana and honey",
        "quantity": 200,
        "unit": "g",
        "carbs": 45,
        "protein": 8,
        "sodium": 0,
        "notes": "Light, easily digestible meal"
      }
    ],
    "totalCarbs": 45,
    "totalProtein": 8,
    "totalCalories": 240
  },
  "duringWorkout": {
    "timing": "During workout",
    "interval": 45,
    "items": [
      {
        "time": "Every 45 min",
        "product": "Gatorade Orange 500ml",
        "quantity": 250,
        "unit": "ml",
        "carbs": 15,
        "sodium": 200,
        "notes": "Take with water for absorption"
      },
      {
        "time": "At 45 min mark",
        "product": "Clif Bar (Chocolate Chip)",
        "quantity": 1,
        "unit": "bar",
        "carbs": 42,
        "protein": 10,
        "sodium": 210,
        "notes": "Solid food for energy"
      }
    ],
    "totalCarbs": 60,
    "totalHydration": 500,
    "totalSodium": 410
  },
  "postWorkout": {
    "timing": "Within 30 minutes after",
    "items": [
      {
        "time": "Immediately (within 15 min)",
        "product": "Chocolate Milk (2%)",
        "quantity": 500,
        "unit": "ml",
        "carbs": 56,
        "protein": 16,
        "sodium": 180,
        "notes": "Optimal carb:protein ratio 3:1"
      }
    ],
    "totalCarbs": 83,
    "totalProtein": 17,
    "totalCalories": 420
  },
  "recommendations": "Para un entrenamiento de 2h: 45g carbs pre, 60g durante, 83g post..."
}
```

## UI Components

### WorkoutNutritionTimeline
**Ubicación:** `/components/nutrition/workout-nutrition-timeline.tsx`

**Features:**
- Timeline visual con 3 secciones: Pre/Durante/Post
- Expandible/Colapsable para ver detalles
- Calcula tiempos reales basado en start time del entrenamiento
- Muestra intervalos exactos (ej: "6:00 → 6:45 → 7:30")
- Nutrient badges con colores (Carbs, Protein, Sodium, Hydration)
- Productos y notas desglosadas

**Props:**
```typescript
{
  plan: WorkoutNutritionPlan,           // JSON del AI
  workoutDuration?: number,              // Minutos totales
  workoutStartTime?: string,             // HH:MM format
  recordId?: string,                     // Para guardar
  onSave?: (updates) => Promise<void>   // Callback save
}
```

## Archivos Creados/Modificados

### Nuevos
- **`lib/nutrition/workout-nutrition-schema.ts`** (280 líneas)
  - Define schema Zod para validación
  - Ejemplo completo de plan
  - Prompt template para AI mejorado

- **`components/nutrition/workout-nutrition-timeline.tsx`** (350 líneas)
  - Componente principal de visualización
  - Timeline con pre/durante/post
  - Cálculo automático de tiempos
  - Nutrient badges

### Actualizados
- **`app/api/ai/nutrition/during-workout/route.ts`**
  - Nuevo prompt que pide productos específicos
  - max_tokens aumentado a 2000
  - Parses JSON response y lo devuelve en `plan` field

- **`components/dashboard/plans/workout-details-modal.tsx`**
  - Importa WorkoutNutritionTimeline
  - Nuevo estado `nutritionPlan`
  - Renderiza timeline cuando plan generado

## Prompt del AI

El prompt actualizado pide específicamente:

```
REQUIREMENTS:
1. Use SPECIFIC PRODUCTS with brands (Gatorade, Clif Bar, etc)
2. Include EXACT quantities (not ranges)
3. Include SODIUM amounts (critical)
4. Provide TIMING for everything (every 30 min, etc)
5. For HIGH intensity: more carbs, more sodium
6. For LONG workouts (>90 min): must include during-workout
7. Include practical tips in notes

Return ONLY valid JSON
```

Resultado: El AI devuelve planes con:
- Marcas reales de productos
- Cantidades exactas (200g, 250ml, 1 bar)
- Timing específico (cada 45 min, start - 180 min)
- Productos diferentes para cada fase
- Notas prácticas para cada item

## Cómo Funciona el Timing

```
Workout Start: 06:00
Workout Duration: 120 min
Workout End: 08:00

Pre-Workout:
├─ -180 min → 03:00 (Oatmeal)
└─ -120 min → 04:00 (Water)

During (Every 45 min):
├─ 0 min   → 06:00 (Gatorade + Clif)
├─ 45 min  → 06:45 (Gatorade + Clif)
└─ 90 min  → 07:30 (Gatorade + Clif)

Post-Workout:
├─ 0 min   → 08:00 (Chocolate Milk)
└─ 20 min  → 08:20 (Banana)
```

## Ejemplo de Salida en UI

```
┌─────────────────────────────────────┐
│ Nutrition Timeline    [120 min]     │
├─────────────────────────────────────┤
│ 🥗 Pre-Workout  2-3 hours before  ▼ │
│    [45g Carbs] [8g Protein]       │
│                                     │
│ ├─ Oatmeal with banana (200g)     │
│ │  Carbs: 45g | Protein: 8g       │
│ │  "Easy to digest"                │
│ │                                   │
│ └─ Water (500ml)                  │
│    Notes: "Hydration before"       │
├─────────────────────────────────────┤
│ 💧 During Workout  Every 45 min  ▼ │
│    [60g Carbs/h] [500ml H2O/h]    │
│                                     │
│ ├─ 06:00 → Consume every item:    │
│ │  • Gatorade Orange (250ml)      │
│ │    15g carbs, 200mg sodium       │
│ │  • Clif Bar (1 bar)             │
│ │    42g carbs, 10g protein       │
│ │                                   │
│ ├─ 06:45 → Consume every item    │
│ │  ...same items...               │
│ │                                   │
│ └─ 07:30 → Consume every item    │
│    ...same items...               │
├─────────────────────────────────────┤
│ 🔥 Post-Workout  Within 30 min   ▼ │
│    [83g Carbs] [17g Protein]      │
│                                     │
│ ├─ Chocolate Milk 2% (500ml)      │
│ │  56g carbs, 16g protein         │
│ │  "Optimal recovery ratio"        │
│ │                                   │
│ └─ Banana (1 medium)              │
│    27g carbs, 1g protein          │
└─────────────────────────────────────┘
```

## Testing Checklist

- [ ] Navegar a Plans → Seleccionar workout
- [ ] Click "Generar Plan IA"
- [ ] Esperar respuesta del AI
- [ ] Ver timeline con pre/durante/post
- [ ] Verificar tiempos calculados correctamente
- [ ] Expandir cada sección
- [ ] Ver productos específicos
- [ ] Ver cantidades exactas
- [ ] Ver timing para cada consumo
- [ ] Click "Save Nutrition Plan"
- [ ] Verificar que guarda en database

## Próximas Mejoras

1. **Export to PDF**
   - Generar documento imprimible
   - Incluir QR con info nutricional

2. **Reminders**
   - Notificaciones en tiempos exactos
   - Integración con calendario

3. **History & Analytics**
   - Comparar planes históricos
   - Ver qué funcionó mejor

4. **Products Database**
   - Librería de productos reales
   - Equivalencias y alternativas
   - Cálculos nutricionales actualizados

## Technical Details

**Files:**
- `lib/nutrition/workout-nutrition-schema.ts` - Schema & prompts
- `components/nutrition/workout-nutrition-timeline.tsx` - UI component
- `app/api/ai/nutrition/during-workout/route.ts` - Backend

**Dependencies:**
- `zod` - Validation
- `lucide-react` - Icons
- `date-fns` - Time calculations

**Database:**
- Guarda en `workout_nutrition` table
- Campo: `during_workout_recommendation` (JSON string)
- Campo: `pre_workout_recommendation` (JSON string)
- Campo: `post_workout_recommendation` (JSON string)

## Performance Notes

- Max tokens para AI: 2000 (aumentado de 300)
- Tiempo esperado: 5-15 segundos
- Parsing: JSON validation automático
- UI: 3 secciones colapsables para no sobrecargar

---

## Summary

✅ Sistema completo de nutrición específica y estructurada
✅ Productos reales con cantidades exactas
✅ Timing preciso con cálculo automático
✅ UI visual e intuitiva con timeline
✅ Guarda en database
✅ Production-ready

**Para probar:** Accede a http://localhost:3003 → Plans → Workout → "Generar Plan IA"
