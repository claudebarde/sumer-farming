import { describe, expect, it } from "vitest";
import { productionProgress, productionVisualsReady } from "../../src/client/game/phaser/productionProgress";
import { FARM_BUILDING_DEFINITIONS, farmBuildingTypes } from "../../src/game-data/buildings";

describe("building production bars", () => {
  it.each(farmBuildingTypes)("shows elapsed construction progress for %s and hides on completion", type => {
    const duration = FARM_BUILDING_DEFINITIONS[type].constructionDurationMs;
    const construction = { startedAt: new Date(1000).toISOString(), completesAt: new Date(1000 + duration).toISOString() };
    expect(productionProgress(construction, 1000)).toBe(0);
    expect(productionProgress(construction, 1000 + duration / 2)).toBe(0.5);
    expect(productionProgress(construction, 1000 + duration)).toBeNull();
  });
  const job = { startedAt: new Date(1000).toISOString(), completesAt: new Date(301000).toISOString() };
  it("keeps busy sprites and bars hidden during preparation even if the actor arrives early", () => {
    expect(productionVisualsReady(job, 500, true)).toBe(false);
    expect(productionVisualsReady(job, 500, false)).toBe(false);
  });
  it("waits for local arrival reconciliation even when the server start time has passed", () => {
    expect(productionVisualsReady(job, 2000, true)).toBe(false);
    expect(productionVisualsReady(job, 2000, false)).toBe(true);
  });
  it("restores production visuals from saved time without another arrival event", () => {
    expect(productionVisualsReady(job, 1000, false)).toBe(true);
    expect(productionVisualsReady(null, 1000, false)).toBe(false);
    expect(productionVisualsReady({ startedAt: "invalid" }, 1000, false)).toBe(false);
  });
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
