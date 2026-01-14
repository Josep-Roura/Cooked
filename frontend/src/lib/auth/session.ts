"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/lib/store/useSessionStore";
import {
  createDemoLogin,
  getCurrentUserIdClient,
  isAuthenticatedClient,
  logoutDemo
} from "@/lib/auth/userSession";

/**
 * Hook de sesión demo basado en localStorage + cookie.
 * Mantiene la interfaz { ready, isAuthenticated, login, logout }.
 */
export function useSession() {
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (user) {
      setIsAuthenticated(true);
      setReady(true);
      return;
    }
    const authed = isAuthenticatedClient();
    if (authed && !user) {
      useSessionStore.getState().login({
        name: "Demo User",
        email: "demo@cooked.ai"
      });
    }
    setIsAuthenticated(authed);
    setReady(true);
  }, [user]);

  const login = useCallback(
    (email: string) => {
      if (typeof window !== "undefined") {
        const { userId } = createDemoLogin(email);
        document.cookie = `cookedai_user_id=${userId}; path=/; max-age=31536000; SameSite=Lax`;
        document.cookie = "cookedai_auth=1; path=/; max-age=31536000; SameSite=Lax";
        getCurrentUserIdClient();
      }
      setIsAuthenticated(true);
      if (!user) {
        useSessionStore.getState().login({
          name: email.split("@")[0] || "Demo User",
          email
        });
      }
      router.replace("/app");
    },
    [router, user]
  );

  const logout = useCallback(() => {
    if (typeof window !== "undefined") {
      logoutDemo();
      document.cookie = "cookedai_auth=; path=/; max-age=0";
      document.cookie = "cookedai_user_id=; path=/; max-age=0";
    }
    setIsAuthenticated(false);
    useSessionStore.getState().logout();
    router.replace("/login");
  }, [router]);

  return {
    ready,
    isAuthenticated,
    login,
    logout
  };
}
