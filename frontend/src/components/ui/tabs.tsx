"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Tab = {
  value: string;
  label: string;
};

export function Tabs({
  tabs,
  value,
  onChange
}: {
  tabs: Tab[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab) => {
          const isActive = tab.value === value;
          return (
            <button
              key={tab.value}
              className={cn(
                "relative px-3 py-2 text-sm font-medium outline-none",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                isActive && "text-[var(--text-primary)]"
              )}
              onClick={() => onChange(tab.value)}
            >
              {tab.label}
              {isActive && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
