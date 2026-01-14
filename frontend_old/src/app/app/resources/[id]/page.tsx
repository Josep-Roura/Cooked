"use client";

import { useResourceByIdQuery } from "@/lib/api/useResourceByIdQuery";
import { useParams, useRouter } from "next/navigation";
import { Loader } from "@/components/feedback/Loader";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/button";
import { type PlanDetail } from "@/lib/api/resources";

export default function ResourceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error } = useResourceByIdQuery(params?.id);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Loader />
        <span>Cargando plan...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        variant="error"
        title="No se ha podido cargar el plan"
        description={error.message}
      />
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Alert
          variant="error"
          title="Plan no encontrado"
          description="Este plan no existe o ya no está disponible."
        />
        <Button onClick={() => router.push("/app/resources")}>
          Volver al historial
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-xl">
      <header className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="px-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          onClick={() => router.push("/app/resources")}
        >
          ← Volver
        </Button>

        <h1 className="text-xl font-semibold leading-tight text-[var(--text-primary)]">
          {data.title}
        </h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed capitalize">
          Objetivo: {data.category}
        </p>
        <p className="text-[var(--text-secondary)] text-xs">
          {formatDate(data.createdAt)}
        </p>
      </header>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Datos del entreno de referencia
          </h2>
          <ul className="text-sm text-[var(--text-secondary)] leading-relaxed space-y-1">
            {data.workoutType && <li>Sesión: {data.workoutType}</li>}
            {typeof data.durationMin === "number" && (
              <li>Duración: {data.durationMin} min</li>
            )}
            {data.goal && <li>Objetivo declarado: {data.goal}</li>}
            {data.dietPrefs && <li>Preferencias: {data.dietPrefs}</li>}
            {typeof data.weightKg === "number" && (
              <li>Peso de referencia: {data.weightKg} kg</li>
            )}
            {data.notes && <li>Notas: {data.notes}</li>}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Plan nutricional del día
          </h2>
          <div className="space-y-3">
            {buildSections(data).map((section) => (
              <div
                key={section.key}
                className="rounded-md border border-border bg-[var(--surface)] p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-border bg-white/20 px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                      {section.badge}
                    </span>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {section.title}
                    </h3>
                  </div>
                  <span className="text-[var(--text-secondary)] text-[11px] leading-tight text-right">
                    {section.content.timing}
                  </span>
                </div>

                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {section.content.nutrition}
                </p>

                {section.content.example && (
                  <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                    Ejemplo: {section.content.example}
                  </p>
                )}

                {section.content.supplements && (
                  <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                    Suplementación: {section.content.supplements}
                  </p>
                )}

                {section.content.notes && (
                  <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                    Notas: {section.content.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
}

function buildSections(data: PlanDetail) {
  const plan = data.fullDayPlan;
  return [
    { key: "pre", title: "Pre-entreno", badge: "PRE", content: plan.preWorkout },
    {
      key: "post",
      title: "Inmediato post-entreno",
      badge: "POST",
      content: plan.intraOrImmediatePost
    },
    {
      key: "first",
      title: "Primera comida sólida",
      badge: "COMIDA",
      content: plan.firstMeal
    },
    { key: "snack", title: "Snack", badge: "SNACK", content: plan.snack },
    {
      key: "lunch",
      title: "Comida principal",
      badge: "COMIDA",
      content: plan.lunch
    },
    { key: "dinner", title: "Cena", badge: "CENA", content: plan.dinner },
    {
      key: "sleep",
      title: "Antes de dormir",
      badge: "DESCANSO",
      content: plan.beforeSleep
    }
  ];
}
