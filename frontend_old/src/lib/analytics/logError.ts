"use client";

/**
 * logError
 *
 * Uso recomendado:
 *   logError("createResource failed", err, {
 *     action: "create_plan_post_entreno",
 *     goal: goalSelected
 *   });
 *
 * Esto ahora sólo hace console.error estructurado,
 * pero es un único punto de entrada si luego quieres
 * enviar esto a tu backend o a un webhook.
 */

export function logError(
  message: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  // Permitimos console.error aquí porque es un logger central de errores.
  // Si tu eslint marca no-console, puedes ajustar tu eslint para permitir console.error
  // o desactivar SÓLO esta línea así:
  // eslint-disable-next-line no-console
  console.error("[CookedAI Error]", {
    message,
    error,
    context,
    ts: new Date().toISOString()
  });
}
