"use client";

import { useEffect, useMemo, useState } from "react";
import { generateNutritionPlan, healthCheck, PlanRow } from "@/lib/api";

type BackendStatus = "Not checked" | "Checking..." | "Backend OK ✅" | "Backend error ❌";

export default function HomePage() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("Not checked");
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [weightKg, setWeightKg] = useState<string>("72");
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const weightNumber = Number(weightKg);
  const canSubmit = Boolean(file) && weightNumber > 0 && !isSubmitting;
  const canDownload = rows.length > 0;

  const csvContent = useMemo(() => {
    if (!rows.length) return "";
    const header = ["date","day_type","kcal","protein_g","carbs_g","fat_g","intra_cho_g_per_h"].join(",");
    const lines = rows.map((r) =>
      [r.date, r.day_type, r.kcal, r.protein_g, r.carbs_g, r.fat_g, r.intra_cho_g_per_h].join(",")
    );
    return [header, ...lines].join("\n");
  }, [rows]);

  const handleCheckBackend = async () => {
    setError(null);
    setBackendStatus("Checking...");
    try {
      const data = await healthCheck();
      setBackendStatus(data?.ok ? "Backend OK ✅" : "Backend error ❌");
    } catch (err) {
      setBackendStatus("Backend error ❌");
      setError(err instanceof Error ? err.message : "Failed to reach backend. Is it running?");
    }
  };

  const handleGeneratePlan = async () => {
    if (!file || !canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await generateNutritionPlan({ file, weightKg: weightNumber });
      setRows(response.rows);
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Cooked AI — MVP</h1>
        <p className="text-sm opacity-80">
          Upload <b>workouts_mvp.csv</b>, enter your weight, and generate a nutrition plan.
        </p>
      </header>

      <section className="mt-6 rounded-xl border border-white/10 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={handleCheckBackend}
          >
            Check backend
          </button>
          <span className="text-sm">Status: <b>{backendStatus}</b></span>
        </div>
      </section>

      <section className="mt-6 grid gap-6 rounded-xl border border-white/10 p-6 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-semibold">Upload workouts_mvp.csv</label>
          <input
            type="file"
            accept=".csv"
            className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm"
            onChange={(e) => {
              setRows([]);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold">Weight (kg)</label>
          <input
            type="number"
            min="1"
            step="0.1"
            value={weightKg}
            className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm"
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3 md:col-span-3">
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            onClick={handleGeneratePlan}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Generating..." : "Generate plan"}
          </button>

          <button
            type="button"
            className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:border-white/60 disabled:opacity-40"
            onClick={handleDownload}
            disabled={!canDownload}
          >
            Download CSV
          </button>
        </div>
      </section>

      {error && (
        <section className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/20 text-left text-xs uppercase tracking-wide opacity-80">
              <tr>
                <th className="px-4 py-3">date</th>
                <th className="px-4 py-3">day_type</th>
                <th className="px-4 py-3">kcal</th>
                <th className="px-4 py-3">protein_g</th>
                <th className="px-4 py-3">carbs_g</th>
                <th className="px-4 py-3">fat_g</th>
                <th className="px-4 py-3">intra_cho_g_per_h</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 opacity-70" colSpan={7}>
                    Upload a CSV and generate a plan to see results here.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={`${r.date}-${idx}`}>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.day_type}</td>
                    <td className="px-4 py-3">{r.kcal}</td>
                    <td className="px-4 py-3">{r.protein_g}</td>
                    <td className="px-4 py-3">{r.carbs_g}</td>
                    <td className="px-4 py-3">{r.fat_g}</td>
                    <td className="px-4 py-3">{r.intra_cho_g_per_h}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
