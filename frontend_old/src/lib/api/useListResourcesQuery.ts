"use client";

import { useQuery } from "@tanstack/react-query";
import { listResourcesAPI, type PlanSummary } from "./resources";

export function useListResourcesQuery() {
  const query = useQuery<PlanSummary[], Error>({
    queryKey: ["resources", "list"],
    queryFn: async () => {
      return listResourcesAPI();
    },
    staleTime: 1000 * 30
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error
  };
}
