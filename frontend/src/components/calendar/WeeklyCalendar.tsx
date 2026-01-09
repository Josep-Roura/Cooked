"use client";

import * as React from "react";
import { WeeklyWorkout } from "@/lib/types/training";
import { cn } from "@/lib/utils";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * WeeklyCalendar
 *
 * Muestra una semana: columnas por día, tarjetas por entreno.
 * Cada entreno enseña su hora, tipo y las recomendaciones de nutrición IA.
 *
 * Más adelante:
 *  - Estos datos vendrán de TrainingPeaks (workouts planificados).
 *  - Las recomendaciones de nutrición vendrán de Cooked-AI.
 */
export function WeeklyCalendar({
  week,
  className
}: {
  week: WeeklyWorkout[];
  className?: string;
}) {
  // agrupamos los entrenos por día
  const byDay: Record<number, WeeklyWorkout[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: []
  };

  week.forEach((w) => {
    byDay[w.day].push(w);
  });

  // Ordenamos dentro del día por hora de inicio
  for (const d of Object.keys(byDay)) {
    byDay[Number(d)].sort((a, b) => (a.start < b.start ? -1 : 1));
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-[var(--surface)] shadow-sm",
        className
      )}
    >
      <div className="min-w-[700px] grid grid-cols-7 divide-x divide-border text-sm">
        {DAYS.map((dayLabel, dayIndex) => (
          <div key={dayLabel} className="p-4 space-y-4">
            {/* header del día */}
            <div className="text-[var(--text-primary)] font-medium leading-tight flex items-baseline justify-between">
              <span>{dayLabel}</span>
              {/* placeholder: en futuro pondremos la fecha concreta (28, 29...) */}
              <span className="text-[var(--text-secondary)] text-[11px]">
                Día {dayIndex + 1}
              </span>
            </div>

            {/* entrenos de ese día */}
            {byDay[dayIndex].length === 0 ? (
              <div className="text-[var(--text-secondary)] text-xs leading-relaxed italic">
                Descanso
              </div>
            ) : (
              byDay[dayIndex].map((workout) => (
                <WorkoutCard key={workout.id} workout={workout} />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkoutCard({ workout }: { workout: WeeklyWorkout }) {
  return (
    <div className="rounded-md border border-border bg-white/60 dark:bg-white/5 shadow-sm p-3 space-y-2">
      {/* Hora + tipo entreno */}
      <div className="flex items-start justify-between">
        <div className="text-[var(--text-primary)] text-[13px] font-semibold leading-tight">
          {workout.type}
        </div>
        <div className="text-[var(--text-secondary)] text-[11px] leading-none text-right">
          {workout.start}–{workout.end}
        </div>
      </div>

      {workout.intensity && (
        <div className="text-[10px] uppercase tracking-wide font-medium inline-block rounded-full px-2 py-[2px] border border-border text-[var(--text-secondary)]">
          Intensidad {labelIntensity(workout.intensity)}
        </div>
      )}

      {/* Nutrición IA asociada */}
      <div className="space-y-2">
        {workout.nutrition.map((block, i) => (
          <div
            key={i}
            className="rounded border border-border bg-[var(--surface)] p-2"
          >
            <div className="text-[10px] font-semibold text-[var(--text-primary)] leading-tight uppercase tracking-wide">
              {block.label}
            </div>
            <div className="text-[var(--text-secondary)] text-[11px] leading-relaxed">
              {block.advice}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelIntensity(intensity: NonNullable<WeeklyWorkout["intensity"]>) {
  if (intensity === "alta") return "ALTA";
  if (intensity === "media") return "MEDIA";
  return "BAJA";
}
