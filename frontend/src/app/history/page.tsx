"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getDeviceId } from "@/lib/device";
import { listPlans, PlanSummary } from "@/lib/api";

export default function HistoryPage() {
  const [deviceId, setDeviceId] = useState<string>("");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  useEffect(() => {
    if (!deviceId) {
      return;
    }

    const loadPlans = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listPlans({ deviceId });
        setPlans(response.plans);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load plans.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPlans();
  }, [deviceId]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-slate-100">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Plan history</h1>
          <p className="text-sm text-slate-400">Device ID: {deviceId}</p>
        </header>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-white/30"
          >
            Back to planner
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
                  <th className="px-4 py-3">created_at</th>
                  <th className="px-4 py-3">date range</th>
                  <th className="px-4 py-3">weight</th>
                  <th className="px-4 py-3">rows</th>
                  <th className="px-4 py-3">filename</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-200">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan={6}>
                      Loading plans...
                    </td>
                  </tr>
                ) : plans.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-slate-400" colSpan={6}>
                      No saved plans yet.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => (
                    <tr key={plan.id}>
                      <td className="px-4 py-3">
                        {new Date(plan.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {plan.start_date} → {plan.end_date}
                      </td>
                      <td className="px-4 py-3">{plan.weight_kg} kg</td>
                      <td className="px-4 py-3">{plan.row_count}</td>
                      <td className="px-4 py-3">
                        {plan.source_filename ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/history/${plan.id}`}
                          className="text-sm text-orange-300 hover:text-orange-200"
                        >
                          Open
                        </Link>
                      </td>
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
