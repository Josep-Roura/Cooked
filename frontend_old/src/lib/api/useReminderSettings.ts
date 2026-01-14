"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getReminderSettingsAPI,
  saveReminderSettingsAPI,
  type ReminderSettings
} from "./reminders";

const QUERY_KEY = ["reminders", "settings"];

export function useReminderSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<ReminderSettings, Error>({
    queryKey: QUERY_KEY,
    queryFn: getReminderSettingsAPI,
    staleTime: 1000 * 60
  });

  const mutation = useMutation<ReminderSettings, Error, ReminderSettings>({
    mutationFn: saveReminderSettingsAPI,
    onSuccess: (settings) => {
      queryClient.setQueryData(QUERY_KEY, settings);
    }
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    saveSettings: mutation.mutate,
    saveAsync: mutation.mutateAsync,
    isSaving: mutation.isPending
  };
}
