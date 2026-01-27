import { test } from "node:test"
import assert from "node:assert/strict"
import { buildDateRange, parseIsoDate } from "../lib/utils/dateRange"

test("parseIsoDate parses valid ISO dates", () => {
  const date = parseIsoDate("2024-04-22")
  assert.ok(date instanceof Date)
  assert.equal(date.toISOString().startsWith("2024-04-22"), true)
})

test("parseIsoDate rejects invalid dates", () => {
  assert.equal(parseIsoDate("04-22-2024"), null)
  assert.equal(parseIsoDate("2024-99-99"), null)
})

test("buildDateRange enforces limits", () => {
  const range = buildDateRange("2024-04-01", "2024-04-07", 7)
  assert.equal(range?.days, 7)
  assert.equal(buildDateRange("2024-04-01", "2024-05-31", 7), null)
})
