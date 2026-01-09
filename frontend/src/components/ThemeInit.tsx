"use client";

import { useInitTheme } from "@/lib/store/useThemeStore";

export function ThemeInit() {
  useInitTheme();
  return null;
}
