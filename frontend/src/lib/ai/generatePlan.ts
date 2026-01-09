import { tryGeneratePlanWithOpenAI } from "./generatePlanWithOpenAI";

export type PlanInput = {
  workoutType: string;
  durationMin: number;
  goal: string;
  weightKg: number;
  dietPrefs: string;
  notes: string;
};

export type GeneratedPlan = {
  title: string;
  category: string;
  full_day_plan: {
    preWorkout: {
      timing: string;
      nutrition: string;
      supplements?: string;
      example?: string;
    };
    intraOrImmediatePost: {
      timing: string;
      nutrition: string;
      notes?: string;
    };
    firstMeal: {
      timing: string;
      nutrition: string;
      example?: string;
    };
    snack: {
      timing: string;
      nutrition: string;
      example?: string;
    };
    lunch: {
      timing: string;
      nutrition: string;
      example?: string;
    };
    dinner: {
      timing: string;
      nutrition: string;
      example?: string;
    };
    beforeSleep: {
      timing: string;
      nutrition: string;
      supplements?: string;
      example?: string;
    };
  };
};

/**
 * generatePlanWithAI
 *
 * - Recibe datos sobre el entreno del usuario y su objetivo
 * - Devuelve título + plan nutricional de TODO el día (full_day_plan)
 * - Usa IA (OpenAI u otro) o un fallback deterministic.
 *
 * IMPORTANTE:
 * Debe adaptar:
 *  - goal: "musculo" => más proteína total, recuperación muscular
 *  - goal: "grasa" => control de carbo tarde, snack saciante
 *  - goal: "rendimiento" => recarga glucógeno, sodio, timing muy estricto
 *  - dietPrefs: respetar restricciones (vegano, sin lactosa, etc.)
 */
export async function generatePlanWithAI(
  input: PlanInput
): Promise<GeneratedPlan> {
  const llmPlan = await tryGeneratePlanWithOpenAI(input);
  if (llmPlan) {
    return llmPlan;
  }

  // TODO: sustituir este fallback por prompts más ricos una vez la integración con OpenAI esté estable.

  let title = "Plan diario personalizado";
  if (input.goal === "musculo") {
    title = "Plan diario: ganar músculo y recuperar rápido";
  } else if (input.goal === "grasa") {
    title = "Plan diario: quemar grasa sin perder músculo";
  } else if (input.goal === "rendimiento") {
    title = "Plan diario: máximo rendimiento y recarga";
  }

  const cleanPrefs = input.dietPrefs.toLowerCase();
  const isLactoseFree = cleanPrefs.includes("sin lactosa");
  const isVegan = cleanPrefs.includes("vegano");

  const full_day_plan = {
    preWorkout: {
      timing: "30-45 min antes del entreno",
      nutrition:
        input.goal === "grasa"
          ? "Cafeína + electrolitos + pequeña proteína magra (sin carbo alto)"
          : "Carbo rápido + electrolitos + cafeína controlada",
      supplements:
        input.goal === "musculo"
          ? "3-5g creatina. Beta-alanina si toleras el picor."
          : "Cafeína moderada según tolerancia.",
      example: isLactoseFree
        ? "Bebida vegetal + miel + sal rosa"
        : "Tostada blanca con miel + café + pizca de sal"
    },
    intraOrImmediatePost: {
      timing: "0-30 min después del entreno",
      nutrition:
        input.goal === "grasa"
          ? "20-30g proteína magra + agua con electrolitos. Carbo muy controlado."
          : "40g proteína + 60-80g carbo rápido para reponer glucógeno.",
      notes:
        input.goal === "rendimiento"
          ? "Añadir sodio si sudas mucho. Esto acelera recuperación entre sesiones."
          : "Mantén fácil digestión para no irritar el estómago."
    },
    firstMeal: {
      timing: "60-120 min después",
      nutrition:
        input.goal === "musculo"
          ? "Comida sólida alta en proteína y carbo medio-alto."
          : input.goal === "rendimiento"
          ? "Carbo alto y sal para rellenar depósitos."
          : "Proteína alta + carbo moderado + grasas buenas.",
      example: isVegan
        ? "Arroz + tofu salteado con salsa de soja ligera + aceite de oliva"
        : "Arroz blanco + pollo sin piel + aceite de oliva + sal"
    },
    snack: {
      timing: "Media mañana / merienda",
      nutrition:
        input.goal === "grasa"
          ? "Snack saciante alto en proteína y fibra, carbos bajos."
          : "Proteína + carbo controlado para evitar bajón.",
      example: isLactoseFree
        ? "Yogur vegetal alto en proteína + frutos rojos"
        : "Yogur proteico + fruta"
    },
    lunch: {
      timing: "Comida principal",
      nutrition:
        input.goal === "rendimiento"
          ? "Carbo limpio + proteína completa + verduras + sal."
          : input.goal === "musculo"
          ? "Proteína completa + carbo suficiente + algo de grasa sana."
          : "Proteína magra + verduras + carbo moderado (arroz integral, patata).",
      example: isVegan
        ? "Pasta integral con legumbres + verduras asadas"
        : "Arroz/pasta + fuente de proteína + vegetales."
    },
    dinner: {
      timing: "Cena",
      nutrition:
        input.goal === "grasa"
          ? "Proteína alta, carbo bajo, grasas moderadas para saciedad."
          : input.goal === "musculo"
          ? "Proteína completa + verduras + carbo moderado para recuperación muscular."
          : "Proteína y carbo suficiente para rendir mañana.",
      example: isVegan
        ? "Legumbres + verduras salteadas + aceite de oliva"
        : "Huevos / pescado blanco + verduras + aceite de oliva"
    },
    beforeSleep: {
      timing: "30-60 min antes de dormir",
      nutrition:
        input.goal === "musculo"
          ? "Proteína lenta para recuperación nocturna."
          : "Algo ligero rico en proteínas para sostener músculo sin pasarte.",
      supplements:
        input.goal === "rendimiento"
          ? "Electrolitos si tienes calambres nocturnos."
          : "Magnesio / caseína si duermes mal.",
      example: isLactoseFree
        ? "Batido vegano bajo en carbo lento."
        : "Requesón / queso fresco alto en proteína."
    }
  } as GeneratedPlan["full_day_plan"];

  return {
    title,
    category: input.goal,
    full_day_plan
  };
}
