import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"

const mockSupabase = () => {
  const responseMap = {
    nutrition_plan_rows: { data: [], error: null },
    nutrition_meals: { data: [], error: null },
    tp_workouts: { data: [], error: null },
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
  process.env.OPENAI_API_KEY = "test-key"
  const fetchMock = mock.method(globalThis, "fetch", async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              days: [
                {
                  date: "2024-04-01",
                  day_type: "rest",
                  daily_targets: {
                    kcal: 2000,
                    protein_g: 150,
                    carbs_g: 200,
                    fat_g: 60,
                    intra_cho_g_per_h: 0,
                  },
                  meals: [
                    {
                      slot: 1,
                      meal_type: "breakfast",
                      time: "08:00",
                      emoji: "🍳",
                      name: "Breakfast",
                      kcal: 500,
                      protein_g: 30,
                      carbs_g: 60,
                      fat_g: 15,
                      recipe: {
                        title: "Oats",
                        servings: 1,
                        ingredients: [{ name: "oats", quantity: 60, unit: "g" }],
                        steps: ["Mix and cook."],
                        notes: "Simple prep.",
                      },
                    },
                  ],
                  rationale: "Recovery-focused day.",
                },
              ],
              rationale: "ok",
            }),
          },
        },
      ],
      usage: { total_tokens: 100 },
    }),
  }))

  mock.module("../../lib/supabase/server", {
    createServerClient: async () => mockSupabase(),
  })

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
  fetchMock.mock.restore()
})
