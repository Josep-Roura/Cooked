"use client";

import { useMutation } from "@tanstack/react-query";
import { loginAPI } from "./auth";
import { SessionUser, useSessionStore } from "@/lib/store/useSessionStore";

export function useLoginMutation(opts?: {
  onSuccess?: (user: SessionUser) => void;
  onError?: (err: Error) => void;
}) {
  const setLogin = useSessionStore((s) => s.login);

  const mutation = useMutation<SessionUser, Error, { email: string; password: string }>({
    mutationFn: async (payload) => {
      return loginAPI(payload);
    },
    onSuccess: (user) => {
      // guardamos usuario en sesión global
      setLogin(user);
      opts?.onSuccess?.(user);
    },
    onError: (err) => {
      opts?.onError?.(err);
    }
  });

  return {
    login: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error
  };
}
