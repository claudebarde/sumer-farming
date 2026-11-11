import { describe, expect, it } from "vitest";
import { interiorSleepPhase } from "../../src/client/game/home/interiorSleep";
import type { FarmerSleep } from "../../src/game-data/farmerSleep";
const sleep: FarmerSleep = { history: [], session: { id: "sleep", requestedAt: 100, sleepsAt: 200, endsAt: 1000, wokeAt: null, path: [{ column: 1, row: 1 }] } };
describe("interior sleep presentation", () => {
  it("waits for entry, restores an ongoing rest and catches up after offline completion", () => {
    expect(interiorSleepPhase(sleep, 150, false)).toBe("entering");
    expect(interiorSleepPhase(sleep, 200, false)).toBe("sleeping");
    expect(interiorSleepPhase(sleep, 900, false)).toBe("sleeping");
    expect(interiorSleepPhase(sleep, 1000, false)).toBe("awake");
  });
  it("honours an early server wake", () => {
    expect(interiorSleepPhase({ ...sleep, session: { ...sleep.session!, wokeAt: 400 } }, 400, false)).toBe("awake");
  });
  it("does not apply the visitor's sleep to another home or invent sleep without a session", () => {
    expect(interiorSleepPhase(sleep, 300, true)).toBe("awake");
    expect(interiorSleepPhase(undefined, 300, false)).toBe("awake");
  });
});
