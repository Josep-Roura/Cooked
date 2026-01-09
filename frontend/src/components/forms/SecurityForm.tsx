"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/feedback/Alert";
import { Loader } from "@/components/feedback/Loader";
import { useUserProfileQuery } from "@/lib/api/useUserProfileQuery";
import { useUpdateSecurityMutation } from "@/lib/api/useUpdateSecurityMutation";

export function SecurityForm() {
  const { data: profile, isLoading: loadingProfile, error: profileError } =
    useUserProfileQuery();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { saveSecurity, isSaving, error: saveError } =
    useUpdateSecurityMutation({
      onSuccess: () => {
        setSuccessMsg("Seguridad actualizada.");
        setTimeout(() => setSuccessMsg(null), 3000);
        setCurrentPassword("");
        setNewPassword("");
      }
    });

  // Rellenamos el estado inicial del 2FA
  useEffect(() => {
    if (profile) {
        setTwoFactor(!!profile.twoFactorEnabled);
    }
  }, [profile]);


  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);

    saveSecurity({
      currentPassword,
      newPassword,
      twoFactorEnabled: twoFactor
    });
  }

  if (loadingProfile) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Loader />
        <span>Cargando seguridad...</span>
      </div>
    );
  }

  if (profileError) {
    return (
      <Alert
        variant="error"
        title="No se ha podido cargar seguridad"
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

      <FormField
        id="currentPassword"
        label="Contraseña actual"
        hint='Para guardar cambios de seguridad escribe tu contraseña actual (pista demo: "123456").'
      >
        <Input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </FormField>

      <FormField
        id="newPassword"
        label="Nueva contraseña"
        hint="Mínimo 6 caracteres (demo, sin validación real todavía)."
      >
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </FormField>

      <FormField
        id="twoFactor"
        label="Doble factor (2FA)"
        hint="Solicitar un código adicional al iniciar sesión."
      >
        <div className="flex items-center gap-2">
          <input
            id="twoFactor"
            type="checkbox"
            className="h-4 w-4 rounded border border-border accent-primary"
            checked={twoFactor}
            onChange={(e) => setTwoFactor(e.target.checked)}
          />
          <span className="text-sm text-[var(--text-primary)]">
            Activar 2FA
          </span>
        </div>
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
