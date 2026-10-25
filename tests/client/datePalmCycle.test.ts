import { expect, it } from "vitest";
import { palmTendingReason, tendedPalmDeadline } from "../../src/game-data/datePalmCycle";
const hour = 3600000;
const cycle = { startedAt: 0, originalReadyAt: 24 * hour };
it("halves only remaining time, with a strict twelve-hour eligibility window", () => {
  for (const hours of [0, 6, 11.999]) {
    const now = hours * hour;
    expect(palmTendingReason(cycle, 24 * hour, now)).toBeNull();
    expect(tendedPalmDeadline(24 * hour, now)).toBe(now + Math.ceil((24 * hour - now) / 2));
  }
  expect(tendedPalmDeadline(24 * hour, 0)).toBe(12 * hour);
  expect(tendedPalmDeadline(24 * hour, 6 * hour)).toBe(15 * hour);
  expect(palmTendingReason(cycle, 24 * hour, 12 * hour)).toContain("closed");
  expect(palmTendingReason(cycle, 24 * hour, 15 * hour)).toContain("closed");
});
it("rejects repeated tending, immature/legacy cycles, future cycles and ripe fruit", () => {
  expect(palmTendingReason({ ...cycle, tendedAt: 0 }, 12 * hour, hour)).toContain("already");
  expect(palmTendingReason(undefined, 24 * hour, hour)).toContain("next harvest");
  expect(palmTendingReason(cycle, 24 * hour, -1)).toContain("not started");
  expect(palmTendingReason(cycle, 24 * hour, 24 * hour)).toContain("ready");
});
