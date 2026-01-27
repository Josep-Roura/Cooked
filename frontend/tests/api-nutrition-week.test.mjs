import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"

const mockSupabase = () => {
  const builder = (table) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
    }

    if (table === "nutrition_plan_rows") {
      chain.select = () => ({
        eq: () => ({
          gte: () => ({
            lte: () => ({
              order: () => ({
                data: [
                  {
                    date: "2024-04-01",
                    kcal: 2000,
                    protein_g: 150,
                    carbs_g: 200,
                    fat_g: 60,
                    intra_cho_g_per_h: 0,
                    day_type: "rest",
                    locked: false,
                    created_at: "2024-04-01T00:00:00Z",
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      })
      chain.select = () => chain
      chain.order = () => ({ data: chain.data ?? [], error: null })
    }

    if (table === "nutrition_meals") {
      chain.select = () => chain
      chain.order = () => ({
        data: [
          {
            id: "meal-1",
            date: "2024-04-01",
            slot: 1,
            name: "Breakfast",
            time: "08:00",
            kcal: 500,
            protein_g: 30,
            carbs_g: 60,
            fat_g: 15,
            ingredients: [],
            eaten: false,
          },
        ],
        error: null,
      })
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

test("GET /api/v1/nutrition/week returns consistent shape", async () => {
  mock.module("../../lib/supabase/server", {
    createServerClient: async () => mockSupabase(),
  })

  const { GET } = await import("../../app/api/v1/nutrition/week/route.ts")
  const req = new NextRequest("http://localhost/api/v1/nutrition/week?start=2024-04-01&end=2024-04-07")
  const res = await GET(req)
  const json = await res.json()

  assert.equal(res.status, 200)
  assert.ok(Array.isArray(json.days))
  assert.equal(json.days[0].date, "2024-04-01")
  assert.ok("consumed" in json.days[0])
  assert.ok("target" in json.days[0])
})
