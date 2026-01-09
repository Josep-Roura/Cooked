"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/feedback/Alert";
import { useCreateResourceMutation } from "@/lib/api/useCreateResourceMutation";
import { CreatePostWorkoutPlanForm } from "@/components/forms/CreatePostWorkoutPlanForm";
import { useAdherenceStatsQuery } from "@/lib/api/useAdherenceStatsQuery";
import { useAdherenceMutation } from "@/lib/api/useAdherenceMutation";
import { MotionWrapper } from "@/components/motion-wrapper";
import { track } from "@/lib/analytics/track";
import { WeeklyCalendar } from "@/components/calendar/WeeklyCalendar";
import { useTrainingPeaksConnection } from "@/lib/api/useTrainingPeaksConnection";
import { useListResourcesQuery } from "@/lib/api/useListResourcesQuery";
import { useWeeklyPlanQuery } from "@/lib/api/useWeeklyPlanQuery";
import { useReminderSettings } from "@/lib/api/useReminderSettings";
import { Loader } from "@/components/feedback/Loader";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [openPlanModal, setOpenPlanModal] = useState(false);
  const [openTpModal, setOpenTpModal] = useState(false);
  const [openReminderModal, setOpenReminderModal] = useState(false);

  const [toast, setToast] = useState<
    | {
        message: string;
        variant: "success" | "error";
      }
    | null
  >(null);

  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderOffset, setReminderOffset] = useState(30);

  const [lastCreated, setLastCreated] = useState<
    | {
        id: string;
        title: string;
        category: string;
      }
    | undefined
  >(undefined);

  const { data: planHistory, isLoading: isLoadingHistory } =
    useListResourcesQuery();

  const showToast = useCallback(
    (message: string, variant: "success" | "error") => {
      setToast({ message, variant });
    },
    []
  );

  const {
    settings: reminderSettings,
    isLoading: loadingReminders,
    error: reminderError,
    saveSettings,
    isSaving: isSavingReminder
  } = useReminderSettings();

  useEffect(() => {
    if (planHistory.length === 0) {
      if (lastCreated) {
        setLastCreated(undefined);
      }
      return;
    }

    if (!lastCreated) {
      const newest = planHistory[0];
      setLastCreated({
        id: newest.id,
        title: newest.title,
        category: newest.category
      });
    }
  }, [lastCreated, planHistory]);

  useEffect(() => {
    if (reminderSettings) {
      setReminderEnabled(reminderSettings.enabled);
      setReminderOffset(reminderSettings.offsetMinutes);
    }
  }, [reminderSettings]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const { createResource, isLoading, error } = useCreateResourceMutation({
    onSuccess: (res) => {
      setLastCreated({
        id: res.id,
        title: res.title,
        category: res.category
      });

      // track conversión "plan creado"
      track("plan_created", {
        category: res.category
      });

      setOpenPlanModal(false);
    }
  });

  const { data: adherenceStats } = useAdherenceStatsQuery();

  const { markAdherence, isSaving: isSavingAdherence } =
    useAdherenceMutation();

  function handleGeneratePlan(data: {
    workoutType: string;
    durationMin: number;
    goal: string;
    weightKg: number;
    dietPrefs: string;
    notes: string;
  }) {
    createResource({
      workoutType: data.workoutType,
      durationMin: data.durationMin,
      goal: data.goal,
      weightKg: data.weightKg,
      dietPrefs: data.dietPrefs,
      notes: data.notes
    });
  }

  function handleMark(taken: boolean) {
    if (!lastCreated) return;
    markAdherence(
      {
        planId: lastCreated.id,
        taken
      },
      {
        onSuccess: () => {
          showToast("Guardado ✅", "success");
        },
        onError: (err) => {
          showToast(err.message || "No se pudo guardar", "error");
        }
      }
    );
  }

  function handleOpenPlanModal() {
    setOpenPlanModal(true);
    track("open_generate_plan_modal");
  }

  const {
    data: week,
    loading: loadingWeek,
    error: weekError,
    refetch: refetchWeek,
    isFetching: isFetchingWeek
  } = useWeeklyPlanQuery();

  const handleWeekRefresh = useCallback(() => {
    void refetchWeek();
  }, [refetchWeek]);

  const { connected, isConnecting, connect, error: tpError } =
    useTrainingPeaksConnection({ onSync: handleWeekRefresh });

  function handleConnectTp() {
    void connect();
    // disparo track de intención de integrar TrainingPeaks
    track("tp_connect_clicked");
  }

  function handleOpenReminderConfig() {
    if (reminderSettings) {
      setReminderEnabled(reminderSettings.enabled);
      setReminderOffset(reminderSettings.offsetMinutes);
    }
    setOpenReminderModal(true);
  }

  function handleSaveReminders(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedOffset = Math.max(5, Math.round(reminderOffset || 0));
    setReminderOffset(normalizedOffset);
    saveSettings(
      { enabled: reminderEnabled, offsetMinutes: normalizedOffset },
      {
        onSuccess: (settings) => {
          setOpenReminderModal(false);
          setReminderEnabled(settings.enabled);
          setReminderOffset(settings.offsetMinutes);
          showToast("Recordatorios actualizados ✅", "success");
        },
        onError: (err) => {
          showToast(
            err.message || "No se pudieron guardar los recordatorios",
            "error"
          );
        }
      }
    );
  }

  useEffect(() => {
    if (tpError) {
      showToast(tpError, "error");
    }
  }, [tpError, showToast]);

  const effectiveWeekLoading = loadingWeek || isFetchingWeek;

  return (
    <>
      {/* === BLOQUE SUPERIOR: Acción rápida / Último plan / Adherencia === */}
      <MotionWrapper keyId="dashboard-main">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* Acción rápida */}
          <MotionWrapper keyId="quick-action">
            <Card>
              <CardHeader
                title="Acción rápida"
                description="Genera tu plan diario completo en menos de 10s"
              />
              <CardContent>
                <Button
                  className="w-full"
                  isLoading={isLoading}
                  onClick={handleOpenPlanModal}
                >
                  Generar plan diario
                </Button>
              </CardContent>
            </Card>
          </MotionWrapper>

          {/* Último plan generado */}
          <MotionWrapper keyId="last-plan">
            <Card>
              <CardHeader
                title="Último plan generado"
                description="Resumen de tu recomendación más reciente"
              />
              <CardContent className="space-y-3">
                {isLoadingHistory ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Loader size="sm" />
                    <span>Cargando último plan...</span>
                  </div>
                ) : lastCreated ? (
                  <div className="space-y-3">
                    <Alert
                      variant="success"
                      title="Plan generado correctamente"
                      description={`${lastCreated.title} (${lastCreated.category}) ya está listo.`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="px-0 text-sm font-medium text-[var(--text-primary)] underline underline-offset-4"
                      onClick={() => {
                        window.location.href = `/app/resources/${lastCreated.id}`;
                      }}
                    >
                      Ver plan completo →
                    </Button>
                  </div>
                ) : (
                  <ul className="text-sm leading-relaxed text-[var(--text-secondary)] space-y-1">
                    <li>• Aún no has generado ningún plan hoy</li>
                    <li>• Pulsa “Generar plan diario”</li>
                    <li>• Lo guardaremos en tu historial</li>
                  </ul>
                )}
              </CardContent>
            </Card>
          </MotionWrapper>

          {/* Adherencia semanal */}
          <MotionWrapper keyId="adherence">
            <Card className="md:col-span-2 xl:col-span-1">
              <CardHeader
                title="Tu adherencia (últimos 7 días)"
                description="¿Estás siguiendo tu plan diario como lo prescribe tu objetivo?"
              />
              <CardContent className="space-y-4">
                <AdherenceStatBlock
                  percent={adherenceStats?.percent ?? 0}
                  total={adherenceStats?.total ?? 0}
                  takenCount={adherenceStats?.takenCount ?? 0}
                />

                <AdherenceActionBlock
                  disabled={!lastCreated || isSavingAdherence}
                  onTaken={() => handleMark(true)}
                  onSkipped={() => handleMark(false)}
                />
              </CardContent>
            </Card>
          </MotionWrapper>
        </div>
      </MotionWrapper>

      <MotionWrapper keyId="reminders-card">
        <Card className="mt-8">
          <CardHeader
            title="Recordatorios post-entreno"
            description="Recibe un aviso para tomar tu nutrición crítica tras cada sesión."
          />
          <CardContent className="space-y-3">
            {reminderError && (
              <Alert
                variant="error"
                title="No se pudo cargar la configuración"
                description={reminderError.message}
              />
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {loadingReminders
                  ? "Cargando estado de recordatorios..."
                  : `Recordatorios post-entreno: ${reminderEnabled ? "Activados" : "Desactivados"} · aviso ${reminderOffset} min después del entreno`}
              </div>

              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={handleOpenReminderConfig}
                disabled={loadingReminders}
              >
                Configurar
              </Button>
            </div>
          </CardContent>
        </Card>
      </MotionWrapper>

      {/* === NUEVA SECCIÓN: SINCRONIZACIÓN TRAININGPEAKS + CALENDARIO === */}
      <MotionWrapper keyId="weekly-plan">
        <Card className="mt-8">
          <CardHeader
            title="Plan semanal"
            description={
              connected
                ? "Tus entrenos planificados esta semana y la nutrición recomendada alrededor de cada sesión (pre, post, snacks y recuperación)."
                : "Conecta TrainingPeaks para ver tus entrenos planificados y la nutrición de todo el día alrededor de cada sesión."
            }
          />
          <CardContent className="space-y-4">
            {/* Header de acciones: conectar TrainingPeaks */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[var(--text-secondary)] text-xs leading-relaxed">
                {isConnecting
                  ? "Conectando con TrainingPeaks..."
                  : connected
                  ? "TrainingPeaks conectado ✅"
                  : "Aún no conectado"}
              </div>

              <div className="flex gap-2">
                {!connected ? (
                  <Button
                    className="min-w-[180px]"
                    isLoading={isConnecting}
                    onClick={() => {
                      handleConnectTp();
                      setOpenTpModal(true);
                    }}
                  >
                    Conectar TrainingPeaks
                  </Button>
                ) : (
                  <Button
                    className="min-w-[180px]"
                    variant="ghost"
                    onClick={() => setOpenTpModal(true)}
                  >
                    Ver detalles de sincronización
                  </Button>
                )}
              </div>
            </div>

            {tpError && (
              <Alert
                variant="error"
                title="Error sincronizando TrainingPeaks"
                description={tpError}
              />
            )}

            {/* Calendario semanal */}
            {effectiveWeekLoading ? (
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Loader size="sm" />
                <span>Cargando plan semanal...</span>
              </div>
            ) : week.length > 0 ? (
              <WeeklyCalendar week={week} />
            ) : weekError ? (
              <Alert
                variant="error"
                title="No se pudo cargar tu semana"
                description={weekError}
              />
            ) : (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-[var(--text-secondary)]">
                Aún no tienes sesiones planificadas esta semana.
                <br />
                Conecta TrainingPeaks o añade entrenos manualmente para ver la
                nutrición recomendada alrededor de cada sesión.
              </div>
            )}

            <p className="text-[var(--text-secondary)] text-[11px] leading-relaxed">
              Muy pronto: leeremos automáticamente tus entrenos futuros desde
              TrainingPeaks y generaremos la nutrición de todo el día alrededor
              de cada sesión. No tendrás que pensar qué comer.
            </p>
          </CardContent>
        </Card>
      </MotionWrapper>

      {/* === BLOQUE EDUCATIVO / SIGUIENTE PASO === */}
      <MotionWrapper keyId="next-steps">
        <div className="grid gap-6 md:grid-cols-2 mt-8">
          <Card>
            <CardHeader
              title="Próximos pasos"
              description="Recomendado para sacar más partido a tu plan diario:"
            />
            <CardContent>
              <ol className="list-decimal pl-4 text-sm text-[var(--text-primary)] space-y-2">
                <li>
                  {connected
                    ? "Sincroniza nuevos entrenos desde TrainingPeaks cuando cambie tu planificación"
                    : "Conecta tu cuenta TrainingPeaks"}
                </li>
                <li>Activa los recordatorios post-entreno para no saltarte la ventana crítica.</li>
                <li>Registra si seguiste tu plan diario tras cada entreno (Tomado / Me lo salté).</li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Siguiente entreno"
              description="Cuando acabes tu próxima sesión, vuelve y registra tu adherencia."
            />
            <CardContent className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Después de cada entreno, marca si seguiste el plan diario
              (Tomado / Me lo salté). Con esos datos afinamos las
              recomendaciones y el reparto de macros a lo largo del día.
            </CardContent>
          </Card>
        </div>
      </MotionWrapper>

      {/* === MODAL: CONFIGURAR RECORDATORIOS === */}
      <Modal
        open={openReminderModal}
        onClose={() => setOpenReminderModal(false)}
        title="Configurar recordatorios post-entreno"
        description="Decide si quieres recibir un aviso automático y con cuánto margen tras el entreno."
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleSaveReminders}>
          <div className="flex items-center justify-between rounded-md border border-border bg-[var(--surface)] px-3 py-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Estado
            </span>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {reminderEnabled ? "Activados" : "Desactivados"}
            </label>
          </div>

          <FormField
            id="reminder-offset"
            label="Minutos después del entreno"
            hint="Te avisaremos pasado este tiempo para que tomes la nutrición clave tras entrenar."
          >
            <Input
              type="number"
              min={5}
              step={5}
              value={reminderOffset}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                setReminderOffset(Number.isNaN(parsed) ? 0 : parsed);
              }}
            />
          </FormField>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpenReminderModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSavingReminder}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      {/* === MODAL: CREAR PLAN DIARIO === */}
      <Modal
        open={openPlanModal}
        onClose={() => setOpenPlanModal(false)}
        title="Plan diario personalizado"
        description="Cuéntame tu entreno de hoy y te doy la nutrición completa del día, comida por comida."
        size="md"
      >
        <CreatePostWorkoutPlanForm
          onSubmit={handleGeneratePlan}
          isLoading={isLoading}
          error={error?.message}
        />
      </Modal>

      {/* === MODAL: CONECTAR TRAININGPEAKS / INFO === */}
      <Modal
        open={openTpModal}
        onClose={() => setOpenTpModal(false)}
        title="Conectar TrainingPeaks (beta)"
        description={
          connected
            ? "Ya estás conectado. Pronto sincronizaremos automáticamente tu planning semanal."
            : "Autoriza acceso a tu TrainingPeaks para leer las sesiones de esta semana."
        }
        size="sm"
      >
        <div className="space-y-4 text-sm text-[var(--text-primary)] leading-relaxed">
          {!connected ? (
            <>
              <p>
                Te vamos a pedir permiso para leer tu plan de entrenos. Con esa
                info generaremos tu nutrición personalizada de TODO el día
                alrededor de cada sesión.
              </p>
              <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                Nunca publicamos nada en tu cuenta TrainingPeaks. Sólo leemos.
              </p>
            </>
          ) : (
            <>
              <p>
                Perfecto. Ya podemos usar tus entrenos programados para calcular
                cada comida crítica de la semana.
              </p>
              <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
                Si cambias el plan en TrainingPeaks, lo verás reflejado aquí.
              </p>
            </>
          )}
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] rounded-lg border border-border bg-[var(--surface)] px-4 py-3 shadow-lg">
          <span
            className={`text-sm font-medium ${
              toast.variant === "success"
                ? "text-emerald-500"
                : "text-red-500"
            }`}
          >
            {toast.message}
          </span>
        </div>
      )}
    </>
  );
}

function AdherenceStatBlock({
  percent,
  total,
  takenCount
}: {
  percent: number;
  total: number;
  takenCount: number;
}) {
  return (
    <MotionWrapper keyId="adherence-stats">
      <div>
        <div className="text-3xl font-semibold text-[var(--text-primary)] leading-tight">
          {percent}%
        </div>
        <div className="text-[var(--text-secondary)] text-sm leading-relaxed">
          Adherencia nutricional de tus últimos 7 días.
          <br />
          {takenCount} / {total} planes seguidos.
        </div>
      </div>
    </MotionWrapper>
  );
}

function AdherenceActionBlock({
  disabled,
  onTaken,
  onSkipped
}: {
  disabled: boolean;
  onTaken: () => void;
  onSkipped: () => void;
}) {
  return (
    <MotionWrapper keyId="adherence-actions">
      <div className="space-y-2">
        <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
          ¿Seguiste el último plan diario recomendado?
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1 min-w-[120px]"
            disabled={disabled}
            onClick={onTaken}
          >
            Tomado ✅
          </Button>

          <Button
            className="flex-1 min-w-[120px]"
            variant="ghost"
            disabled={disabled}
            onClick={onSkipped}
          >
            Me lo salté ❌
          </Button>
        </div>

        {disabled && (
          <div className="text-[var(--text-secondary)] text-[11px]">
            Genera primero un plan diario para registrar adherencia.
          </div>
        )}
      </div>
    </MotionWrapper>
  );
}

