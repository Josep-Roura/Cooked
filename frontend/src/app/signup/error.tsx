"use client";

import React from "react";
import Link from "next/link";

export default function SignupError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="mt-4 text-sm text-red-600">{String(error?.message ?? "Error inesperado")}</p>
      <div className="mt-4 flex gap-3">
        <button onClick={() => reset()} className="rounded bg-gray-200 px-3 py-2">Reintentar</button>
        <Link href="/" className="text-sm underline">Volver al inicio</Link>
      </div>
    </main>
  );
}
