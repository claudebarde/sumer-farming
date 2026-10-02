import { describe, expect, it } from "vitest";
import { productionProgress } from "../../src/client/game/phaser/productionProgress";

describe("building production bars", () => {
  const job = { startedAt: new Date(1000).toISOString(), completesAt: new Date(301000).toISOString() };
  it("uses persisted times to resume progress after reload", () => {
    expect(productionProgress(job, 1000)).toBe(0);
    expect(productionProgress(job, 151000)).toBe(0.5);
    expect(productionProgress(job, 226000)).toBe(0.75);
  });
  it("hides idle and completed jobs", () => {
    expect(productionProgress(null, 1000)).toBeNull();
    expect(productionProgress(undefined, 1000)).toBeNull();
    expect(productionProgress(job, 301000)).toBeNull();
    expect(productionProgress(job, 401000)).toBeNull();
  });
  it("handles clock skew and malformed times safely", () => {
    expect(productionProgress(job, 0)).toBe(0);
    expect(productionProgress({ ...job, completesAt: job.startedAt }, 0)).toBeNull();
    expect(productionProgress({ ...job, startedAt: "invalid" }, 0)).toBeNull();
  });
});
