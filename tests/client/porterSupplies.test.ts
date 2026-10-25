import { describe, expect, it } from "vitest";
import { advancePorter, PORTER_MARKET, type PorterBuilding } from "../../src/game-core/farm/porter";
import { PORTER_HIRE_MS, PorterSchema } from "../../src/game-data/porter";
import { porterPose, porterAwaitingPickup } from "../../src/client/game/phaser/isometricPorter";
import { estateEmptyJars } from "../../src/game-core/farm/estateEmptyJars";

const brewery: PorterBuilding = { id: "brewery", type: "brewery", column: 5, row: 3, loadingTile: { column: 5, row: 5 }, completesAt: 0, emptyBeerJars: 0 };
const base = { porter: { hiredAt: 0, expiresAt: PORTER_HIRE_MS, checkedAt: 0, position: PORTER_MARKET, job: null },
  buildings: [brewery], roads: [], inventory: { emptyBeerJar: 4 }, reserved: {}, stacks: [], now: 0 };

describe("porter brewery supplies", () => {
  it.each([[0, 4, 2], [1, 4, 1], [0, 1, 1], [2, 4, 0], [0, 0, 0]])("tops up %i stocked jars from %i estate jars with %i", (stored, available, quantity) => {
    const result = advancePorter({ ...base, buildings: [{ ...brewery, emptyBeerJars: stored }], inventory: { emptyBeerJar: available } });
    expect(result.porter.job?.quantity ?? 0).toBe(quantity);
    expect(result.inventory.emptyBeerJar).toBe(available - quantity);
    expect(result.breweryJars.brewery).toBe(stored);
  });
  it("stores goods before supplying jars, then supplies after all storage trips", () => {
    const input = { ...base, stacks: [{ buildingId: brewery.id, itemKey: "beer" as const, quantity: 2, readyAt: 0 }] };
    const first = advancePorter(input);
    expect(first.porter.job?.itemKey).toBe("beer");
    const afterStorage = advancePorter({ ...input, ...first, now: first.porter.job!.completesAt });
    expect(afterStorage.porter.returnTrip ?? null).toBeNull();
    expect(afterStorage.porter.job?.itemKey).toBe("emptyBeerJar");
    expect(afterStorage.porter.job?.path[0]).toEqual(first.porter.job!.path.at(-1));
    expect(first.inventory.emptyBeerJar).toBe(4);
    const done = advancePorter({ ...input, ...first, now: 50000 });
    expect(done.inventory.beer).toBe(2);
    expect(done.breweryJars.brewery).toBe(2);
    expect(done.inventory.emptyBeerJar).toBe(2);
  });
  it("reloads a reserved trip and delivers exactly once, including after hire expires", () => {
    const first = advancePorter({ ...base, porter: { ...base.porter, expiresAt: 1 } });
    const saved = PorterSchema.parse(JSON.parse(JSON.stringify(first.porter)));
    const done = advancePorter({ ...base, ...first, porter: saved, now: 50000 });
    expect(done.breweryJars.brewery).toBe(2);
    expect(done.inventory.emptyBeerJar).toBe(2);
    expect(done.porter.job).toBeNull();
    const again = advancePorter({ ...base, ...done, buildings: [{ ...brewery, emptyBeerJars: 2 }], now: 60000 });
    expect(again.inventory.emptyBeerJar).toBe(2);
    expect(again.breweryJars.brewery).toBe(2);
  });
  it("uses the farm pickup and jar frames without adding supplies to the beer pile", () => {
    const result = advancePorter(base);
    const job = result.porter.job!;
    expect(job.path[job.pickupIndex]).toEqual({ column: 1, row: 5 });
    expect(job.path.at(-1)).toEqual(brewery.loadingTile);
    expect(porterPose(result.porter, job.pickupAt - 1)?.texture).toContain("empty");
    expect(porterPose(result.porter, job.pickupAt)?.texture).toContain("jars");
    expect(porterAwaitingPickup(result.porter, brewery.id, 0)).toBe(0);
    expect(estateEmptyJars({ inventory: [{ itemKey: "emptyBeerJar", quantity: 2 }], buildings: [{ type: "brewery", emptyBeerJars: 0 }], farm: { production: { porter: result.porter } } })).toBe(4);
  });
  it("does not overfill if a manual delivery arrives first", () => {
    const first = advancePorter(base);
    const done = advancePorter({ ...base, ...first, buildings: [{ ...brewery, emptyBeerJars: 1 }], now: 50000 });
    expect(done.breweryJars.brewery).toBe(2);
    expect(done.inventory.emptyBeerJar).toBe(3);
  });
  it("waits without a completed reachable brewery or active hire", () => {
    expect(advancePorter({ ...base, buildings: [] }).porter.job).toBeNull();
    expect(advancePorter({ ...base, buildings: [{ ...brewery, completesAt: 1000 }] }).porter.job).toBeNull();
    expect(advancePorter({ ...base, buildings: [{ ...brewery, loadingTile: { column: 5, row: 2 } }] }).porter.job).toBeNull();
    expect(advancePorter({ ...base, porter: { ...base.porter, expiresAt: 0 } }).porter.job).toBeNull();
  });
});
