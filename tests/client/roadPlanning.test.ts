import { describe, expect, it } from "vitest";
import { validateRoadPlan } from "../../src/game-core/farm/roads";
import { GameCommandSchema } from "../../src/schemas/gameCommands";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { roadPlanBlocker, roadGhostPreview, toggleRoadPlan, roadWorkActive } from "../../src/client/game/phaser/isometricRoads";
import { activeConstruction, savedRoadApproach } from "../../src/client/game/phaser/isometricConstruction";

const targets = [{ column: 5, row: 4 }, { column: 5, row: 3 }, { column: 6, row: 3 }];
const id = "00000000-0000-4000-8000-000000000001";
const fixture = () => FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
  farm: { id, playerId: id, version: 1, carriedItem: null, gathering: null,
    household: { happiness: 70, lastBeerAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null } },
  inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });

describe("exact-tile road planning", () => {
  it("keeps construction UI locked until the whole queue has elapsed, including after time away", () => {
    const roads = [{ column: 5, row: 4, completesAt: 6000 }, { column: 5, row: 3, completesAt: 11180 }];
    expect(roadWorkActive(roads, 1000)).toBe(true);
    expect(roadWorkActive(roads, 6000)).toBe(true);
    expect(roadWorkActive(roads, 11180)).toBe(false);
    expect(roadWorkActive(roads, 60000)).toBe(false);
    expect(roadWorkActive([], 1000)).toBe(false);
  });
  it("colours the ghost using selection rules and connects it to planned tiles", () => {
    const snapshot = fixture();
    expect(roadGhostPreview(snapshot, [], targets[0]!, 1000)).toEqual({ colour: 0x55ce75, texture: "road-8" });
    expect(roadGhostPreview(snapshot, [targets[0]!], targets[1]!, 1000).colour).toBe(0x55ce75);
    expect(roadGhostPreview(snapshot, [], targets[1]!, 1000).colour).toBe(0xe65c5c);
    expect(roadGhostPreview(snapshot, [targets[0]!], targets[0]!, 1000).colour).toBe(0x55ce75);
    expect(roadGhostPreview(snapshot, [], { column: 1, row: 4 }, 1000).colour).toBe(0xe65c5c);
    snapshot.farm.roads = [{ column: 7, row: 4, completesAt: 2000 }];
    expect(roadGhostPreview(snapshot, [], targets[0]!, 1000).colour).toBe(0xe65c5c);
  });
  it("accepts an ordered route with a bend, connected to the main road", () => {
    expect(validateRoadPlan(targets, [], new Set(), 1000)).toBeNull();
    expect(roadPlanBlocker(fixture(), targets, 1000)).toBeNull();
  });
  it("rejects gaps, diagonals, duplicates and occupied tiles", () => {
    for (const next of [{ column: 7, row: 2 }, { column: 6, row: 3 }, targets[0]!])
      expect(validateRoadPlan([targets[0]!, next], [], new Set(), 1000)).not.toBeNull();
    expect(validateRoadPlan(targets, [], new Set(["5:3"]), 1000)).toContain("empty");
    expect(validateRoadPlan([], [], new Set(), 1000)).not.toBeNull();
  });
  it("toggles off the last or only tile, but protects a connecting tile", () => {
    const snapshot = fixture();
    expect(toggleRoadPlan(snapshot, [targets[0]!], targets[0]!, 1000)).toEqual({ tiles: [], reason: null });
    expect(toggleRoadPlan(snapshot, targets, targets[2]!, 1000).tiles).toEqual(targets.slice(0, 2));
    const blocked = toggleRoadPlan(snapshot, targets, targets[1]!, 1000);
    expect(blocked.tiles).toEqual(targets);
    expect(blocked.reason).toContain("disconnect");
    expect(roadGhostPreview(snapshot, targets, targets[1]!, 1000).colour).toBe(0xe65c5c);
  });
  it("allows removing a middle tile when both sides reach another completed road", () => {
    const snapshot = fixture();
    snapshot.farm.roads = [{ column: 6, row: 4 }];
    const result = toggleRoadPlan(snapshot, targets, targets[1]!, 1000);
    expect(result.reason).toBeNull();
    expect(result.tiles).toEqual([targets[0], targets[2]]);
    expect(roadPlanBlocker(snapshot, result.tiles, 1000)).toBeNull();
    snapshot.farm.roads[0]!.completesAt = 2000;
    expect(toggleRoadPlan(snapshot, targets, targets[1]!, 1000).reason).toContain("disconnect");
  });
  it("reorders an edited route from its remaining connection, without adding any tiles", () => {
    const snapshot = fixture();
    snapshot.farm.roads = [{ column: 6, row: 4 }];
    const result = toggleRoadPlan(snapshot, targets, targets[0]!, 1000);
    expect(result).toEqual({ tiles: [targets[2], targets[1]], reason: null });
    expect(roadPlanBlocker(snapshot, result.tiles, 1000)).toBeNull();
  });
  it("refuses disconnected or unfinished starting roads, the river and market footprint", () => {
    expect(validateRoadPlan([{ column: 5, row: 2 }], [{ column: 5, row: 3 }], new Set(), 1000)).toContain("connected");
    expect(validateRoadPlan([{ column: 5, row: 3 }], [{ column: 5, row: 4, completesAt: 2000 }], new Set(), 1000)).toContain("completed");
    expect(validateRoadPlan([{ column: 10, row: 4 }], [], new Set(), 1000)).toContain("empty");
    expect(validateRoadPlan([{ column: 5, row: 10 }], [{ column: 5, row: 9 }], new Set(), 1000)).not.toBeNull();
  });
  it("keeps the single-tile API compatible and rejects empty queues", () => {
    const command = { type: "build_road", target: targets[0], expectedFarmVersion: 1 };
    expect(GameCommandSchema.safeParse(command).success).toBe(true);
    expect(GameCommandSchema.safeParse({ ...command, targets }).success).toBe(true);
    expect(GameCommandSchema.safeParse({ ...command, targets: [] }).success).toBe(false);
  });
  it("resumes the correct saved tile and releases the farmer after all deadlines", () => {
    const snapshot = fixture();
    snapshot.farm.roads = [
      { ...targets[0]!, approachPath: [{ column: 5, row: 5 }], completesAt: 6000 },
      { ...targets[1]!, approachPath: [{ column: 5, row: 5 }, targets[0]!], completesAt: 11180 },
    ];
    expect(savedRoadApproach(snapshot, 1000)?.startedAt).toBe(1000);
    expect(savedRoadApproach(snapshot, 6000)?.startedAt).toBe(6000);
    expect(activeConstruction(snapshot, 7000)?.target).toEqual(targets[1]);
    expect(roadPlanBlocker(snapshot, [{ column: 6, row: 4 }], 7000)).toContain("busy");
    expect(savedRoadApproach(snapshot, 20000)).toBeNull();
    expect(activeConstruction(snapshot, 20000)).toBeNull();
    expect(roadPlanBlocker(snapshot, [{ column: 6, row: 4 }], 20000)).toBeNull();
  });
});
