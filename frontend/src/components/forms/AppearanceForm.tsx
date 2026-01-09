"use client";

import { useThemeStore } from "@/lib/store/useThemeStore";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";

export function AppearanceForm() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <form className="space-y-4 max-w-lg">
      <FormField
        id="theme-mode"
        label="Tema de la interfaz"
        hint="El modo oscuro reduce fatiga visual, sobre todo después de entrenar tarde."
      >
        <Select
          value={mode}
          onChange={(e) => setMode(e.target.value as "light" | "dark")}
        >
          <option value="light">Claro</option>
          <option value="dark">Oscuro</option>
        </Select>
      </FormField>

      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
        Esta preferencia se guarda en tu dispositivo.
      </p>
    </form>
  );
}
