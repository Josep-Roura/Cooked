"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/Alert";
import { Loader } from "@/components/feedback/Loader";

export function CreatePostWorkoutPlanForm({
  onSubmit,
  isLoading,
  error
}: {
  onSubmit: (data: {
    workoutType: string;
    durationMin: number;
    goal: string;
    weightKg: number;
    dietPrefs: string;
    notes: string;
  }) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [workoutType, setWorkoutType] = useState("Fuerza / pesas");
  const [durationMin, setDurationMin] = useState<number>(45);
  const [goal, setGoal] = useState("musculo");
  const [weightKg, setWeightKg] = useState<number>(70);
  const [dietPrefs, setDietPrefs] = useState("");
  const [notes, setNotes] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const durationError =
    touched.durationMin && (Number.isNaN(durationMin) || durationMin <= 0)
      ? "Duración inválida."
      : undefined;

  const weightError =
    touched.weightKg && (Number.isNaN(weightKg) || weightKg <= 0)
      ? "Peso inválido."
      : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // validaciones mínimas
    if (Number.isNaN(durationMin) || durationMin <= 0) {
      setTouched((t) => ({ ...t, durationMin: true }));
      return;
    }
    if (Number.isNaN(weightKg) || weightKg <= 0) {
      setTouched((t) => ({ ...t, weightKg: true }));
      return;
    }

    onSubmit({
      workoutType,
      durationMin,
      goal,
      weightKg,
      dietPrefs,
      notes
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <Alert
          variant="error"
          title="No se ha podido generar el plan diario"
          description={error}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="workoutType"
          label="Tipo de entreno"
          hint="Ej. Fuerza, HIIT, cardio..."
        >
          <Select
            value={workoutType}
            onChange={(e) => setWorkoutType(e.target.value)}
          >
            <option value="Fuerza / pesas">Fuerza / pesas</option>
            <option value="HIIT alta intensidad">HIIT / intensidad alta</option>
            <option value="Cardio resistencia (Z2)">
              Cardio resistencia
            </option>
            <option value="Sesión mixta">Mixto</option>
          </Select>
        </FormField>

        <FormField
          id="durationMin"
          label="Duración (min)"
          hint="Duración total del entreno de hoy"
          error={durationError}
        >
          <Input
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(parseInt(e.target.value, 10))}
            onBlur={() => setTouched((t) => ({ ...t, durationMin: true }))}
            isInvalid={!!durationError}
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="goal"
          label="Objetivo"
          hint="Qué quieres optimizar ahora mismo"
        >
          <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
            <option value="musculo">Ganar músculo</option>
            <option value="grasa">Perder grasa</option>
            <option value="rendimiento">Rendimiento / recuperación</option>
          </Select>
        </FormField>

        <FormField
          id="weightKg"
          label="Peso (kg)"
          hint="Para ajustar ratio proteína/carbohidrato"
          error={weightError}
        >
          <Input
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(parseInt(e.target.value, 10))}
            onBlur={() => setTouched((t) => ({ ...t, weightKg: true }))}
            isInvalid={!!weightError}
          />
        </FormField>
      </div>

      <FormField
        id="dietPrefs"
        label="Preferencias / restricciones"
        hint="Ej. sin lactosa, vegano, halal, sin frutos secos..."
      >
        <Input
          placeholder="Vegano sin soja"
          value={dietPrefs}
          onChange={(e) => setDietPrefs(e.target.value)}
        />
      </FormField>

      <FormField
        id="notes"
        label="Notas opcionales"
        hint="Cómo te sientes tras el entreno, lesiones, fatiga..."
      >
        <Textarea
          placeholder="Estoy reventado de piernas, me cuesta comer sólido ahora mismo"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FormField>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={isLoading}
          className="min-w-[160px]"
        >
          {isLoading ? (
            <>
              <Loader size="sm" className="mr-2" />
              Generando...
            </>
          ) : (
            "Generar plan diario"
          )}
        </Button>
      </div>
    </form>
  );
}
