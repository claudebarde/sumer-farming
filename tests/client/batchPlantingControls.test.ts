import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import BatchPlantingControls from "../../src/client/components/BatchPlantingControls";
import { batchPlantingStore } from "../../src/client/stores/batchPlantingStore";
import { farmStore } from "../../src/client/stores/farmStore";
import { farmerCommandStore } from "../../src/client/stores/farmerCommandStore";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import type Phaser from "phaser";
import { installBatchPlantingOverlay } from "../../src/client/game/phaser/batchPlantingOverlay";

// Read the current vanilla stores when rendering without a browser subscription.
vi.mock("../../src/client/game/phaser/config", () => ({ TILE_SIZE: 64 }));
vi.mock("zustand", () => ({ useStore: (store: { getState: () => unknown }, selector = (state: unknown) => state) => selector(store.getState()) }));
const now = Date.parse("2026-10-01T12:00:00Z");
const snapshot = () => FarmSnapshotSchema.parse({
  created: false, player: { shekelBalance: 0 },
  farm: { id: "00000000-0000-4000-8000-000000000001", playerId: "00000000-0000-4000-8000-000000000002", version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: []
});
const render = () => renderToStaticMarkup(createElement(BatchPlantingControls, { now }));
afterEach(() => {
  batchPlantingStore.getState().cancel();
  farmStore.getState().setLoading();
  farmerCommandStore.getState().setStatus({ type: "idle" });
});

describe("NES-style planting controls", () => {
  it("uses the shared white message styling and NES disabled buttons during selection", () => {
    farmStore.getState().setReady(snapshot());
    batchPlantingStore.getState().start();
    const html = render();
    expect(html).toContain("dialog-bottom-container nes-container is-centered is-rounded");
    expect(html).toContain('class="nes-btn is-disabled" disabled=""');
    expect(html).toContain('class="nes-btn is-error">Cancel');
    expect(html.indexOf("Tap yellow fields")).toBeLessThan(html.indexOf("<button"));
  });
  it("uses blue for enabled planting and red for cancellation", () => {
    const farm = snapshot();
    farm.inventory = [{ itemKey: "barley", quantity: 2 }];
    farm.improvements = [8, 9].map(row => ({
      id: `00000000-0000-4000-8000-00000000000${row}`, type: "irrigation" as const,
      column: 5, row, startedAt: new Date(0).toISOString(), completesAt: new Date(1000).toISOString(),
      destroyStartedAt: null, destroyCompletesAt: null
    }));
    farmStore.getState().setReady(farm);
    batchPlantingStore.getState().start();
    batchPlantingStore.setState({ selected: [{ column: 4, row: 8 }] });
    expect(render()).toContain('class="nes-btn is-primary">Plant barley');
    expect(render()).toContain('class="nes-btn is-error">Cancel');
  });
  it("keeps long-running job controls visible and removes them when the job ends", () => {
    const farm = snapshot();
    farm.farm.production.planting = {
      id: "00000000-0000-4000-8000-000000000003", total: 6,
      remaining: [{ column: 4, row: 8 }, { column: 6, row: 8 }, { column: 6, row: 7 }],
      source: { type: "farm", column: 1, row: 3 }, stopRequested: false,
      phase: { type: "sowing", target: { column: 4, row: 7 }, completesAt: new Date(now + 10000).toISOString() }
    };
    farmStore.getState().setReady(farm);
    expect(render()).toContain("Planting 3 of 6 fields");
    expect(render()).toContain('class="nes-btn">Stop after this field');
    farmStore.getState().setReady(snapshot());
    expect(render()).toBe("");
  });
  it("reuses NES controls for harvesting and caps selection at four ripe fields", () => {
    const farm = snapshot();
    farm.crops = [0, 1, 2, 3, 4].map(column => ({
      id: `00000000-0000-4000-8000-00000000000${column}`, cropKey: "barley" as const, column, row: 8,
      sowingStartedAt: new Date(0).toISOString(), plantedAt: new Date(10000).toISOString(),
      growthCompletesAt: new Date(1810000).toISOString(), harvestStartedAt: null, harvestCompletesAt: null
    }));
    farmStore.getState().setReady(farm);
    batchPlantingStore.setState({ origin: { column: 0, row: 0 } });
    batchPlantingStore.getState().start("harvest");
    for (const crop of farm.crops) batchPlantingStore.getState().toggle(crop);
    expect(batchPlantingStore.getState().selected).toHaveLength(4);
    const html = render();
    expect(html).toContain("4 / 4 fields selected · 40s harvesting + travel");
    expect(html).toContain('class="nes-btn is-primary">Harvest barley');
    expect(html).toContain('class="nes-btn is-error">Cancel');
    batchPlantingStore.getState().toggle(farm.crops[0]!);
    batchPlantingStore.getState().toggle(farm.crops[4]!);
    expect(batchPlantingStore.getState().selected).toHaveLength(4);
    expect(batchPlantingStore.getState().selected).toContainEqual({ column: 4, row: 8 });
    const graphics = {
      setDepth: vi.fn().mockReturnThis(), clear: vi.fn(),
      fillStyle: vi.fn().mockReturnThis(), fillRect: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(), strokeRect: vi.fn().mockReturnThis(),
      lineBetween: vi.fn().mockReturnThis(), destroy: vi.fn()
    };
    graphics.clear.mockImplementation(() => { graphics.fillStyle.mockClear(); return graphics; });
    const scene = { add: { graphics: () => graphics }, scale: { on: vi.fn(), off: vi.fn() } } as unknown as Phaser.Scene;
    const cleanup = installBatchPlantingOverlay(scene, () => ({ column: 0, row: 0 }));
    try {
      expect(graphics.fillStyle.mock.calls.map(call => call[0])).toEqual([0xda4545, 0x42ad62, 0x42ad62, 0x42ad62, 0x42ad62]);
      batchPlantingStore.getState().toggle(farm.crops[4]!);
      expect(graphics.fillStyle.mock.calls.map(call => call[0])).toEqual([0xffd84d, 0x42ad62, 0x42ad62, 0x42ad62, 0xffd84d]);
    } finally { cleanup(); }
  });
});
