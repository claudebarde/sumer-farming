import { expect, it } from "vitest";
import { fishingReadiness } from "../../src/client/game/phaser/fishingReadiness";

const ready = { pending: false, busy: false, arrivalMs: 0, approachMs: 0, cooldownMs: 0 };
it("uses the same ready state for feedback and accepting casts", () => {
  expect(fishingReadiness(ready)).toEqual({ ready: true, label: "Ready to cast" });
  expect(fishingReadiness({ ...ready, arrivalMs: 1 })).toEqual({ ready: false, label: "Getting ready…" });
  expect(fishingReadiness({ ...ready, busy: true }).ready).toBe(false);
  expect(fishingReadiness({ ...ready, pending: true })).toEqual({ ready: false, label: "Casting…" });
});
it("explains the full approach delay when moving to a distant spot", () => {
  expect(fishingReadiness({ ...ready, approachMs: 12_300 })).toEqual({ ready: false, label: "Fish approaching · 13s" });
  expect(fishingReadiness({ ...ready, approachMs: 1 }).ready).toBe(false);
  expect(fishingReadiness({ ...ready, approachMs: -1 }).ready).toBe(true);
});
it("counts down the cooldown and becomes ready exactly when it ends", () => {
  expect(fishingReadiness({ ...ready, cooldownMs: 2000 }).label).toBe("Next cast in 2s");
  expect(fishingReadiness({ ...ready, cooldownMs: 999 }).label).toBe("Next cast in 1s");
  expect(fishingReadiness({ ...ready, cooldownMs: 1 }).ready).toBe(false);
  expect(fishingReadiness({ ...ready, cooldownMs: 0 }).ready).toBe(true);
});
