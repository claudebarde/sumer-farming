import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { productionStartCommand } from "../../src/client/game/productionStart";
import { farmerProductionJob } from "../../src/game-core/farm/farmerProduction";

const origin = { column: 4, row: 2 };
const target = { column: 6, row: 4, posX: 384, posY: 256 };
describe("production dispatch before travel", () => {
  it.each(["farmer", "donkey"] as const)("submits %s milling without needing an arrival", worker => {
    expect(productionStartCommand({ id: "test", type: "mill", worker, recipe: "flour", target }, origin, 8))
      .toEqual({ type: "start_milling", worker, recipe: "flour", target: { column: 2, row: 2 }, expectedFarmVersion: 8 });
  });
  it("covers baking and brewing while leaving collection separate", () => {
    expect(productionStartCommand({ id: "test", type: "production", action: "bake", buildingId: "oven", target }, origin, 8)?.type).toBe("start_baking");
    expect(productionStartCommand({ id: "test", type: "brewery_supply", action: "start_brewing", target }, origin, 8)).toMatchObject({ type: "brewery_supply", action: "start_brewing" });
    expect(productionStartCommand({ id: "test", type: "production", action: "store", buildingId: "oven", target }, origin, 8)).toBeNull();
  });
  it("releases donkey preparation on time, retaining compatibility with old jobs", () => {
    const milling = { buildingId: "mill", worker: "donkey" as const, startedAt: new Date(20_000).toISOString() };
    expect(farmerProductionJob({ milling }, 19_999)?.type).toBe("milling");
    expect(farmerProductionJob({ milling }, 20_000)).toBeNull();
    expect(farmerProductionJob({ milling: { buildingId: "mill", worker: "donkey" } }, 0)).toBeNull();
  });
  it("keeps server start requests out of arrival callbacks", () => {
    const scene = readFileSync(new URL("../../src/client/game/phaser/scenes/MainScene.ts", import.meta.url), "utf8");
    const dispatch = scene.slice(scene.indexOf("const executeMovementCommand"), scene.indexOf("const removeBatchOverlay"));
    expect(dispatch.indexOf("executeGameCommand(productionStart)")).toBeLessThan(dispatch.indexOf("moveFarmerTo("));
    const arrival = scene.slice(scene.indexOf("const startFarmItemAction"), scene.indexOf("const executeMovementCommand"));
    expect(arrival).not.toContain('type: "start_milling"');
    expect(arrival).not.toContain('type: "start_baking"');
    expect(scene).toContain('command.type === "brewery_supply" && command.action === "start_brewing"');
  });
});
