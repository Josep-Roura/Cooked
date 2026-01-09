"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchTrainingPeaksPreview } from "@/lib/training/fetchTrainingPeaksPreview";

const STORAGE_KEY = "cookedai_trainingpeaks_connected";

type Options = {
  onSync?: () => void;
};

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistConnected(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function useTrainingPeaksConnection(options?: Options) {
  const onSync = options?.onSync;
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConnected(readInitial());
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const preview = await fetchTrainingPeaksPreview();
      const response = await fetch("/api/week", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ workouts: preview })
      });
      if (!response.ok) {
        let message = "No se pudo sincronizar TrainingPeaks";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) {
            message = payload.error;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      setConnected(true);
      persistConnected(true);
      onSync?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error conectando TrainingPeaks";
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, [onSync]);

  return useMemo(
    () => ({
      connected,
      isConnecting,
      connect,
      error
    }),
    [connected, isConnecting, connect, error]
  );
}
