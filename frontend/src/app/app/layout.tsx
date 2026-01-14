"use client";

import { ReactNode, useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";

export default function InternalLayout({
  children
}: {
  children: ReactNode;
}) {
  const { isAuthenticated, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, ready, router]);

  if (!ready || !isAuthenticated) {
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
