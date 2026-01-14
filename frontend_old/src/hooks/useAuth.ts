"use client";

import { useSessionStore } from "@/lib/store/useSessionStore";

export function useAuth() {
  const user = useSessionStore((s) => s.user);

  return {
    user,
    isAuthenticated: !!user
  };
}
