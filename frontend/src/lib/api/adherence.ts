export async function getAdherenceStatsLast7DaysAPI(): Promise<{
  total: number;
  takenCount: number;
  percent: number;
}> {
  const response = await fetch("/api/adherence", { method: "GET" });

  if (!response.ok) {
    return { total: 0, takenCount: 0, percent: 0 };
  }

  try {
    const json = (await response.json()) as {
      ok?: boolean;
      summary?: { total: number; takenCount: number; percent: number };
    };
    if (json?.ok && json.summary) {
      return json.summary;
    }
  } catch {
    // noop
  }

  return { total: 0, takenCount: 0, percent: 0 };
}
