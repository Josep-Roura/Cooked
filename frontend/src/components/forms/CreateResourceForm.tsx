"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/Alert";
import { Loader } from "@/components/feedback/Loader";

type FormState = {
  title: string;
  description: string;
  category: string;
  visibility: string;
};

export function CreateResourceForm({
  onSubmit,
  isLoading,
  error
}: {
  onSubmit: (data: FormState) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [visibility, setVisibility] = useState("private");

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const titleError =
    touched.title && title.trim().length === 0
      ? "El título es obligatorio."
      : undefined;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // validación mínima
    if (title.trim().length === 0) {
      setTouched((t) => ({ ...t, title: true }));
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      category,
      visibility
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error && (
        <Alert
          variant="error"
          title="No se ha podido crear el recurso"
          description={error}
        />
      )}

      <FormField
        id="title"
        label="Título"
        error={titleError}
      >
        <Input
          placeholder="Ej. Informe semanal IA"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, title: true }))}
          isInvalid={!!titleError}
        />
      </FormField>

      <FormField
        id="description"
        label="Descripción"
        hint="Contexto rápido para ti o tu equipo"
      >
        <Textarea
          placeholder="Resumen corto de qué contiene este recurso..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          id="category"
          label="Categoría"
          hint="Para agrupar y filtrar luego"
        >
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="general">General</option>
            <option value="analisis">Análisis</option>
            <option value="documentacion">Documentación</option>
            <option value="draft">Borrador</option>
          </Select>
        </FormField>

        <FormField
          id="visibility"
          label="Visibilidad"
          hint="¿Quién lo puede ver?"
        >
          <Select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="private">Solo yo</option>
            <option value="team">Mi equipo</option>
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          disabled={isLoading}
          className="min-w-[130px]"
        >
          {isLoading ? (
            <>
              <Loader size="sm" className="mr-2" />
              Creando...
            </>
          ) : (
            "Crear recurso"
          )}
        </Button>
      </div>
    </form>
  );
}
