"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdherenceStatsLast7DaysAPI } from "./adherence";

export function useAdherenceStatsQuery() {
  const query = useQuery({
    queryKey: ["adherence", "stats7d"],
    queryFn: async () => {
      return getAdherenceStatsLast7DaysAPI();
    },
    staleTime: 1000 * 30 // 30s
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error
  };
}
