"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createResourceAPI,
  type CreatePlanInput,
  type PlanSummary
} from "./resources";

export function useCreateResourceMutation(opts?: {
  onSuccess?: (res: PlanSummary) => void;
  onError?: (err: Error) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation<PlanSummary, Error, CreatePlanInput>({
    mutationFn: async (payload: CreatePlanInput) => {
      return createResourceAPI(payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: ["resources", "list"]
      });
      opts?.onSuccess?.(res);
    },
    onError: (err) => {
      opts?.onError?.(err);
    }
  });

  return {
    createResource: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error
  };
}
