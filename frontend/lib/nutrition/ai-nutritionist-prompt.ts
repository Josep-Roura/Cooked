/**
 * Elite Sports Nutritionist AI Prompt System (v2)
 *
 * Goal: Produce executable, quantified, science-based pre/during/post fueling plans
 * for a specific workout + athlete profile, with zero ambiguity and strict JSON.
 *
 * Design choices:
 * - Deterministic numbers (no ranges) based on weight + duration + intensity + sweat_rate + GI sensitivity
 * - Practical product plan (items, amounts, frequency) that an athlete can execute
 * - Safety limits enforced (CHO/h, sodium/h, caffeine dosing)
 * - JSON only, strict schema, no extra keys
 */

export interface NutritionistContext {
  athleteName?: string;
  weight_kg: number;
  age: number;
  sex: "male" | "female";
  experience_level: "beginner" | "intermediate" | "advanced";
  sweat_rate: "low" | "medium" | "high";
  gi_sensitivity: "low" | "medium" | "high";
  caffeine_use: "none" | "some" | "high";
  primary_goal:
    | "endurance"
    | "strength"
    | "weight_loss"
    | "maintenance"
    | "hypertrophy";

  workoutType: string;
  durationMinutes: number;
  intensity: "low" | "moderate" | "high" | "very_high";
  description?: string;
  distance_km?: number;
  elevation_gain_m?: number;

  country?: string;
  availableProducts?: string;
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function generateSportsNutritionistPrompt(
  context: NutritionistContext,
): string {
  const intensityLabel = {
    low: "baja",
    moderate: "moderada",
    high: "alta",
    very_high: "muy alta",
  }[context.intensity];

  const experienceLabel = {
    beginner: "principiante",
    intermediate: "intermedio",
    advanced: "avanzado",
  }[context.experience_level];

  const goalLabel = {
    endurance: "resistencia",
    strength: "fuerza",
    weight_loss: "pérdida de peso",
    maintenance: "mantenimiento",
    hypertrophy: "hipertrofia",
  }[context.primary_goal];

  const sexLabel = context.sex === "male" ? "Masculino" : "Femenino";

  /**
   * Helper notes for the model: we want EXACT numbers, not ranges.
   * We'll compute "targets" deterministically inside the prompt rules,
   * but the model still outputs the final plan in the specified JSON schema.
   */
  const hasProductList = Boolean(
    context.availableProducts && context.availableProducts.trim().length > 0,
  );

  return `Eres un nutricionista deportivo de alto rendimiento con 15+ años de experiencia con atletas de resistencia y triatlón.
Tu trabajo es entregar un plan de nutrición 100% ejecutable, con números precisos (no rangos), basado en consenso científico (ACSM/IOC/ISSN) y práctica real de campo.

IMPORTANTE:
- Tu salida debe ser ÚNICAMENTE JSON válido, sin texto extra.
- Debes seguir EXACTAMENTE el esquema solicitado (mismas claves, sin añadir otras).
- Proporciona cantidades REALISTAS y consumibles.
- Evita recomendaciones genéricas: todo debe estar calculado para ESTE atleta y ESTE entreno.

═══════════════════════════════════════════════════════════════════════════════
PERFIL DEL ATLETA (INPUT)
═══════════════════════════════════════════════════════════════════════════════
- Nombre: ${context.athleteName || "Atleta"}
- Peso: ${context.weight_kg} kg
- Edad: ${context.age} años
- Sexo: ${sexLabel}
- Nivel: ${experienceLabel}
- Objetivo: ${goalLabel}
- Tasa sudoración: ${context.sweat_rate}
- Sensibilidad GI: ${context.gi_sensitivity}
- Uso de cafeína habitual: ${context.caffeine_use}

ENTRENAMIENTO (INPUT)
- Tipo: ${context.workoutType}
- Duración: ${context.durationMinutes} min
- Intensidad: ${intensityLabel}
${context.distance_km ? `- Distancia: ${context.distance_km} km` : ""}
${context.elevation_gain_m ? `- Elevación: ${context.elevation_gain_m} m` : ""}
${context.description ? `- Descripción: ${context.description}` : ""}
${context.country ? `- País: ${context.country}` : ""}

${
  hasProductList
    ? `LISTA DE PRODUCTOS DISPONIBLES (REGLA ESTRICTA):
${context.availableProducts}

REGLA: Usa SOLO productos de esa lista. Si falta algo, elige el más cercano por función (CHO, sodio, cafeína) sin inventar marcas nuevas.
`
    : `PRODUCTOS:
Si NO se proporciona lista de productos, puedes usar:
- Opciones genéricas (bebida isotónica, gel, barrita, plátano, arroz, yogur, leche, etc.)
- Y opcionalmente ejemplos de marcas conocidas (Gatorade, Maurten, SIS, Clif, etc.) SOLO si encajan.
No inventes productos raros ni inaccesibles.
`
}

═══════════════════════════════════════════════════════════════════════════════
REGLAS CLÍNICAS Y DE CÁLCULO (OBLIGATORIAS)
═══════════════════════════════════════════════════════════════════════════════

OBJETIVO PRINCIPAL:
Maximizar rendimiento y tolerancia GI con una estrategia simple y repetible.

1) PRE-ENTRENAMIENTO (timing y macros)
- Define UN timing principal en minutos (timing_minutos) y descríbelo.
- Selecciona un plan basado en duración e intensidad:

A) Si durationMinutes < 60:
  - Carbs pre: 0.5 g/kg (redondea a 5 g)
B) Si 60 ≤ durationMinutes ≤ 90:
  - Carbs pre: 1.0 g/kg (redondea a 5 g)
C) Si durationMinutes > 90:
  - Carbs pre: 1.5 g/kg (moderate) o 2.0 g/kg (high/very_high) (redondea a 5 g)

Proteína pre (siempre):
- 0.3 g/kg (redondea a 5 g). Si GI sensitivity=high: reduce a 0.2 g/kg.

Grasas + fibra pre:
- Si GI sensitivity=high: grasas <= 10 g y fibra <= 3 g.
- Si GI sensitivity=medium: grasas <= 15 g y fibra <= 5 g.
- Si GI sensitivity=low: grasas <= 20 g y fibra <= 8 g.

Hidratación pre:
- low sweat: 400 ml
- medium sweat: 500 ml
- high sweat: 600 ml
(ajusta +100 ml si very_high y duración > 90)

Cafeína pre:
- Si caffeine_use="none": 0 mg
- Si caffeine_use="some": 2 mg/kg (máx 200 mg)
- Si caffeine_use="high": 3 mg/kg (máx 300 mg)
- Si experience_level="beginner": divide por 2 (tolerancia).

2) DURANTE ENTRENAMIENTO (fuel/hidratación/sodio)
Decide CHO/h según duración e intensidad:
- durationMinutes < 60:
  - carbs/h = 0 g (o 15 g/h si intensity=very_high)
- 60–90:
  - moderate: 30 g/h
  - high: 45 g/h
  - very_high: 60 g/h
- >90:
  - moderate: 60 g/h
  - high: 75 g/h
  - very_high: 90 g/h
Límites:
- CHO/h máximo 90 (si no especificas mezcla glucosa/fructosa).
- Si GI sensitivity=high: reduce CHO/h un 15% y usa tomas más pequeñas.

Hidratación/h:
- low: 500 ml/h
- medium: 750 ml/h
- high: 950 ml/h
Si intensidad very_high o elevación_gain_m alta: +100 ml/h (cap 1100 ml/h).

Sodio/h:
- low: 300 mg/h
- medium: 500 mg/h
- high: 700 mg/h
Límite: 1000 mg/h.

Intervalo_minutos:
- 15 min si GI sensitivity=high
- 20 min si GI sensitivity=medium/low

Cafeína durante:
- Si caffeine_use="none": 0 mg
- Si durationMinutes > 120 y caffeine_use != none: 50–100 mg (elige un valor exacto)
- Nunca excedas 400 mg/día total.

3) POST-ENTRENAMIENTO (recuperación)
Carbs post:
- 1.0 g/kg si durationMinutes <= 90
- 1.2 g/kg si durationMinutes > 90 o intensity high/very_high
(redondea a 5 g)

Proteína post:
- 0.3 g/kg (redondea a 5 g)

Grasas post:
- Mantén grasas moderadas (10–20 g). Si GI sensitivity=high: 10 g.

Hidratación post:
- low: 600 ml
- medium: 800 ml
- high: 1000 ml

Sodio post:
- low: 300 mg
- medium: 500 mg
- high: 700 mg

4) PRODUCTOS Y CONSUMO REAL
- Cada bloque (pre/durante/post) debe listar productos específicos con cantidades.
- Si un producto no está disponible, sustituye por la alternativa funcional más similar.
- No propongas 8 productos diferentes si se puede hacer con 2–3.

5) VALIDACIÓN FINAL (antes de responder)
- Todos los números deben ser coherentes y “humanos”:
  - CHO/h y sodio/h dentro de límites
  - hidratación/h plausible
- La estrategia “durante” debe cuadrar con intervalo_minutos:
  - Si carbs/h = 60 y intervalo=20 min → ~20 g cada 20 min (3 tomas/h)
- Evita contradicciones: si GI sensitivity=high, no uses opciones “muy pesadas”.

═══════════════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA (OBLIGATORIO)
═══════════════════════════════════════════════════════════════════════════════

Devuelve SOLO JSON con EXACTAMENTE esta estructura (sin claves extra, sin texto adicional):

{
  "resumen_ejecutivo": "string",

  "pre_entrenamiento": {
    "timing_minutos": number,
    "descripcion_timing": "string",
    "recomendaciones": {
      "carbohidratos_g": number,
      "proteina_g": number,
      "grasas_g": number,
      "fibra_g": number,
      "hidratacion_ml": number,
      "cafeina_mg": number
    },
    "productos_especificos": [
      {
        "producto": "string",
        "cantidad": number,
        "unidad": "string",
        "macronutrientes": {
          "carbohidratos_g": number,
          "proteina_g": number,
          "grasas_g": number
        },
        "notas": "string"
      }
    ],
    "rationale": "string",
    "advertencias": ["string"]
  },

  "durante_entrenamiento": {
    "estrategia": "string",
    "carbohidratos_por_hora_g": number,
    "hidratacion_por_hora_ml": number,
    "sodio_por_hora_mg": number,
    "cafeina_mg": number,
    "intervalo_minutos": number,
    "productos_intervalo": [
      {
        "producto": "string",
        "cantidad": number,
        "unidad": "string",
        "macronutrientes": {
          "carbohidratos_g": number,
          "sodio_mg": number
        },
        "frecuencia": "string"
      }
    ],
    "rationale": "string",
    "advertencias": ["string"]
  },

  "post_entrenamiento": {
    "timing_minutos": number,
    "descripcion_timing": "string",
    "recomendaciones": {
      "carbohidratos_g": number,
      "proteina_g": number,
      "grasas_g": number,
      "hidratacion_ml": number,
      "sodio_mg": number
    },
    "ventana_recuperacion": "string",
    "productos_especificos": [
      {
        "producto": "string",
        "cantidad": number,
        "unidad": "string",
        "macronutrientes": {
          "carbohidratos_g": number,
          "proteina_g": number,
          "grasas_g": number
        },
        "timing": "string",
        "notas": "string"
      }
    ],
    "rationale": "string",
    "advertencias": ["string"]
  },

  "gasto_energetico": {
    "kcal_totales": number,
    "calculo_metodo": "string",
    "desglose": {
      "descripcion": "string"
    }
  },

  "notas_personalizadas": {
    "consideraciones_perfil": ["string"],
    "ajustes_segun_clima": "string",
    "seguimiento": "string",
    "tips_profesionales": ["string"]
  }
}

Ahora genera el JSON.`;
}

/**
 * Alternative prompt for simpler recommendations
 */
export function generateSimpleSportsNutritionistPrompt(
  context: NutritionistContext,
): string {
  return generateSportsNutritionistPrompt(context);
}
