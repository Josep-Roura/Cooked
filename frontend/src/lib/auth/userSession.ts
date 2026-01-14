"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/lib/store/useSessionStore";

const AUTH_KEY = "cookedai_auth";
const USER_ID_KEY = "cookedai_user_id";

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveItem(key: string) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function generateUuid() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback súper simple
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getCurrentUserIdClient(): string {
  const existing = safeGetItem(USER_ID_KEY);
  if (existing) {
    return existing;
  }
  const newId = generateUuid();
  safeSetItem(USER_ID_KEY, newId);
  return newId;
}

function hasCookie(name: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const cookieString = document.cookie;
  if (!cookieString) {
    return false;
  }

  return cookieString.split(";").some((cookie) => {
    return cookie.trim().startsWith(`${name}=`);
  });
}

export function isAuthenticatedClient(): boolean {
  if (safeGetItem(AUTH_KEY) !== "1") {
    return false;
  }

  return hasCookie("cookedai_user_id");
}

export function createDemoLogin(_email: string): { userId: string } {
  const userId = getCurrentUserIdClient();
  safeSetItem(AUTH_KEY, "1");
  // Update session store so client components reflect demo login immediately
  try {
    const login = useSessionStore.getState().login;
    login({ name: "Demo User", email: _email });
  } catch {
    // ignore if store not available
  }
  return { userId };
}

export function logoutDemo(): void {
  safeRemoveItem(AUTH_KEY);
  safeRemoveItem(USER_ID_KEY);
}

// helper opcional por si en algún punto queremos garantizar inicialización en cliente
export function useEnsureUserIdInitialized() {
  useEffect(() => {
    getCurrentUserIdClient();
  }, []);
}
