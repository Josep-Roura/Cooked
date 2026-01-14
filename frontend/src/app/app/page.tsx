"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getDeviceId } from "@/lib/device";
import { generateNutritionPlan, healthCheck, PlanRow } from "@/lib/api";
import { getSession, signOut } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { useSession } from "@/lib/auth/session";
import { useSessionStore } from "@/lib/store/useSessionStore";

type BackendStatus = "Not checked" | "Checking..." | "Backend OK ✅";

type SaveStatus = { planId: string | null; saved: boolean };

export default function AppDashboard() {
  const router = useRouter();
  const { ready, isAuthenticated } = useSession();
  const user = useSessionStore((s) => s.user);
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("Not checked");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [weightKg, setWeightKg] = useState<string>("");
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    planId: null,
    saved: false
  });
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setDeviceId(getDeviceId());
    if (!isSupabaseConfigured) {
      if (!ready) return;
      if (!isAuthenticated) {
        router.replace("/login");
        return;
      }
      setEmail(user?.email ?? "demo@cooked.ai");
      return;
    }
    getSession().then((s) => {
      if (!s) {
        router.replace("/login");
      } else {
        setEmail(s.user?.email ?? null);
      }
    });
  }, [isAuthenticated, ready, router, user]);

  const weightNumber = Number(weightKg);
  const canSubmit = Boolean(file) && weightNumber > 0 && !isSubmitting;
  const canDownload = rows.length > 0;

  const csvContent = useMemo(() => {
    if (!rows.length) return "";
    const header = [
      "date",
      "day_type",
      "kcal",
      "protein_g",
      "carbs_g",
      "fat_g",
      "intra_cho_g_per_h"
    ].join(",");
    const lines = rows.map((row) =>
      [
        row.date,
        row.day_type,
        String(row.kcal),
        String(row.protein_g),
        String(row.carbs_g),
        String(row.fat_g),
        String(row.intra_cho_g_per_h)
      ].join(",")
    );
    return [header, ...lines].join("\n");
  }, [rows]);

  const handleCheckBackend = async () => {
    setError(null);
    setBackendStatus("Checking...");
    try {
      await healthCheck(deviceId);
      setBackendStatus("Backend OK ✅");
    } catch (err) {
      setBackendStatus("Not checked");
      setError(err instanceof Error ? err.message : "Failed to reach backend.");
    }
  };

  const handleGeneratePlan = async () => {
    if (!file || !canSubmit) return;
    if (!deviceId) {
      setError("Device ID not ready yet. Please try again.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const session = await getSession();
      const token = session?.access_token ?? undefined;
      const response = await generateNutritionPlan({ file, weightKg: weightNumber, deviceId, token });
      setRows(response.rows);
      setSaveStatus({ planId: response.plan_id, saved: response.saved });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate nutrition plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!csvContent) return;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nutrition_plan.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Cooked — Dashboard</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-300">{email ?? "—"}</div>
          <Button onClick={handleLogout} variant="ghost">Logout</Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="p-4 border rounded bg-slate-900/60">
          <Button onClick={handleCheckBackend}>Check backend</Button>
          <span className="ml-3 text-sm">{backendStatus}</span>
        </div>

        <div className="p-4 border rounded grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium">Upload workouts CSV</label>
            <input type="file" accept=".csv" onChange={(e) => { setRows([]); setSaveStatus({ planId: null, saved: false }); setFile(e.target.files?.[0] ?? null); }} />
          </div>

          <div>
            <label className="block text-sm font-medium">Weight (kg)</label>
            <input type="number" min="1" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" />
          </div>

          <div className="md:col-span-3 flex gap-2">
            <Button onClick={handleGeneratePlan} disabled={!canSubmit} isLoading={isSubmitting}>Generate plan</Button>
            <Button variant="ghost" onClick={handleDownload} disabled={!canDownload}>Download CSV</Button>
            <Link href="/app/history" className="ml-auto">History</Link>
          </div>
        </div>

        {error && <div className="text-red-400">{error}</div>}

        <div className="p-4 border rounded bg-slate-900/60">
          <h2 className="font-medium mb-2">Plan rows</h2>
          {rows.length === 0 ? (
            <div className="text-sm text-slate-400">No rows yet</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">date</th>
                  <th className="text-left">day_type</th>
                  <th className="text-left">kcal</th>
                  <th className="text-left">protein_g</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.date}-${i}`}>
                    <td>{r.date}</td>
                    <td>{r.day_type}</td>
                    <td>{r.kcal}</td>
                    <td>{r.protein_g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
