export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type PlanRow = {
  date: string;
  day_type: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  intra_cho_g_per_h: number;
};

export type PlanResponse = {
  weight_kg: number;
  rows: PlanRow[];
};

export async function healthCheck() {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return res.json();
}

export async function generateNutritionPlan({
  file,
  weightKg,
}: {
  file: File;
  weightKg: number;
}): Promise<PlanResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("weight_kg", String(weightKg));

  const res = await fetch(`${API_BASE}/api/v1/plan/nutrition`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return res.json();
}
