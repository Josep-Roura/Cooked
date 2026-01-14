"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    getSession().then((s) => {
      if (!mounted) return;
      if (s) {
        try {
          if (typeof window !== "undefined" && window.location.pathname !== "/app") {
            router.replace("/app");
          }
        } catch {
          router.replace("/app");
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-slate-900">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cooked AI</h1>
        <nav className="flex gap-4">
          <Link href="/login" className="text-sm text-slate-700">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <h2 className="text-4xl font-extrabold">
            Daily nutrition, built directly from your training
          </h2>
          <p className="text-slate-600">
            Personalized daily nutrition plans that adapt to your training load
            and help you perform at your best.
          </p>
          <div className="flex gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-medium text-white"
            >
              Get started
            </Link>
            <Link href="/login" className="rounded-md border px-5 py-3 text-sm">
              Sign in
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 p-8">
          <div className="h-64 w-full rounded bg-gradient-to-r from-emerald-400 to-emerald-600" />
        </div>
      </section>

      <section className="mt-12">
        <h3 className="text-2xl font-semibold">How it works</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-6">
            <h4 className="font-semibold">1. Upload</h4>
            <p className="mt-2 text-sm text-slate-600">Upload your training export (TP or MVP CSV).</p>
          </div>
          <div className="rounded-lg border p-6">
            <h4 className="font-semibold">2. Generate</h4>
            <p className="mt-2 text-sm text-slate-600">We compute daily macros based on training load.</p>
          </div>
          <div className="rounded-lg border p-6">
            <h4 className="font-semibold">3. Fuel</h4>
            <p className="mt-2 text-sm text-slate-600">Get actionable meal targets and intra-workout carbs.</p>
          </div>
        </div>
      </section>

      <footer className="mt-16 border-t pt-6 text-sm text-slate-500">
        © {new Date().getFullYear()} Cooked AI
      </footer>
    </main>
  );
}
