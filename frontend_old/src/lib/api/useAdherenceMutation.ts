"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

async function postAdherence(payload: { planId: string; taken: boolean }) {
  const response = await fetch("/api/adherence", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = "No se pudo registrar la adherencia";
    try {
      const json = (await response.json()) as { error?: string };
      if (json?.error) message = json.error;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  return response.json();
}

export function useAdherenceMutation() {
  const qc = useQueryClient();

  const mutation = useMutation<
    unknown,
    Error,
    { planId: string; taken: boolean }
  >({
    mutationFn: postAdherence,
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["adherence", "stats7d"]
      });
    }
  });

  return {
    markAdherence: mutation.mutate,
    isSaving: mutation.isPending,
    error: mutation.error
  };
}
