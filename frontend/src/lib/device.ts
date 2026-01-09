export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const storageKey = "cooked_device_id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const generated = crypto.randomUUID();
  window.localStorage.setItem(storageKey, generated);
  return generated;
}
