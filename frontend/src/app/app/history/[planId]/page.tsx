"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getPlan, PlanDetail } from "@/lib/api";

export default function PlanDetailPage({ params }: { params: { planId: string } }) {
  const router = useRouter();
  const { planId } = params;
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        const token = session?.access_token;
        const p = await getPlan({ planId, token });
        setPlan(p);
      } catch (err: any) {
        setError(err.message || String(err));
      }
    })();
  }, [planId]);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plan {planId}</h1>
        <button onClick={() => router.back()} className="text-sm">Back</button>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      {plan ? (
        <div className="mt-4">
          <div className="text-sm text-slate-500">{plan.start_date} → {plan.end_date}</div>
          <table className="mt-4 min-w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-2 py-1">date</th>
                <th className="px-2 py-1">day_type</th>
                <th className="px-2 py-1">kcal</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((r) => (
                <tr key={r.date}>
                  <td className="px-2 py-1">{r.date}</td>
                  <td className="px-2 py-1">{r.day_type}</td>
                  <td className="px-2 py-1">{r.kcal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 text-slate-500">Loading…</div>
      )}
    </main>
  );
}
