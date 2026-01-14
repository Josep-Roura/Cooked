"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserProfileAPI, type UserProfile } from "./user";

export function useUpdateProfileMutation(opts?: {
  onSuccess?: () => void;
  onError?: (err: Error) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    UserProfile,
    Error,
    { name: string; email: string; language: string }
  >({
    mutationFn: async (payload) => {
      return updateUserProfileAPI(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["user", "profile"]
      });
      opts?.onSuccess?.();
    },
    onError: (err) => {
      opts?.onError?.(err);
    }
  });

  return {
    saveProfile: mutation.mutate,
    isSaving: mutation.isPending,
    error: mutation.error
  };
}
