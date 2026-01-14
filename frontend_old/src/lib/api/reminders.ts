export type ReminderSettings = {
  enabled: boolean;
  offsetMinutes: number;
};

type ReminderResponse = {
  ok: boolean;
  settings: ReminderSettings;
};

async function parseResponse(response: Response): Promise<ReminderSettings> {
  if (!response.ok) {
    let message = "No se pudo cargar la configuración";
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

  const json = (await response.json()) as ReminderResponse;
  if (!json?.ok || !json.settings) {
    throw new Error("Respuesta inválida del servidor");
  }
  return json.settings;
}

export async function getReminderSettingsAPI(): Promise<ReminderSettings> {
  const response = await fetch("/api/reminders");
  return parseResponse(response);
}

export async function saveReminderSettingsAPI(
  settings: ReminderSettings
): Promise<ReminderSettings> {
  const response = await fetch("/api/reminders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(settings)
  });
  return parseResponse(response);
}
