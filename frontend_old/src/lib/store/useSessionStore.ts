"use client";

import { create } from "zustand";

export type SessionUser = {
  name: string;
  email: string;
};

type SessionState = {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null })
}));
