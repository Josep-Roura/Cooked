"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { signUp } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Basic client validation
      if (!email || !password) {
        setError("Please provide email and password");
        return;
      }

      const res: any = await signUp(email, password);
      if (!res) {
        setError("Auth not available — check Supabase configuration");
        return;
      }

      if (res.error) {
        const message = res.error.message || String(res.error);
        setError(message);
        return;
      }

      // On successful sign-up (user created) redirect to dashboard.
      // Supabase may not return a session if email confirmation is required;
      // still treat a successful response as registration complete for UX.
      const data = res.data ?? res;
      const user = data?.user ?? null;
      if (user) {
        // Best-effort: create or update a profile row for the new user so
        // frontends can read `full_name`, `email`, etc. Ignore failures.
        try {
          if (supabase) {
            await supabase.from("profiles").upsert({ id: user.id, email }, { returning: "minimal" });
          }
        } catch (err) {
          // ignore profile write errors — registration succeeded regardless
        }

        router.replace("/app");
        return;
      }

      // Fallback: if no explicit user object but no error, go to login check
      router.replace("/login?checkEmail=1");
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex items-center gap-3">
          <Button type="submit" isLoading={loading}>Create account</Button>
          <Link href="/login" className="text-sm">Already have an account?</Link>
        </div>
      </form>
    </main>
  );
}
