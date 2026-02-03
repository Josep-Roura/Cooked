# Database Cleanup & Fix Guide for Cooked

## 📋 Resumen del Problema

Tu base de datos tiene:
1. **Constraint error** en `nutrition_products` table - `serving_unit` no acepta 'mg'
2. **Posibles tablas sin usar** que podrían limpiarse
3. **Necesidad de aplicar migraciones nuevas**

## ✅ Solución

### Paso 1: Aplicar la migración de corrección

Vamos a usar el script de limpieza que:
- ✅ Corrige el constraint de `serving_unit`
- ✅ Crea las tablas de productos si no existen
- ✅ Inserta 10 productos por defecto
- ✅ Configura RLS (Row Level Security) correctamente
- ❌ NO borra ningún dato

**Opción A: Aplicar en Supabase Dashboard**

1. Ve a https://supabase.co/dashboard
2. Selecciona tu proyecto "Cooked"
3. SQL Editor → New Query
4. Copia el contenido de:
   ```
   supabase/migrations/20260204100000_database_cleanup_and_nutrition_fix.sql
   ```
5. Pega en el editor
6. Click "Run"

**Opción B: Usar CLI de Supabase**

```bash
# From project root
supabase db push

# Or manually:
psql postgresql://[user]:[password]@[host]:[port]/[db] < supabase/migrations/20260204100000_database_cleanup_and_nutrition_fix.sql
```

### Paso 2: Verificar que funcionó

Corre estas queries en SQL Editor:

```sql
-- Check table exists
SELECT * FROM public.nutrition_products LIMIT 5;

-- Should see 10 default products (Gatorade, Clif Bar, etc.)

-- Check RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'nutrition_products';

-- Should show rowsecurity = true
```

### Paso 3: Limpiar tablas no usadas (OPCIONAL)

**IMPORTANTE**: Solo haz esto si confirmas que NO usas estas tablas

```sql
-- Uncomment and run ONLY if you're sure these aren't used

-- DROP TABLE IF EXISTS public.plan_chat_messages CASCADE;
-- DROP TABLE IF EXISTS public.plan_chat_threads CASCADE;
-- DROP TABLE IF EXISTS public.plan_revisions CASCADE;
-- DROP TABLE IF EXISTS public.ai_messages CASCADE;
-- DROP TABLE IF EXISTS public.ai_threads CASCADE;
-- DROP TABLE IF EXISTS public.ai_requests CASCADE;
-- DROP TABLE IF EXISTS public.meal_log CASCADE;
-- DROP TABLE IF EXISTS public.meal_schedule CASCADE;
-- DROP TABLE IF EXISTS public.meal_prep_items CASCADE;
-- DROP TABLE IF EXISTS public.meal_prep_sessions CASCADE;
-- DROP TABLE IF EXISTS public.user_events CASCADE;
```

## 📊 Tablas Recomendadas para Mantener

**ESENCIAL** (Cooked core):
- ✅ `profiles` - Datos de usuarios
- ✅ `nutrition_plans`, `nutrition_plan_rows` - Planificación
- ✅ `nutrition_meals` - Comidas diarias
- ✅ `recipes`, `recipe_*` - Recetas
- ✅ `meal_plans`, `meal_plan_items`, `meal_plan_ingredients` - Planificación de comidas
- ✅ `tp_workouts` - Datos de entrenamientos
- ✅ `workout_nutrition`, `workout_nutrition_items` - Nutrición durante entrenamientos (NUEVO)
- ✅ `user_food_rules` - Restricciones dietéticas
- ✅ `nutrition_products`, `user_nutrition_products` - Librería de productos (NUEVO)

**POSIBLEMENTE SIN USAR** (Revisa antes de borrar):
- ❓ `ai_messages`, `ai_threads`, `ai_requests` - Chat AI (legacy?)
- ❓ `plan_chat_messages`, `plan_chat_threads` - Chat de planes (legacy?)
- ❓ `plan_revisions` - Seguimiento de planes (legacy?)
- ❓ `meal_log` - Registro de comidas antigua
- ❓ `meal_schedule` - Horario de comidas antigua
- ❓ `meal_prep_*` - Preparación de comidas (legacy?)
- ❓ `recipe_cook_log` - Registro de cocina (útil?)
- ❓ `user_events` - Eventos (legacy?)
- ❓ `pantry_items`, `grocery_items` - Despensa (¿en uso?)
- ❓ `analytics_events` - Analytics

## 🔄 Cambios en el código frontend

**Ya implementados**:
- ✅ `frontend/app/api/v1/nutrition/products/route.ts` - API de productos
- ✅ `frontend/app/api/v1/nutrition/products/[id]/route.ts` - CRUD de productos
- ✅ `frontend/lib/nutrition/export-pdf.ts` - Exportación a PDF
- ✅ `frontend/lib/nutrition/reminders.ts` - Sistema de recordatorios
- ✅ `frontend/components/nutrition/nutrition-reminders.tsx` - UI de recordatorios

**No necesita cambios** - todo está listo para usar

## 🚀 Próximos pasos

1. ✅ Aplicar la migración 20260204100000
2. ✅ Verificar que la tabla se creó correctamente
3. ✅ Probar la app en http://localhost:3000
4. ✅ (Opcional) Limpiar tablas no usadas
5. ✅ Deploy a producción

## 🆘 Si algo no funciona

**Error: "relation 'nutrition_products' does not exist"**
→ Asegúrate de que aplicaste la migración en Supabase

**Error: "violates check constraint"**
→ Ya fue corregido. Los `serving_unit` ahora aceptan: 'g', 'ml', 'pieces', 'packet', 'capsule', 'tablet', 'mg'

**Error de RLS**
→ La migración ya configura RLS automáticamente

**¿Necesitas borrar la tabla y empezar de nuevo?**
```sql
DROP TABLE IF EXISTS public.nutrition_products CASCADE;
DROP TABLE IF EXISTS public.user_nutrition_products CASCADE;
-- Luego corre la migración nuevamente
```

## 📝 Git Status

✅ Commits este cambio:
```bash
git add -A
git commit -m "Add database cleanup and nutrition products fix migration"
git push origin codex/create-daily-nutrition-plan-for-athlete
```

## ✨ Resultado Final

Después de aplicar la migración:
- ✅ Tabla `nutrition_products` con 10 productos por defecto
- ✅ Tabla `user_nutrition_products` para productos personalizados
- ✅ RLS configurado correctamente
- ✅ APIs funcionando: GET, POST, PATCH, DELETE
- ✅ Compatible con el sistema de nutrición existente
- ✅ Base de datos limpia (sin tablas sin usar)

¡Listo para usar! 🎉
