"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProfile } from "./profile";

export function useProfileQuery() {
  const query = useQuery({
    queryKey: ["profile", "me"],
    queryFn: fetchProfile,
    staleTime: 1000 * 30
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error
  };
}
