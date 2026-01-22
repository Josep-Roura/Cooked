"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/feedback/Alert";
import { Loader } from "@/components/feedback/Loader";
import { useProfileQuery } from "@/lib/api/useProfileQuery";
import { useProfileUpdateMutation } from "@/lib/api/useProfileUpdateMutation";

const emptyState = {
  fullName: "",
  avatarUrl: "",
  heightCm: "",
  weightKg: "",
  units: "metric",
  primaryGoal: "",
  experienceLevel: "",
  event: "",
  sports: "",
  workoutTime: "",
  diet: "",
  mealsPerDay: "",
  cookingTimeMin: "",
  budget: "",
  kitchen: ""
};

export default function ProfilePage() {
  const { data: profile, isLoading, error } = useProfileQuery();
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState(emptyState);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { updateProfile, isSaving, error: saveError } =
    useProfileUpdateMutation({
      onSuccess: () => {
        setSuccessMsg("Perfil actualizado correctamente.");
        setIsEditing(false);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    });

  useEffect(() => {
    if (!profile || isEditing) return;

    setFormState({
      fullName: profile.full_name ?? "",
      avatarUrl: profile.avatar_url ?? "",
      heightCm: profile.height_cm?.toString() ?? "",
      weightKg: profile.weight_kg?.toString() ?? "",
      units: profile.units ?? "metric",
      primaryGoal: profile.primary_goal ?? "",
      experienceLevel: profile.experience_level ?? "",
      event: profile.event ?? "",
      sports: profile.sports?.join(", ") ?? "",
      workoutTime: profile.workout_time ?? "",
      diet: profile.diet ?? "",
      mealsPerDay: profile.meals_per_day?.toString() ?? "",
      cookingTimeMin: profile.cooking_time_min?.toString() ?? "",
      budget: profile.budget ?? "",
      kitchen: profile.kitchen ?? ""
    });
  }, [profile, isEditing]);

  const displaySports = useMemo(() => {
    if (!profile?.sports?.length) return "—";
    return profile.sports.join(", ");
  }, [profile?.sports]);

  const handleOpenEdit = () => {
    if (profile) {
      setFormState({
        fullName: profile.full_name ?? "",
        avatarUrl: profile.avatar_url ?? "",
        heightCm: profile.height_cm?.toString() ?? "",
        weightKg: profile.weight_kg?.toString() ?? "",
        units: profile.units ?? "metric",
        primaryGoal: profile.primary_goal ?? "",
        experienceLevel: profile.experience_level ?? "",
        event: profile.event ?? "",
        sports: profile.sports?.join(", ") ?? "",
        workoutTime: profile.workout_time ?? "",
        diet: profile.diet ?? "",
        mealsPerDay: profile.meals_per_day?.toString() ?? "",
        cookingTimeMin: profile.cooking_time_min?.toString() ?? "",
        budget: profile.budget ?? "",
        kitchen: profile.kitchen ?? ""
      });
    }
    setFormError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormError(null);
    setIsEditing(false);
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const parsedWeight = formState.weightKg.trim()
      ? Number(formState.weightKg)
      : null;
    if (formState.weightKg.trim() && Number.isNaN(parsedWeight)) {
      setFormError("El peso debe ser numérico.");
      return;
    }

    const parsedHeight = formState.heightCm.trim()
      ? Number(formState.heightCm)
      : null;
    if (formState.heightCm.trim() && Number.isNaN(parsedHeight)) {
      setFormError("La altura debe ser numérica.");
      return;
    }

    const parsedMeals = formState.mealsPerDay.trim()
      ? Number(formState.mealsPerDay)
      : null;
    if (formState.mealsPerDay.trim() && Number.isNaN(parsedMeals)) {
      setFormError("Las comidas por día deben ser numéricas.");
      return;
    }

    const parsedCooking = formState.cookingTimeMin.trim()
      ? Number(formState.cookingTimeMin)
      : null;
    if (formState.cookingTimeMin.trim() && Number.isNaN(parsedCooking)) {
      setFormError("El tiempo de cocción debe ser numérico.");
      return;
    }

    const sportsList = formState.sports
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    updateProfile({
      full_name: formState.fullName.trim() || null,
      avatar_url: formState.avatarUrl.trim() || null,
      height_cm: parsedHeight,
      weight_kg: parsedWeight,
      units: formState.units === "imperial" ? "imperial" : "metric",
      primary_goal: formState.primaryGoal.trim() || null,
      experience_level: formState.experienceLevel.trim() || null,
      event: formState.event.trim() || null,
      sports: sportsList.length ? sportsList : null,
      workout_time: formState.workoutTime.trim() || null,
      diet: formState.diet.trim() || null,
      meals_per_day: parsedMeals,
      cooking_time_min: parsedCooking,
      budget: formState.budget.trim() || null,
      kitchen: formState.kitchen.trim() || null
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Loader />
        <span>Cargando perfil...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        variant="error"
        title="No se ha podido cargar tu perfil"
        description={String(error)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] leading-tight">
          Perfil
        </h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          Revisa tu información personal y ajusta tus preferencias de entrenamiento.
        </p>
      </header>

      {successMsg && (
        <Alert variant="success" title={successMsg} />
      )}

      <Card>
        <CardHeader
          title="Información general"
          description="Estos datos se usan para personalizar tu experiencia."
        />
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Email</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.email ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Nombre completo</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.full_name ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Altura</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.height_cm ? `${profile.height_cm} cm` : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Peso</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.weight_kg ? `${profile.weight_kg} kg` : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Unidades</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.units ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Objetivo principal</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.primary_goal ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Experiencia</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.experience_level ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Evento</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.event ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Deportes</p>
              <p className="text-sm text-[var(--text-primary)]">{displaySports}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Hora de entrenamiento</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.workout_time ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Dieta</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.diet ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Comidas por día</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.meals_per_day ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Tiempo de cocción</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.cooking_time_min
                  ? `${profile.cooking_time_min} min`
                  : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Presupuesto</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.budget ?? "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[var(--text-secondary)]">Cocina</p>
              <p className="text-sm text-[var(--text-primary)]">
                {profile?.kitchen ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-6">
            <Button onClick={handleOpenEdit}>Editar perfil</Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={isEditing}
        onClose={handleCancel}
        title="Editar perfil"
        description="Actualiza tus datos personales y preferencias."
        size="lg"
      >
        <form className="space-y-4" onSubmit={handleSave}>
          {(formError || saveError) && (
            <Alert
              variant="error"
              title="No se ha podido guardar"
              description={formError ?? saveError?.message}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="fullName" label="Nombre completo">
              <Input
                value={formState.fullName}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    fullName: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="avatarUrl" label="Avatar URL">
              <Input
                value={formState.avatarUrl}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    avatarUrl: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="heightCm" label="Altura (cm)">
              <Input
                type="number"
                min={100}
                max={230}
                value={formState.heightCm}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    heightCm: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="weightKg" label="Peso (kg)">
              <Input
                type="number"
                min={20}
                max={250}
                value={formState.weightKg}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    weightKg: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="units" label="Unidades">
              <Select
                value={formState.units}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    units: e.target.value
                  }))
                }
              >
                <option value="metric">Métrico</option>
                <option value="imperial">Imperial</option>
              </Select>
            </FormField>

            <FormField id="primaryGoal" label="Objetivo principal">
              <Input
                value={formState.primaryGoal}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    primaryGoal: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="experienceLevel" label="Nivel de experiencia">
              <Input
                value={formState.experienceLevel}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    experienceLevel: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="event" label="Evento">
              <Input
                value={formState.event}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    event: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="sports" label="Deportes">
              <Input
                placeholder="Ciclismo, running"
                value={formState.sports}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    sports: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="workoutTime" label="Hora de entrenamiento">
              <Input
                value={formState.workoutTime}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    workoutTime: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="diet" label="Dieta">
              <Input
                value={formState.diet}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    diet: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="mealsPerDay" label="Comidas por día">
              <Input
                type="number"
                min={1}
                max={10}
                value={formState.mealsPerDay}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    mealsPerDay: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="cookingTimeMin" label="Tiempo de cocción (min)">
              <Input
                type="number"
                min={0}
                max={600}
                value={formState.cookingTimeMin}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    cookingTimeMin: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="budget" label="Presupuesto">
              <Input
                value={formState.budget}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    budget: e.target.value
                  }))
                }
              />
            </FormField>

            <FormField id="kitchen" label="Cocina">
              <Input
                value={formState.kitchen}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    kitchen: e.target.value
                  }))
                }
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSaving} className="min-w-[140px]">
              Guardar cambios
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
