export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const storageKey = "cooked_device_id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }
  // prefer native randomUUID when available, otherwise fallback for Safari
  const generated = typeof crypto !== "undefined" && typeof (crypto as any).randomUUID === "function"
    ? (crypto as any).randomUUID()
    : generateUuidV4();
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

function generateUuidV4(): string {
  // RFC4122 version 4 UUID fallback using crypto.getRandomValues
  if (typeof crypto !== "undefined" && typeof (crypto as any).getRandomValues === "function") {
    const buf = new Uint8Array(16);
    (crypto as any).getRandomValues(buf);
    // Per RFC4122 v4
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const parts = [
      Array.from(buf.slice(0, 4)).map(toHex).join("") ,
      Array.from(buf.slice(4, 6)).map(toHex).join("") ,
      Array.from(buf.slice(6, 8)).map(toHex).join("") ,
      Array.from(buf.slice(8, 10)).map(toHex).join("") ,
      Array.from(buf.slice(10, 16)).map(toHex).join("")
    ];
    return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
  }

  // Last resort: use Math.random (not cryptographically secure)
  const rnd = () => Math.floor(Math.random() * 16).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
