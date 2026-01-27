import { mock } from "node:test"
import assert from "node:assert/strict"

mock.module("../frontend/lib/supabase/server", {
  createServerClient: async () => ({
    from: () => ({
      select: async () => ({ data: [{ id: "ok" }], error: null }),
    }),
  }),
})

const { GET } = await import("../frontend/app/api/v1/health/route.ts")
const res = await GET()
const json = await res.json()

assert.equal(res.status, 200)
assert.equal(json.ok, true)
console.log("API smoke test passed.")
