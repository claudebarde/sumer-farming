import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { CROP_DEFINITIONS } from "../../src/game-data/crops";
import { cropSprite, nextCropTransition } from "../../src/client/game/phaser/cropPresentation";
import { cropWorkPresentation } from "../../src/client/game/phaser/cropWorkPresentation";
import { CropWorkSchema } from "../../src/game-data/cropWork";
import { perennialActionReason, planCropWork } from "../../src/game-core/farm/perennialCrops";
import { harvestableFields, plantableFields } from "../../src/game-core/farm/batchPlanting";
import { validateDatesTreat, happinessAfterDates, happinessAfterFish } from "../../src/game-core/farm/wellbeing";
import { GameCommandSchema } from "../../src/schemas/gameCommands";
import { MarketItemKeySchema } from "../../src/game-data/marketItems";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
import { estateResourceCapacity } from "../../src/game-data/storage";
import { sharedDeliveryStop } from "../../src/game-core/farm/storageDelivery";
import PerennialCropContent from "../../src/client/components/PerennialCropContent";
import FarmerPanel from "../../src/client/components/FarmerPanel";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";

const id = "00000000-0000-4000-8000-000000000001";
const planted = Date.parse("2026-10-01T00:00:00Z");
const mature = planted + CROP_DEFINITIONS.datePalm.growthDurationMs;
const iso = (n: number) => new Date(n).toISOString();
const snapshot = (quantity = 0) => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 100 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    progression: { level: 9, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 },
    household: { happiness: 60, lastBeerAt: null, hungrySince: null, cultivationStartedAt: iso(planted), nextBarleyConsumptionAt: iso(mature) } },
  crops: [{ id, column: 4, row: 8, cropKey: "datePalm", sowingStartedAt: iso(planted - 10000), plantedAt: iso(planted), growthCompletesAt: iso(mature), harvestStartedAt: null, harvestCompletesAt: null }],
  inventory: [{ itemKey: "dates", quantity }], objects: [], groundItems: [], improvements: [], buildings: [{ id, type: "warehouse", column: 5, row: 3, startedAt: iso(planted-1), completesAt: iso(planted), loadingTile: { column: 5, row: 5 }, storedBarley: 0, brewingBarley: 0, brewingWater: 0, emptyBeerJars: 0, beerReadyAt: null, beerServed: 0 }] });

describe("date palm presentation and rules", () => {
  it("changes sapling to fruiting palm at 24 hours and uses the bare palm between harvests", () => {
    const crop = snapshot().crops[0]!;
    expect(cropSprite(crop, planted - 1)).toBeNull();
    expect(cropSprite(crop, mature - 1)).toBe("datePalmSapling");
    expect(cropSprite(crop, mature)).toBe("datePalmReady");
    expect(nextCropTransition(crop, planted)).toBe(mature);
    const next = { ...crop, growthCompletesAt: iso(mature + 12 * 3600000) };
    expect(cropSprite(next, mature)).toBe("datePalmGrowing");
    expect(cropSprite(next, mature + 12 * 3600000)).toBe("datePalmReady");
  });
  it("does not change barley's annual visual stages", () => {
    const crop = { ...snapshot().crops[0]!, cropKey: "barley" as const, growthCompletesAt: iso(planted + 1800000) };
    expect(cropSprite(crop, planted)).toBe("barleySeeded");
    expect(cropSprite(crop, planted + 600000)).toBe("barleyGrowing");
    expect(cropSprite(crop, planted + 1800000)).toBe("barleyReady");
  });
  it("keeps palms out of barley batch selection", () => {
    const s = snapshot(); expect(harvestableFields(s, mature)).toEqual([]);
    expect(plantableFields(s, mature)).not.toContainEqual({ column: 4, row: 8 });
  });
  it.each([4,5])("disables harvesting when %i baskets leave insufficient warehouse room", quantity => {
    const s = snapshot(quantity);
    expect(perennialActionReason(s, "datePalm", { column: 4, row: 8 }, "harvest", mature)).toBe("No storage space");
    const html = renderToStaticMarkup(createElement(PerennialCropContent, { snapshot: s, target: { column: 4, row: 8 }, now: mature }));
    expect(html).toContain('disabled=""'); expect(html).toContain("No storage space");
  });
  it("shows maturity time and a dates treat in the farmer panel", () => {
    const s = snapshot(2);
    const html = renderToStaticMarkup(createElement(PerennialCropContent, { snapshot: s, target: { column: 4, row: 8 }, now: planted }));
    expect(html).toContain("24h 0m remaining");
    const panel = renderToStaticMarkup(createElement(FarmerPanel, { snapshot: s, now: planted }));
    expect(panel).toContain("Dates treat"); expect(panel).toContain("Give one basket of dates");
    const ready = renderToStaticMarkup(createElement(PerennialCropContent, { snapshot: s, target: { column: 4, row: 8 }, now: mature }));
    expect(ready).toContain("2 baskets of dates ready to harvest");
    expect(ready).toContain("dates-basket.png");
    expect(ready).not.toContain("Harvest multiple");
  });
  it("has no farm fallback or granary capacity and requires the warehouse to be finished", () => {
    const s = snapshot();
    expect(estateResourceCapacity("dates", [], mature)).toBe(0);
    expect(estateResourceCapacity("dates", s.buildings, mature)).toBe(5);
    expect(estateResourceCapacity("dates", [{ type: "granary", completesAt: iso(planted) }], mature)).toBe(0);
    expect(estateResourceCapacity("dates", [{ type: "warehouse", completesAt: iso(mature + 1) }], mature)).toBe(0);
    expect(sharedDeliveryStop("dates", 0, false)).toEqual({ location: "warehouse", room: 0 });
    expect(sharedDeliveryStop("dates", 4, true)).toEqual({ location: "warehouse", room: 1 });
    expect(planCropWork({ ...s, buildings: [] }, { column: 4, row: 8 }, "datePalm", "harvest", mature)).toBeNull();
  });
  it("shares fish's boost but keeps an independent 8-hour cooldown", () => {
    expect(happinessAfterDates(65)).toBe(happinessAfterFish(65));
    expect(happinessAfterDates(95)).toBe(100);
    expect(validateDatesTreat(1, 60, planted, planted + 8 * 3600000 - 1)).toBe("dates_cooldown");
    expect(validateDatesTreat(1, 60, planted, planted + 8 * 3600000)).toBeNull();
    expect(validateDatesTreat(0, 60, null, planted)).toBe("no_dates");
  });
  it("unlocks at level 9 without enabling trading", () => {
    const command = GameCommandSchema.parse({ type: "tend_perennial_crop", action: "plant", crop: "datePalm", target: { column: 4, row: 8 }, expectedFarmVersion: 1 });
    expect(commandUnlockLevel(command)).toBe(9);
    expect(commandUnlockLevel({ type: "give_farmer_dates", expectedFarmVersion: 1 })).toBe(9);
    expect(MarketItemKeySchema.safeParse("dates").success).toBe(false);
  });
  it("uses a saved timeline for travel, work and carrying, even after a long absence", () => {
    const plan = planCropWork(snapshot(), { column: 4, row: 8 }, "datePalm", "harvest", mature)!;
    const job = CropWorkSchema.parse({ ...plan, id, cropId: id, cropKey: "datePalm", action: "harvest", quantity: 2 });
    expect(cropWorkPresentation(job, job.startedAt).position).toEqual(job.outbound[0]);
    expect(cropWorkPresentation(job, job.workStartsAt).working).toBe(true);
    expect(cropWorkPresentation(job, job.workEndsAt).carrying).toBe(true);
    expect(cropWorkPresentation(job, job.completesAt + 86400000)).toMatchObject({ position: job.inbound.at(-1), working: false, carrying: false, moving: false });
  });
});
