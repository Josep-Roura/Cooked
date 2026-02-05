import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"

const mockSupabase = () => {
  const responseMap = {
    nutrition_plan_rows: { data: [], error: null },
    nutrition_meals: { data: [], error: null },
    tp_workouts: { data: [], error: null },
    recipes: { data: [], error: null },
    recipe_ingredients: { data: [], error: null },
    recipe_steps: { data: [], error: null },
  }

  const builder = (table) => {
    const chain = {
      __result: responseMap[table] ?? { data: null, error: null },
      then: (resolve) => Promise.resolve(resolve(chain.__result)),
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      or: () => chain,
      in: () => chain,
      maybeSingle: async () => ({ data: table === "profiles" ? { weight_kg: 70, meals_per_day: 3 } : null, error: null }),
      single: async () => ({ data: { weight_kg: 70, meals_per_day: 3 }, error: null }),
      update: () => chain,
      delete: () => chain,
      upsert: async () => ({ error: null }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "req-1" }, error: null }),
        }),
      }),
    }

    return chain
  }

  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: builder,
  }
}

test("POST /api/ai/plan/generate returns ok with valid payload", async () => {
  const supabaseServer = await import("../../lib/supabase/server")
  const mockClient = mockSupabase()
  mock.method(supabaseServer, "createServerClient", async () => mockClient)

  const { POST } = await import("../../app/api/ai/plan/generate/route.ts")
  const req = new NextRequest("http://localhost/api/ai/plan/generate", {
    method: "POST",
    body: JSON.stringify({ start: "2024-04-01", end: "2024-04-01" }),
  })
  const res = await POST(req)
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.equal(json.ok, true)
  assert.equal(json.start, "2024-04-01")
})
