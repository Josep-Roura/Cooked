"use client";

/**
 * Analytics
 *
 * Incrusta el script de Plausible para analítica ligera.
 * Lo cargamos sólo en producción para no ensuciar métricas con tu entorno local.
 *
 * Cambia data-domain="cooked-ai.local" por tu dominio real cuando lo tengas:
 *  - "cooked-ai.vercel.app"
 *  - o tu dominio custom tipo "cooked.ai"
 */

export function Analytics() {
  // Evitamos cargar analytics en dev
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <script
      defer
      data-domain="cooked-ai.local"
      src="https://plausible.io/js/script.js"
    />
  );
}
