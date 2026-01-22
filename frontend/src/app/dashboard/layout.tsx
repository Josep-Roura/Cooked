"use client";

import { ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppProviders } from "@/components/AppProviders";

export default function DashboardLayout({
  children
}: {
  children: ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (didRedirect.current) return;
      didRedirect.current = true;
      try {
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppProviders>
      <AppLayout>{children}</AppLayout>
    </AppProviders>
  );
}
