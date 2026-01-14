"use client";

import { useQuery } from "@tanstack/react-query";
import { WeeklyWorkout } from "@/lib/types/training";

type WeeklyPlanResponse = {
  ok: boolean;
  week: WeeklyWorkout[];
};

async function fetchWeeklyPlan(): Promise<WeeklyWorkout[]> {
  const res = await fetch("/api/week");
  if (!res.ok) {
    let message = "No se pudo cargar el plan semanal";
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const json = (await res.json()) as WeeklyPlanResponse;
  return (json.week || []).map((w) => ({
    ...w,
    nutrition: Array.isArray(w.nutrition) ? w.nutrition : []
  }));
}

export function useWeeklyPlanQuery() {
  const query = useQuery<WeeklyWorkout[], Error>({
    queryKey: ["weekly-plan"],
    queryFn: fetchWeeklyPlan,
    staleTime: 1000 * 60
  });

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message,
    refetch: query.refetch,
    isFetching: query.isFetching
  };
}
