import { createServerClient } from "@/lib/supabase/server"

/**
 * Devuelve el userId autenticado a partir de cookies (Supabase SSR).
 * Lanza error si no hay sesión válida.
 */
export async function getUserIdFromRequestOrThrow(_req: Request): Promise<string> {
  const supabase = await createServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) throw new Error("Not authenticated")
  return user.id
}
