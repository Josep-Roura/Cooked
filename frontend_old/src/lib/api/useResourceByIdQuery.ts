"use client";

import { useQuery } from "@tanstack/react-query";
import { getResourceByIdAPI, type PlanDetail } from "./resources";

export function useResourceByIdQuery(id: string | undefined) {
  const query = useQuery<PlanDetail | null, Error>({
    queryKey: ["resources", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      return getResourceByIdAPI(id);
    },
    enabled: !!id
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error
  };
}
