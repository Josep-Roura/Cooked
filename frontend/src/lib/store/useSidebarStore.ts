"use client";

import { create } from "zustand";

type SidebarState = {
  /** desktop: barra ancha vs mini */
  isExpanded: boolean;
  toggleExpanded: () => void;

  /** mobile: si el drawer está abierto encima del contenido */
  mobileVisible: boolean;
  openMobile: () => void;
  closeMobile: () => void;
};

export const useSidebarStore = create<SidebarState>((set) => ({
  // En desktop la queremos abierta por defecto
  isExpanded: true,
  toggleExpanded: () =>
    set((s) => ({ isExpanded: !s.isExpanded })),

  // En mobile la barra está oculta por defecto
  mobileVisible: false,
  openMobile: () => set({ mobileVisible: true }),
  closeMobile: () => set({ mobileVisible: false })
}));
