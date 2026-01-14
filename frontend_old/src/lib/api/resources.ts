export type CreatePlanInput = {
  workoutType: string;
  durationMin: number;
  goal: string;
  weightKg: number;
  dietPrefs: string;
  notes: string;
};

export type PlanSummary = {
  id: string;
  title: string;
  category: string;
  createdAt: string;
};

export type PlanDetail = PlanSummary & {
  fullDayPlan: {
    preWorkout: Section;
    intraOrImmediatePost: Section & { notes?: string };
    firstMeal: Section;
    snack: Section;
    lunch: Section;
    dinner: Section;
    beforeSleep: Section;
  };
  workoutType: string | null;
  durationMin: number | null;
  goal: string | null;
  weightKg: number | null;
  dietPrefs: string | null;
  notes: string | null;
};

type Section = {
  timing: string;
  nutrition: string;
  supplements?: string;
  example?: string;
  notes?: string;
};

type ApiResponse<T> = {
  ok: boolean;
  plan?: T;
  plans?: T;
  summary?: {
    total: number;
    takenCount: number;
    percent: number;
  };
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "Error desconocido";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }

  const json = (await response.json()) as ApiResponse<T>;
  if (!json || json.ok !== true) {
    throw new Error("Respuesta inválida del servidor");
  }

  if ((json as any).plan !== undefined) {
    return (json as any).plan as T;
  }
  if ((json as any).plans !== undefined) {
    return (json as any).plans as T;
  }

  return json as unknown as T;
}

export async function createResourceAPI(
  data: CreatePlanInput
): Promise<PlanSummary> {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  return handleResponse<PlanSummary>(response);
}

export async function listResourcesAPI(): Promise<PlanSummary[]> {
  const response = await fetch("/api/plan", {
    method: "GET"
  });

  return handleResponse<PlanSummary[]>(response);
}

export async function getResourceByIdAPI(
  id: string
): Promise<PlanDetail | null> {
  const response = await fetch(`/api/plan/${id}`, {
    method: "GET"
  });

  try {
    return await handleResponse<PlanDetail>(response);
  } catch (err) {
    if (response.status === 404) {
      return null;
    }
    throw err;
  }
}
