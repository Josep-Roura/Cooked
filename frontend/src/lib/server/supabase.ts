/*
SQL MIGRATIONS (documentación)
--------------------------------
-- Table: users
create table if not exists public.users (
  id uuid primary key,
  email text,
  name text,
  language text default 'es',
  two_factor_enabled boolean default false,
  created_at timestamptz default now()
);

-- Table: plans
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text not null,
  category text not null,
  full_day_plan jsonb not null,
  workout_type text,
  duration_min integer,
  goal text,
  weight_kg numeric,
  diet_prefs text,
  notes text,
  created_at timestamptz default now()
);

-- Table: adherence_logs
create table if not exists public.adherence_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete cascade,
  taken boolean not null,
  created_at timestamptz default now()
);

-- Table: weekly_workouts
create table if not exists public.weekly_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  day_index smallint not null,
  start_time text not null,
  end_time text not null,
  session_type text not null,
  intensity text,
  nutrition_json jsonb not null,
  created_at timestamptz default now()
);

-- Table: reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  enabled boolean default true,
  offset_minutes integer default 30,
  created_at timestamptz default now()
);
*/

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type SupabaseRequestOptions = {
  method: HttpMethod;
  table: string;
  searchParams?: URLSearchParams;
  body?: unknown;
  returnRepresentation?: boolean;
  prefer?: string[];
};

export type SupabaseError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type SupabaseResponse<T> = {
  data: T | null;
  error: SupabaseError | null;
};

class SupabaseRestClient {
  async request<T>({
    method,
    table,
    searchParams,
    body,
    returnRepresentation,
    prefer
  }: SupabaseRequestOptions): Promise<SupabaseResponse<T>> {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return {
        data: null,
        error: {
          message:
            "Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
          hint: "TODO: poner credenciales reales aquí",
          code: "config_missing"
        }
      };
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    if (searchParams) {
      searchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    const preferDirectives: string[] = [];
    if (returnRepresentation) {
      preferDirectives.push("return=representation");
    }
    if (prefer?.length) {
      preferDirectives.push(...prefer);
    }
    if (preferDirectives.length > 0) {
      headers["Prefer"] = preferDirectives.join(",");
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });

    if (!response.ok) {
      let errorPayload: any = null;
      try {
        errorPayload = await response.json();
      } catch {
        // ignore
      }

      return {
        data: null,
        error: {
          message: errorPayload?.message ?? response.statusText,
          code: errorPayload?.code ?? String(response.status),
          details: errorPayload?.details,
          hint: errorPayload?.hint
        }
      };
    }

    if (response.status === 204) {
      return { data: null, error: null };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  }

  from<T = unknown>(table: string) {
    return new SupabaseQueryBuilder<T>(this, table);
  }
}

type FilterOperator = "eq" | "gte" | "lte" | "gt" | "lt";

type OrderClause = {
  column: string;
  ascending: boolean;
};

class SupabaseQueryBuilder<T> {
  private filters: Array<{ column: string; operator: FilterOperator; value: string }> = [];
  private orders: OrderClause[] = [];
  private limitValue?: number;

  constructor(private client: SupabaseRestClient, private table: string) {}

  eq(column: string, value: string | number | boolean) {
    this.filters.push({ column, operator: "eq", value: String(value) });
    return this;
  }

  gte(column: string, value: string | number | boolean) {
    this.filters.push({ column, operator: "gte", value: String(value) });
    return this;
  }

  lte(column: string, value: string | number | boolean) {
    this.filters.push({ column, operator: "lte", value: String(value) });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  private buildSearchParams(selectColumns?: string) {
    const params = new URLSearchParams();
    if (selectColumns) {
      params.set("select", selectColumns);
    }

    for (const filter of this.filters) {
      params.append(filter.column, `${filter.operator}.${filter.value}`);
    }

    if (this.orders.length > 0) {
      const orderValue = this.orders
        .map((order) => `${order.column}.${order.ascending ? "asc" : "desc"}`)
        .join(",");
      params.set("order", orderValue);
    }

    if (typeof this.limitValue === "number") {
      params.set("limit", String(this.limitValue));
    }

    return params;
  }

  async select(columns = "*") {
    const params = this.buildSearchParams(columns);
    return this.client.request<T[]>({
      method: "GET",
      table: this.table,
      searchParams: params
    });
  }

  async insert(values: T | T[], options?: { upsert?: boolean }) {
    const prefer: string[] = [];
    if (options?.upsert) {
      prefer.push("resolution=merge-duplicates");
    }

    return this.client.request<T[]>({
      method: "POST",
      table: this.table,
      body: Array.isArray(values) ? values : [values],
      returnRepresentation: true,
      prefer
    });
  }

  async delete() {
    const params = this.buildSearchParams();
    return this.client.request<null>({
      method: "DELETE",
      table: this.table,
      searchParams: params
    });
  }
}

function createClient() {
  return new SupabaseRestClient();
}

export const supabase = createClient();

// TODO: reemplazar por cliente oficial de Supabase (@supabase/supabase-js) cuando se configuren las dependencias reales.
// TODO: poner credenciales reales aquí (variables de entorno en .env.local) para conectarse a la instancia productiva.
