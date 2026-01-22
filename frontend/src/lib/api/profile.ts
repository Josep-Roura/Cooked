export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  meta: Record<string, unknown> | null;
  name: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  units: "metric" | "imperial" | null;
  primary_goal: string | null;
  experience_level: string | null;
  event: string | null;
  sports: string[] | null;
  workout_time: string | null;
  diet: string | null;
  meals_per_day: number | null;
  cooking_time_min: number | null;
  budget: string | null;
  kitchen: string | null;
  trainingpeaks_connected: boolean | null;
  updated_at: string | null;
};

export type ProfileUpdatePayload = {
  full_name?: string | null;
  avatar_url?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  units?: "metric" | "imperial" | null;
  primary_goal?: string | null;
  experience_level?: string | null;
  event?: string | null;
  sports?: string[] | null;
  workout_time?: string | null;
  diet?: string | null;
  meals_per_day?: number | null;
  cooking_time_min?: number | null;
  budget?: string | null;
  kitchen?: string | null;
  name?: string | null;
  meta?: Record<string, unknown> | null;
  trainingpeaks_connected?: boolean | null;
  email?: string | null;
};

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : "Error inesperado";
    throw new Error(message);
  }

  return (data.profile ?? data) as T;
}

export async function fetchProfile(): Promise<Profile> {
  const res = await fetch("/api/v1/profile/me", {
    method: "GET",
    credentials: "include"
  });

  return parseResponse<Profile>(res);
}

export async function updateProfile(
  payload: ProfileUpdatePayload
): Promise<Profile> {
  const res = await fetch("/api/v1/profile", {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponse<Profile>(res);
}
