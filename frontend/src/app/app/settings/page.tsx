"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tabs";
import { AccountForm } from "@/components/forms/AccountForm";
import { SecurityForm } from "@/components/forms/SecurityForm";
import { AppearanceForm } from "@/components/forms/AppearanceForm";

export default function SettingsPage() {
  const [tab, setTab] = useState<
    "account" | "security" | "appearance" | "notifications"
  >("account");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] leading-tight">
          Ajustes de la cuenta
        </h1>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          Gestiona tu perfil, seguridad, aspecto visual y notificaciones.
        </p>
      </header>

      <Tabs
        tabs={[
          { value: "account", label: "Cuenta" },
          { value: "security", label: "Seguridad" },
          { value: "appearance", label: "Apariencia" },
          { value: "notifications", label: "Notificaciones" }
        ]}
        value={tab}
        onChange={(val) =>
          setTab(
            val as
              | "account"
              | "security"
              | "appearance"
              | "notifications"
          )
        }
      />

      <section className="pt-4">
        {tab === "account" && <AccountForm />}
        {tab === "security" && <SecurityForm />}
        {tab === "appearance" && <AppearanceForm />}
        {tab === "notifications" && (
          <div className="text-sm text-[var(--text-secondary)]">
            Próximamente: resumen diario completo, recordatorios de
            recuperación y alertas de hidratación.
          </div>
        )}
      </section>
    </div>
  );
}
