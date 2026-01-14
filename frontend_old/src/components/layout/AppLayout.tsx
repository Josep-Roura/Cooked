"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[var(--bg)] text-[var(--text-primary)]">
      <Sidebar />

      <main className={cn("flex flex-1 flex-col min-w-0")}>
        <Topbar />

        <section className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto w-full max-w-content space-y-6">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
