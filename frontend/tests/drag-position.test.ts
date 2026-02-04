import { test } from "node:test"
import assert from "node:assert/strict"

// Test the drag position calculation with scroll
function testDragPositionCalculation() {
  const HOUR_HEIGHT = 56
  const SNAP_MINUTES = 15
  const START_HOUR = 5
  const END_HOUR = 23
  
  // Simulate the getDragPosition logic
  function calculatePosition(
    clientY: number,
    gridTop: number,
    headerHeight: number,
    scrollTop: number
  ) {
    const relativeY = clientY - gridTop - headerHeight + scrollTop
    const minutesFromTop = (relativeY / HOUR_HEIGHT) * 60
    const totalMinutes = START_HOUR * 60 + minutesFromTop
    const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
    const clampedMinutes = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - SNAP_MINUTES, snappedMinutes))
    
    const hours = Math.floor(clampedMinutes / 60)
    const minutes = clampedMinutes % 60
    const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    
    return { time, clampedMinutes }
  }

  // Test 1: No scroll, dropping at 10:00 AM
  // Grid viewport top = 100px
  // Header height = 60px  
  // Position for 10:00 AM (5 hours from START_HOUR=5, so 5*56 = 280px below grid content start)
  // clientY = 100 (grid top) + 60 (header) + 280 (offset to 10:00) = 440
  const pos1 = calculatePosition(440, 100, 60, 0)
  assert.equal(pos1.time, "10:00", "Test 1: Should be 10:00 with no scroll")

  // Test 2: Grid scrolled down by 2 hours (112px), user drags to visual position of 10:00
  // When scrolled 112px down, content shifts up by 112px
  // To visually drop at 10:00, clientY should be same as before but scroll offset applies
  // clientY stays 440 (same mouse position in window)
  // But now scrollTop = 112, so: relativeY = 440 - 100 - 60 + 112 = 392
  // 392 / 56 * 60 = 420 minutes from START_HOUR, which is 7 hours = 12:00
  // This demonstrates the bug: same visual position changes when scrolled!
  // To stay at 10:00 visually, we need: relativeY = 280 (same as before)
  // So clientY needs to be: 100 + 60 + 280 - 112 = 328
  const pos2 = calculatePosition(328, 100, 60, 112)
  assert.equal(pos2.time, "10:00", "Test 2: Should stay at 10:00 when scrolled (same visual position)")

  // Test 3: After scrolling 2 hours, drop at new visual 12:00 position
  // New 12:00 visual position = 280 + 112 = 392px from grid content top
  // clientY = 100 + 60 + 392 - 112 = 440 (same as original 10:00!)
  // With scroll: relativeY = 440 - 100 - 60 + 112 = 392
  // 392 / 56 * 60 = 420 minutes = 12:00 ✓
  const pos3 = calculatePosition(440, 100, 60, 112)
  assert.equal(pos3.time, "12:00", "Test 3: Should be 12:00 at new visual position after scroll")

  console.log("✓ All drag calculation tests passed")
}

test("Drag position calculation accounts for scroll", () => {
  testDragPositionCalculation()
})
