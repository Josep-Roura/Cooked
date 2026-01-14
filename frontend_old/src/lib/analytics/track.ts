"use client";

type PlausibleFn = (
  eventName: string,
  // según Plausible, la segunda arg es opcional y puede incluir props
  options?: {
    props?: Record<string, unknown>;
  }
) => void;

/**
 * Extraemos plausible() de window si está disponible.
 * No usamos "any", lo tipamos con PlausibleFn | undefined.
 */
function getPlausible(): PlausibleFn | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    plausible?: PlausibleFn;
  };
  return w.plausible;
}

/**
 * track("plan_created", { category: "musculo" })
 * track("open_generate_plan_modal")
 */
export function track(
  eventName: string,
  props?: Record<string, unknown>
): void {
  const plausible = getPlausible();
  if (!plausible) return; // en dev no hace nada
  if (props) {
    plausible(eventName, { props });
  } else {
    plausible(eventName);
  }
}
