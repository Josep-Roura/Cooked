"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getDeviceId } from "@/lib/device";
import { getPlan, PlanDetail } from "@/lib/api";

export default function PlanDetailPage({
  params
}: {
  params: { planId: string };
}) {
  const [deviceId, setDeviceId] = useState<string>("");
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    const loadPlan = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await getPlan({
          deviceId,
          planId: params.planId
        });
        setPlan(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load plan.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPlan();
  }, [deviceId, params.planId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-100">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Nutrition plan</h1>
          {plan && (
            <p className="text-sm text-slate-400">
              {plan.start_date} → {plan.end_date} · {plan.weight_kg} kg
            </p>
          )}
        </header>

        <div className="flex items-center gap-3">
          <Link
            href="/history"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/30"
          >
            Back to history
          </Link>
        </div>

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
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan={7}>
                      Loading plan...
                    </td>
                  </tr>
                ) : plan?.rows?.length ? (
                  plan.rows.map((row, index) => (
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
                ) : (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan={7}>
                      No rows found for this plan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
