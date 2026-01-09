# Accesibilidad base (a11y)

1. Contraste
   - Botón primario (bg-primary + texto blanco) debe tener contraste AA.
   - Texto `text-[var(--text-secondary)]` solo para texto secundario, no para texto crítico.

2. Focus visible
   - Ningún elemento interactivo puede ocultar el focus.
   - Usamos `focus-visible:ring-2` en botones e inputs.

3. Inputs
   - Cada `<Input />` debe tener:
     - un `<FormField />` con `label`
     - `id` único
     - `aria-invalid` cuando hay error
     - `aria-describedby` apuntando a hint o error

4. Teclado
   - `Button` siempre es `<button>`, nunca `<div onClick>`
   - Links de navegación son `<a>`, no `<div>`

5. Diálogos / modales
   - Cuando añadamos modales, tenemos que usar componentes accesibles (shadcn/Dialog o Radix) que gestionen focus-trap correctamente.
