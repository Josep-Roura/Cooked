"use client";

import { useQuery } from "@tanstack/react-query";
import { getUserProfileAPI } from "./user";

export function useUserProfileQuery() {
  const query = useQuery({
    queryKey: ["user", "profile"],
    queryFn: async () => {
      return getUserProfileAPI();
    },
    staleTime: 1000 * 30 // 30s
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error
  };
}
