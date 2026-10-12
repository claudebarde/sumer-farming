import { afterEach, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import { IsometricFarmScene } from "../../src/client/game/phaser/scenes/IsometricFarmScene";
import { FarmSnapshotSchema, type FarmSnapshot } from "../../src/schemas/farm";

const image = () => ({
  x: 0, y: 0, depth: 0, flipX: false, texture: "",
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; },
  setDepth(value: number) { this.depth = value; return this; },
  setFlipX(value: boolean) { this.flipX = value; return this; },
  setTexture(value: string) { this.texture = value; return this; },
  setDisplaySize() { return this; }, setVisible() { return this; },
});
afterEach(() => vi.restoreAllMocks());

it("keeps the actual actor facing the farm through unloading, idle texture and redraws", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const before = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null },
      carriedItem: { itemKey: "barley", quantity: 1, expiresAt: null }, gathering: null },
    inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
  const after = { ...before, farm: { ...before.farm, version: 2, carriedItem: null } };
  const scene = new IsometricFarmScene(before, () => {}) as unknown as {
    actor: ReturnType<typeof image>; actorShadow: ReturnType<typeof image>; heldMaterial: ReturnType<typeof image>;
    cargo: ReturnType<typeof image>; cargoBackground: ReturnType<typeof image>;
    facingLeft: boolean; renderFarmer(): void; renderCargo(): void; draw(): void;
    setSnapshot(snapshot: FarmSnapshot): void;
    presentStorageDelivery: IsometricFarmScene["presentStorageDelivery"];
    setPlantingSelection: IsometricFarmScene["setPlantingSelection"];
  };
  scene.actor = image(); scene.actorShadow = image(); scene.cargo = image(); scene.cargoBackground = image(); scene.heldMaterial = image();
  scene.renderCargo = () => {};
  scene.draw = () => { scene.actor = image(); scene.renderFarmer(); };
  const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
  scene.presentStorageDelivery([{ column: 2, row: 5 }, { column: 1, row: 5 }], before, { column: 1, row: 3 });
  scene.setSnapshot(after);
  clock.mockReturnValue(1100); scene.renderFarmer();
  expect(scene.actor.flipX).toBe(true); // arriving from the right, walking left
  clock.mockReturnValue(1180); scene.renderFarmer();
  expect(scene.actor.flipX).toBe(false); // building is right: turn before unloading
  expect(scene.actor.texture).toBe("farmer-carry-v2-0");
  clock.mockReturnValue(1780); scene.renderFarmer();
  expect(scene.actor.texture).toBe("farmer-idle");
  expect(scene.actor.flipX).toBe(false);
  scene.setPlantingSelection(null, false);
  scene.setSnapshot(after);
  scene.facingLeft = true; // stale last-step direction must not override the target
  scene.draw();
  expect(scene.actor.flipX).toBe(false);
});
