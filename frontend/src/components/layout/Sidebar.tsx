"use client";

import { useSidebarStore } from "@/lib/store/useSidebarStore";
import { cn } from "@/lib/utils";
import { Home, Settings, Folder, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";

export function Sidebar() {
  const {
    isExpanded,
    toggleExpanded,
    mobileVisible,
    closeMobile
  } = useSidebarStore();

  const isMobile = useIsMobile();

  const desktopWidthClass = isExpanded ? "w-56" : "w-16";

  const sidebarInner = (
    <div
      className={cn(
        "flex h-full flex-col bg-surface text-[var(--text-primary)] border-r border-border shadow-md md:shadow-none"
      )}
    >
      <div className="flex h-14 items-center justify-between px-3 border-b border-border">
        <span
          className={cn(
            "font-semibold text-sm transition-opacity",
            !isExpanded && !isMobile && "opacity-0"
          )}
        >
          Cooked-AI
        </span>

        {isMobile ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={closeMobile}
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={toggleExpanded}
            aria-label="Alternar tamaño sidebar"
          >
            {isExpanded ? "<" : ">"}
          </Button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-2 py-2 text-sm">
        <SidebarLink
          href="/app"
          icon={<Home className="h-4 w-4" />}
          label="Dashboard"
          showLabel={isExpanded || isMobile}
        />

        <SidebarLink
          href="/app/resources"
          icon={<Folder className="h-4 w-4" />}
          label="Planes diarios"
          showLabel={isExpanded || isMobile}
        />

        <SidebarLink
          href="/app/settings"
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          showLabel={isExpanded || isMobile}
        />
      </nav>

      <div className="border-t border-border p-3 text-[var(--text-secondary)] text-xs">
        {(isExpanded || isMobile) && <p>Versión 0.0.1</p>}
      </div>
    </div>
  );

  if (isMobile) {
    if (!mobileVisible) return null;

    return (
      <div className="fixed inset-0 z-[200] md:hidden">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={closeMobile}
        />
        <aside
          className={cn(
            "relative z-[201] h-full w-56 max-w-[80%] bg-surface shadow-lg border-r border-border flex flex-col"
          )}
        >
          {sidebarInner}
        </aside>
      </div>
    );
  }

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col md:h-screen md:shrink-0 md:border-r md:border-border md:bg-surface md:text-[var(--text-primary)] md:transition-all md:duration-200",
        desktopWidthClass
      )}
    >
      {sidebarInner}
    </aside>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  showLabel
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  showLabel: boolean;
}) {
  return (
    <a
      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-black/5"
      href={href}
    >
      {icon}
      {showLabel && <span className="truncate">{label}</span>}
    </a>
  );
}
