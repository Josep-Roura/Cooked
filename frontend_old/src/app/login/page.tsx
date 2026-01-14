"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { MotionWrapper } from "@/components/motion-wrapper";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Wrapper page: Suspense around the content that uses `useSearchParams`
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-20 text-[var(--text-secondary)] text-sm">
          Cargando login…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const didRedirect = useRef(false);

  const { login, isAuthenticated, ready } = useSession();

  const [email, setEmail] = useState<string>("");
  const [pwd, setPwd] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const redirectTo = searchParams?.get("redirectTo") || "/app";

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) return;
    if (didRedirect.current) return;

    // compute current path inside the effect to avoid unstable searchParams
    const currentSearch = searchParams?.toString() ?? "";
    const currentPath = currentSearch ? `${pathname}?${currentSearch}` : pathname;
    if (currentPath === redirectTo) return;

    didRedirect.current = true;
    try {
      router.replace(redirectTo);
    } catch {
      // best-effort replace; ignore errors
    }
  }, [ready, isAuthenticated, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    // demo login uses `useSession().login`
    login(email);
  }

  return (
    <MotionWrapper keyId="login-card">
      <div className="max-w-sm mx-auto mt-16 rounded-lg border border-border bg-[var(--surface)] shadow-md p-6 space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-lg font-semibold text-[var(--text-primary)] leading-tight">
            Accede a tu panel
          </h1>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            Genera tu plan diario, registra adherencia y activa recordatorios
            post-entreno.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-[var(--text-primary)] text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="pwd" className="text-[var(--text-primary)] text-sm font-medium">
              Contraseña
            </label>
            <input
              id="pwd"
              type="password"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-[var(--text-primary)] text-sm outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20"
              placeholder="••••••••"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <Button className="w-full" isLoading={loading} disabled={loading} type="submit">
            Entrar
          </Button>
        </form>

        <div className="text-[var(--text-secondary)] text-[11px] leading-relaxed text-center">
          Acceso demo. Pronto podrás iniciar sesión con tu cuenta real o
          conectar TrainingPeaks.
        </div>
      </div>
    </MotionWrapper>
  );
}
