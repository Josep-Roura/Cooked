"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfile, type Profile, type ProfileUpdatePayload } from "./profile";

export function useProfileUpdateMutation(opts?: {
  onSuccess?: (profile: Profile) => void;
  onError?: (err: Error) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation<Profile, Error, ProfileUpdatePayload>({
    mutationFn: async (payload) => updateProfile(payload),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      opts?.onSuccess?.(profile);
    },
    onError: (err) => {
      opts?.onError?.(err);
    }
  });

  return {
    updateProfile: mutation.mutate,
    isSaving: mutation.isPending,
    error: mutation.error
  };
}
