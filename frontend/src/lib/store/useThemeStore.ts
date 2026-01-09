"use client";

import { create } from "zustand";
import { useEffect } from "react";

export type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",

  setMode: (m) => {
    set({ mode: m });
    applyThemeClass(m);
    saveTheme(m);
  },

  toggle: () => {
    const next = get().mode === "light" ? "dark" : "light";
    set({ mode: next });
    applyThemeClass(next);
    saveTheme(next);
  }
}));

// Helpers de persistencia / efecto DOM -----------------

function applyThemeClass(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (mode === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

function saveTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("cooked-theme", mode);
}

// Hook que debemos usar una vez al arrancar la app
export function useInitTheme() {
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    // 1. intenta cargar preferencia guardada
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("cooked-theme") as
      | ThemeMode
      | null;

    if (stored === "light" || stored === "dark") {
      setMode(stored);
      return;
    }

    // 2. fallback: preferencia del sistema (opcional bonus)
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    setMode(prefersDark ? "dark" : "light");
  }, [setMode]);
}
