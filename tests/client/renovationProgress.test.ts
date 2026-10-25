import { expect, it } from "vitest";
import { renovationProgress } from "../../src/client/game/phaser/renovationProgress";

const start = Date.parse("2026-10-25T12:00:00Z");
const upgrades = { oven: [{ level: 2, startedAt: new Date(start).toISOString(),
  completesAt: new Date(start + 300_000).toISOString(), idempotencyKey: "test" }] };

it("shows a saved upgrade immediately and catches up after a reload or hidden tab", () => {
  expect(renovationProgress(upgrades, "oven", start)).toEqual({ fraction: 0 });
  const reloaded = JSON.parse(JSON.stringify(upgrades));
  expect(renovationProgress(reloaded, "oven", start + 240_000)).toEqual({ fraction: 0.8 });
  expect(reloaded).toEqual(upgrades);
});
it("restores normal artwork at completion, including returning after it finished offline", () => {
  expect(renovationProgress(upgrades, "oven", start + 300_000)).toBeNull();
  expect(renovationProgress(upgrades, "oven", start + 86_400_000)).toBeNull();
});
it("does not renovate another building or show work before the saved start", () => {
  expect(renovationProgress(upgrades, "mill", start)).toBeNull();
  expect(renovationProgress(undefined, "oven", start)).toBeNull();
  expect(renovationProgress(upgrades, "oven", start - 1)).toBeNull();
});
