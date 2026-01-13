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
  plan_id: string | null;
  saved: boolean;
  weight_kg: number;
  rows: PlanRow[];
};

export type PlanSummary = {
  id: string;
  created_at: string;
  start_date: string;
  end_date: string;
  weight_kg: number;
  source_filename: string | null;
  row_count: number;
};

export type PlanDetail = PlanSummary & { rows: PlanRow[] };

const buildHeaders = (opts?: { deviceId?: string; token?: string }) => {
  const headers: Record<string, string> = {};
  if (opts?.deviceId) headers["x-device-id"] = opts.deviceId;
  if (opts?.token) headers["Authorization"] = `Bearer ${opts.token}`;
  return headers;
};

export async function healthCheck(deviceId: string) {
  const res = await fetch(`${API_BASE}/health`, {
    cache: "no-store",
    headers: buildHeaders({ deviceId })
  });
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
  return res.json();
}

export async function generateNutritionPlan({
  file,
  weightKg,
  deviceId,
  token
}: {
  file: File;
  weightKg: number;
  deviceId?: string;
  token?: string;
}): Promise<PlanResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("weight_kg", String(weightKg));

  const res = await fetch(`${API_BASE}/api/v1/plan/nutrition`, {
    method: "POST",
    body: formData,
    headers: buildHeaders({ deviceId, token })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function listPlans({
  deviceId,
  token,
  limit = 20,
  offset = 0
}: {
  deviceId?: string;
  token?: string;
  limit?: number;
  offset?: number;
}): Promise<{ plans: PlanSummary[]; limit: number; offset: number }> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset)
  });

  const res = await fetch(`${API_BASE}/api/v1/plans?${params.toString()}`, {
    headers: buildHeaders({ deviceId, token }),
    cache: "no-store"
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return res.json();
}

export async function getPlan({
  deviceId,
  token,
  planId
}: {
  deviceId?: string;
  token?: string;
  planId: string;
}): Promise<PlanDetail> {
  const res = await fetch(`${API_BASE}/api/v1/plans/${planId}`, {
    headers: buildHeaders({ deviceId, token }),
    cache: "no-store"
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return res.json();
}
