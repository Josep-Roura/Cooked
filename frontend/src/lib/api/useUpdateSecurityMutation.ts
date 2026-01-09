"use client";

import { useMutation } from "@tanstack/react-query";
import { updateUserSecurityAPI } from "./user";

export function useUpdateSecurityMutation(opts?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  const mutation = useMutation<
    { success: true },
    Error,
    { currentPassword: string; newPassword: string; twoFactorEnabled: boolean }
  >({
    mutationFn: async (payload) => {
      return updateUserSecurityAPI(payload);
    },
    onSuccess: () => {
      opts?.onSuccess?.();
    },
    onError: (err) => {
      opts?.onError?.(err);
    }
  });

  return {
    saveSecurity: mutation.mutate,
    isSaving: mutation.isPending,
    error: mutation.error
  };
}
