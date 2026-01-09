"use client";

import { Button } from "@/components/ui/button";

export default function MarketingLandingPage() {
  return (
    <section className="mx-auto max-w-content px-4 py-16 flex flex-col gap-16 text-[var(--text-primary)]">
      {/* Hero */}
      <header className="grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Tu plan diario nutricional,
            <br className="hidden sm:block" />
            optimizado por IA en 10 segundos.
          </h1>

          <p className="text-[var(--text-secondary)] text-base leading-relaxed max-w-lg">
            Cooked-AI analiza tu entreno, objetivo y preferencias para darte la
            nutrición completa de TODO el día: qué tomar antes, justo después,
            snacks, comidas principales y cena.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="h-11 px-5 text-base font-medium"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Probar la demo
            </Button>

            <Button
              variant="ghost"
              className="h-11 px-5 text-base font-medium text-[var(--text-primary)]"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              Entrar a mi panel →
            </Button>
          </div>

          <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
            Sin tarjetas. Sólo responde a 5 preguntas sobre tu entreno de hoy.
          </p>
        </div>

        {/* Mini "screenshot" estilo preview del dashboard */}
        <div className="relative rounded-lg border border-border bg-surface shadow-lg p-4 text-sm max-w-md w-full mx-auto">
          <div className="text-xs text-[var(--text-secondary)] mb-2">
            Último plan diario generado
          </div>

          <div className="rounded-lg border border-border bg-white/60 dark:bg-white/5 p-4 shadow-sm">
            <div className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
              Plan diario: ganar músculo y recuperar rápido
            </div>
            <div className="text-[var(--text-secondary)] text-xs leading-relaxed mt-1">
              Objetivo: ganar músculo
            </div>

            <ul className="mt-4 space-y-3 text-[var(--text-primary)] text-sm">
              <li className="rounded-md border border-border bg-surface p-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  PRE · 30 min antes
                </div>
                Carbo rápido + electrolitos + 200mg cafeína ligera.
              </li>
              <li className="rounded-md border border-border bg-surface p-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  POST · 0-30 min
                </div>
                Batido 40g whey + 70g arroz/jugo + sodio extra si sudaste mucho.
              </li>
              <li className="rounded-md border border-border bg-surface p-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  COMIDA · 60-90 min
                </div>
                Arroz blanco + pollo + aceite de oliva + verduras fáciles.
              </li>
              <li className="rounded-md border border-border bg-surface p-3">
                <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  CENA · Antes de dormir
                </div>
                Huevos + verduras salteadas + caseína suave para la noche.
              </li>
            </ul>
          </div>

          <div className="absolute -inset-1 -z-10 blur-2xl opacity-30 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.4),transparent_70%)] pointer-events-none" />
        </div>
      </header>

      {/* Beneficios rápidos */}
      <section className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <FeatureCard
          title="Recupera mejor"
          desc="Evita perder músculo y baja la inflamación planificando cada comida crítica del día."
        />
        <FeatureCard
          title="Tu objetivo, no genérico"
          desc="Músculo, déficit o rendimiento. Adaptamos pre, post, snacks y cena a lo que necesitas."
        />
        <FeatureCard
          title="Sin pensar"
          desc="Sales del gym y sabes qué comer el resto del día en 10 segundos."
        />
      </section>

      {/* CTA final */}
      <footer className="text-center space-y-4">
        <div className="text-xl font-semibold leading-tight">
          ¿Entrenas? Te decimos qué comer en todo tu día.
        </div>
        <Button
          className="h-11 px-5 text-base font-medium"
          onClick={() => {
            window.location.href = "/login";
          }}
        >
          Ir a la demo →
        </Button>
        <div className="text-[var(--text-secondary)] text-xs leading-relaxed max-w-md mx-auto">
          Beta privada. Algunas recomendaciones pueden variar según
          tolerancias personales. Consulta a un profesional si tienes
          condiciones médicas.
        </div>
      </footer>
    </section>
  );
}

function FeatureCard({
  title,
  desc
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
        {title}
      </div>
      <div className="text-[var(--text-secondary)] text-sm leading-relaxed mt-2">
        {desc}
      </div>
    </div>
  );
}
