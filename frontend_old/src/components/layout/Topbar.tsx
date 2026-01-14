"use client";

import { useAuth } from "@/hooks/useAuth";
import { useSessionStore } from "@/lib/store/useSessionStore";
import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/lib/store/useSidebarStore";
import { useIsMobile } from "@/hooks/useIsMobile";

export function Topbar() {
  const { user } = useAuth();
  const logout = useSessionStore((s) => s.logout);

  const openMobile = useSidebarStore((s) => s.openMobile);
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        {/* botón hamburguesa solo en mobile */}
        {isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Abrir menú"
            onClick={openMobile}
          >
            {/* Hamburguesa simple con 3 líneas */}
            <span className="flex flex-col justify-between h-3 w-4">
              <span className="block h-[2px] w-full bg-[var(--text-primary)] rounded-sm" />
              <span className="block h-[2px] w-full bg-[var(--text-primary)] rounded-sm" />
              <span className="block h-[2px] w-full bg-[var(--text-primary)] rounded-sm" />
            </span>
          </Button>
        )}

        <div className="text-sm font-medium text-[var(--text-primary)]">
          Dashboard
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        {user && (
          <>
            <div className="hidden sm:flex items-center gap-3">
              <span className="truncate max-w-[140px] text-[var(--text-secondary)]">
                {user.email}
              </span>
              <div className="h-8 w-8 rounded-full bg-primary text-white text-xs flex items-center justify-center font-medium">
                {user.name
                  .split(" ")
                  .map((p) => p[0]?.toUpperCase())
                  .slice(0, 2)
                  .join("")}
              </div>
            </div>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[var(--text-primary)]"
          onClick={logout}
        >
          Salir
        </Button>
      </div>
    </header>
  );
}
