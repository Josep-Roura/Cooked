"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getSession } from "@/lib/auth";
import { listPlans, PlanSummary } from "@/lib/api";

export default function HistoryPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        const token = session?.access_token;
        const res = await listPlans({ token });
        setPlans(res.plans);
      } catch (err: any) {
        setError(err.message || String(err));
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Plans history</h1>
      {error && <div className="text-red-600">{error}</div>}
      <ul className="mt-4 space-y-3">
        {plans.map((p) => (
          <li key={p.id} className="rounded border p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{p.start_date} → {p.end_date}</div>
                <div className="text-sm text-slate-500">{p.row_count} rows · {p.weight_kg} kg</div>
              </div>
              <Link href={`/app/history/${p.id}`} className="text-sm text-emerald-600">View</Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
