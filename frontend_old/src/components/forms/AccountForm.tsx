"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/Alert";
import { Loader } from "@/components/feedback/Loader";
import { useUserProfileQuery } from "@/lib/api/useUserProfileQuery";
import { useUpdateProfileMutation } from "@/lib/api/useUpdateProfileMutation";

export function AccountForm() {
  const { data: profile, isLoading: loadingProfile, error: profileError } =
    useUserProfileQuery();

  const [localName, setLocalName] = useState("");
  const [localEmail, setLocalEmail] = useState("");
  const [language, setLanguage] = useState("es");

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { saveProfile, isSaving, error: saveError } =
    useUpdateProfileMutation({
      onSuccess: () => {
        setSuccessMsg("Perfil actualizado correctamente.");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    });

  // rellenar inicial cuando llega el perfil
  useEffect(() => {
    if (profile) {
        setLocalName(profile.name ?? "");
        setLocalEmail(profile.email ?? "");
        setLanguage(profile.language ?? "es");
    }
    }, [profile]);



  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);

    saveProfile({
      name: localName,
      email: localEmail,
      language
    });
  }

  if (loadingProfile) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Loader />
        <span>Cargando perfil...</span>
      </div>
    );
  }

  if (profileError) {
    return (
      <Alert
        variant="error"
        title="No se ha podido cargar tu perfil"
        description={String(profileError)}
      />
    );
  }

  return (
    <form className="space-y-4 max-w-lg" onSubmit={handleSubmit}>
      {saveError && (
        <Alert
          variant="error"
          title="No se ha podido guardar"
          description={saveError.message}
        />
      )}

      {successMsg && (
        <Alert
          variant="success"
          title={successMsg}
        />
      )}

      <FormField id="name" label="Nombre">
        <Input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
        />
      </FormField>

      <FormField
        id="email"
        label="Email"
        hint="Este email se usará para notificaciones importantes."
      >
        <Input
          type="email"
          value={localEmail}
          onChange={(e) => setLocalEmail(e.target.value)}
        />
      </FormField>

      <FormField
        id="language"
        label="Idioma"
        hint="Idioma preferido de la interfaz."
      >
        <Select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="es">Español</option>
          <option value="en">Inglés</option>
        </Select>
      </FormField>

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          disabled={isSaving}
          className="min-w-[140px]"
        >
          {isSaving ? (
            <>
              <Loader size="sm" className="mr-2" />
              Guardando...
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </div>
    </form>
  );
}
