# 🔧 Arreglar Base de Datos - Copiar y Pegar

## OPCIÓN 1: Via Supabase Dashboard (Más Seguro)

### Paso 1: Abre Supabase Dashboard
1. Ve a https://supabase.com
2. Abre tu proyecto
3. Ve a "SQL Editor" (en la barra izquierda)

### Paso 2: Copia el SQL siguiente

```sql
-- COMPLETE DATABASE FIX - RECREATE ALL MISSING/BROKEN TABLES

-- ============================================================================
-- FIX 1: ai_requests table
-- ============================================================================
DROP TABLE IF EXISTS public.ai_requests CASCADE;

CREATE TABLE public.ai_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_hash text,
  response_json jsonb NOT NULL,
  error_code text,
  error_message text,
  status text NOT NULL DEFAULT 'pending'::text,
  latency_ms integer,
  prompt_preview text,
  response_preview text,
  tokens integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_requests_pkey PRIMARY KEY (id),
  CONSTRAINT ai_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_requests_user_id ON public.ai_requests (user_id);
CREATE INDEX idx_ai_requests_created_at ON public.ai_requests (created_at);
CREATE INDEX idx_ai_requests_user_created ON public.ai_requests (user_id, created_at);
CREATE INDEX idx_ai_requests_status ON public.ai_requests (status);
CREATE INDEX idx_ai_requests_provider ON public.ai_requests (provider);
CREATE INDEX idx_ai_requests_model ON public.ai_requests (model);

ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_requests_select_own ON public.ai_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY ai_requests_insert_own ON public.ai_requests FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_requests_update_own ON public.ai_requests FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIX 2: plan_revisions table (recreate if missing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plan_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT plan_revisions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS plan_revisions_user_week_start_idx ON public.plan_revisions (user_id, week_start);

ALTER TABLE public.plan_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_revisions_select_own ON public.plan_revisions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY plan_revisions_insert_own ON public.plan_revisions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY plan_revisions_update_own ON public.plan_revisions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY plan_revisions_delete_own ON public.plan_revisions FOR DELETE USING (user_id = auth.uid());
```

### Paso 3: Pega en Supabase
1. Abre una pestaña nueva en SQL Editor
2. Pega el SQL completo
3. Click en "RUN" (botón verde arriba a la derecha)
4. Espera a que termine

### Paso 4: Verifica
Si ves "Success" significa que todo funcionó! 🎉

---

## OPCIÓN 2: Via psql Command Line (Si tienes acceso directo)

```bash
# Conecta a tu base de datos Supabase
psql "postgresql://postgres:PASSWORD@host:5432/postgres"

# Pega el SQL de arriba
# Presiona Enter para ejecutar
```

---

## ✅ Qué hace esta migración

### 🔧 FIX 1: Tabla `ai_requests`
1. **Elimina** la tabla vieja (con columnas duplicadas)
2. **Crea** una nueva con el esquema correcto:
   - ✅ `tokens` (sin `tokens_used` duplicado)
   - ✅ `prompt_preview` (para resumen de prompts)
   - ✅ `response_preview` (para resumen de respuestas)
   - ✅ `latency_ms` (para métricas de rendimiento)
3. **Crea indexes** para búsquedas rápidas
4. **Habilita RLS** (Row-Level Security) para seguridad

### 🔧 FIX 2: Tabla `plan_revisions` (faltaba)
1. **Crea** la tabla que fue deletreada pero aún es usada por el código
   - ✅ `id`, `user_id`, `week_start`, `week_end`, `diff`
2. **Crea indexes** para búsquedas por usuario y fecha
3. **Habilita RLS** con 4 políticas (select, insert, update, delete)

---

## 🚨 IMPORTANTE

- **Backup**: Si tienes datos importantes, hazle backup primero (especialmente `ai_requests`)
- **Pérdida de datos**: Esta migración BORRA los datos viejos de `ai_requests` pero CREA `plan_revisions` nueva (vacía)
- **Tiempo**: Toma menos de 1 segundo
- **plan_revisions**: Si no existe, será creada. Si existe, se preserva.

---

## 📝 Después de ejecutar

Tu aplicación ahora podrá:
- ✅ Guardar logs de AI requests sin errores ("Could not find column")
- ✅ Guardar revisiones de planes sin errores ("Could not find table plan_revisions")
- ✅ Usar todas las columnas necesarias (tokens, prompt_preview, response_preview, latency_ms)
- ✅ Funcionar correctamente con los endpoints:
  - `/api/ai/plan/generate` - genera planes y guarda revisiones
  - `/api/ai/nutrition/during-workout` - guarda logs de AI requests
  - `/api/v1/ai/status` - lee histórico de AI requests

---

## 🐛 Si tienes errores

### Error: "Table already exists"
No importa - el `DROP TABLE IF EXISTS` lo maneja

### Error: "user_id foreign key constraint"
Significa que `auth.users` no existe - contacta con Supabase

### Error: "Permission denied"
Necesitas acceso admin a la base de datos
