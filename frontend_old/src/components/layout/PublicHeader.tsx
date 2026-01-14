"use client";

import { useSession } from "@/lib/auth/session";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  const { isAuthenticated, ready } = useSession();
  const router = useRouter();

  function goDashboard() {
    router.push("/app");
  }

  function goLogin() {
    router.push("/login");
  }

  return (
    <header className="border-b border-border bg-[var(--surface)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface)]/60">
      <div className="mx-auto max-w-content flex items-center justify-between px-4 py-3">
        {/* Branding */}
        <div className="flex items-baseline gap-2">
          <div className="text-[var(--text-primary)] font-semibold leading-none">
            Cooked-AI
          </div>
          <span className="text-[10px] font-medium text-white bg-primary rounded-full px-2 py-[2px] leading-none select-none">
            Beta
          </span>
        </div>

        {/* CTA derecha */}
        <div>
          {!ready ? null : isAuthenticated ? (
            <Button
              className="text-sm h-auto py-2 px-3"
              onClick={goDashboard}
            >
              Ir al panel
            </Button>
          ) : (
            <Button
              className="text-sm h-auto py-2 px-3"
              variant="ghost"
              onClick={goLogin}
            >
              Entrar
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
