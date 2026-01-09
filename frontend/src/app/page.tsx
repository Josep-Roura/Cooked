"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getDeviceId } from "@/lib/device";
import { generateNutritionPlan, healthCheck, PlanRow } from "@/lib/api";

type BackendStatus = "Not checked" | "Checking..." | "Backend OK ✅";

type SaveStatus = { planId: string | null; saved: boolean };

export default function HomePage() {
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

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  const weightNumber = Number(weightKg);
  const canSubmit = Boolean(file) && weightNumber > 0 && !isSubmitting;
  const canDownload = rows.length > 0;

  const csvContent = useMemo(() => {
    if (!rows.length) {
      return "";
    }
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
        row.kcal,
        row.protein_g,
        row.carbs_g,
        row.fat_g,
        row.intra_cho_g_per_h
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
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reach backend. Is it running?"
      );
    }
  };

  const handleGeneratePlan = async () => {
    if (!file || !canSubmit) {
      return;
    }
    if (!deviceId) {
      setError("Device ID not ready yet. Please try again.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await generateNutritionPlan({
        file,
        weightKg: weightNumber,
        deviceId
      });
      setRows(response.rows);
      setSaveStatus({ planId: response.plan_id, saved: response.saved });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate nutrition plan."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (!csvContent) {
      return;
    }
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nutrition_plan.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-100">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Cooked AI — MVP</h1>
          <p className="text-slate-300">
            Upload workouts_mvp.csv, enter your weight, and generate a nutrition
            plan.
          </p>
          <p className="text-xs text-slate-500">
            Device ID: {deviceId || "Loading..."}
          </p>
        </header>

        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" onClick={handleCheckBackend}>
              Check backend
            </Button>
            <span className="text-sm text-slate-200">{backendStatus}</span>
          </div>
        </section>

        <section className="grid gap-6 rounded-xl border border-white/10 bg-slate-900/60 p-6 shadow-sm md:grid-cols-3">
          <div className="space-y-2 md:col-span-2">
            <label className="block text-sm font-semibold text-slate-200">
              Upload workouts_mvp.csv
            </label>
            <input
              type="file"
              accept=".csv"
              className="w-full rounded-md border border-white/20 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              onChange={(event) => {
                setRows([]);
                setSaveStatus({ planId: null, saved: false });
                setFile(event.target.files?.[0] ?? null);
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-200">
              Weight (kg)
            </label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={weightKg}
              className="w-full rounded-md border border-white/20 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              onChange={(event) => {
                setWeightKg(event.target.value);
              }}
              placeholder="70"
            />
          </div>

          <div className="flex flex-wrap gap-3 md:col-span-3">
            <Button
              type="button"
              onClick={handleGeneratePlan}
              disabled={!canSubmit}
              isLoading={isSubmitting}
            >
              Generate plan
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleDownload}
              disabled={!canDownload}
            >
              Download CSV
            </Button>
            <Link
              href="/history"
              className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/30"
            >
              View history
            </Link>
          </div>
        </section>

        {rows.length > 0 && (
          <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200">
            <p>
              {saveStatus.saved ? "Saved ✅" : "Not saved"} — Plan ID:{" "}
              <span className="break-all text-slate-100">
                {saveStatus.planId ?? "—"}
              </span>
            </p>
          </section>
        )}

        {error && (
          <section className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800 text-left text-xs uppercase tracking-wide text-slate-300">
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
              <tbody className="divide-y divide-white/10 text-slate-200">
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan={7}>
                      Upload a CSV and generate a plan to see results here.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.date}-${index}`}>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">{row.day_type}</td>
                      <td className="px-4 py-3">{row.kcal}</td>
                      <td className="px-4 py-3">{row.protein_g}</td>
                      <td className="px-4 py-3">{row.carbs_g}</td>
                      <td className="px-4 py-3">{row.fat_g}</td>
                      <td className="px-4 py-3">{row.intra_cho_g_per_h}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}