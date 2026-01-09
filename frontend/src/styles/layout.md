# Reglas de layout

## AppLayout (zona autenticada)
Estructura:
- Sidebar a la izquierda
- Topbar sticky arriba
- Contenido hace scroll independiente

Esto da sensación de app nativa y mantiene accesibles las acciones principales.

## Ancho máximo
El contenido útil usa `max-w-content = 1280px`, centrado.
No hacer pantallas de 1800px de ancho sin control.

## Responsive
- Sidebar:
  - Desktop: ancho 224px (w-56), colapsable a w-16 solo iconos
  - Mobile/tablet: en el futuro se convierte a drawer
- Tablas:
  - En móvil deben poder convertirse en tarjetas verticales
- Grids:
  - Usar `md:grid-cols-2` y `xl:grid-cols-3` para dashboards tipo cards

## Separación vertical
Estandarizamos:
- Entre bloques grandes de contenido: `space-y-6`
- Dentro de una card: usamos el `<CardHeader />` y `<CardContent />` para que siempre sea consistente

## Scroll
Nunca hacemos que toda la página scrollee si ya hay AppLayout.
El scroll está en el `<section className="flex-1 overflow-y-auto p-4">`.
